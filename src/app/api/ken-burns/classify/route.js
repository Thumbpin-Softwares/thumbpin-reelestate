/**
 * POST /api/ken-burns/classify
 * Classify property images with Gemini Flash vision.
 * Returns room label + exterior flag for each image.
 */

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";

const LABELS = [
  "Bedroom", "Kitchen", "Living Room", "Bathroom",
  "Dining Room", "Balcony/Terrace", "Lobby/Entrance",
  "Study/Office", "Exterior", "Other",
];

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });

  const ai = new GoogleGenAI({ apiKey });

  const formData = await request.formData();
  const images = formData.getAll("images");
  if (!images.length) return NextResponse.json({ error: "No images" }, { status: 400 });

  const results = [];

  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          parts: [
            {
              text: `You are a property image classifier. Classify this image into exactly ONE category from: ${LABELS.join(", ")}.
"Exterior" = any outdoor view: building facade, street, aerial, parking, garden outside, compound wall.
Return ONLY valid JSON, no markdown: {"label": "...", "isExterior": true/false}`,
            },
            { inlineData: { data: buf.toString("base64"), mimeType: file.type || "image/jpeg" } },
          ],
        }],
      });

      let text = (response.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
      text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
      const parsed = JSON.parse(text);
      results.push({
        index: i,
        label: LABELS.includes(parsed.label) ? parsed.label : "Other",
        isExterior: !!parsed.isExterior,
      });
    } catch (err) {
      console.error(`[Classify] image ${i}:`, err.message);
      results.push({ index: i, label: "Other", isExterior: false });
    }
  }

  return NextResponse.json({ results });
}
