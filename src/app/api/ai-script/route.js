import { NextResponse } from "next/server";

/**
 * AI Script Writer API
 * Uses Google Gemini API (free tier: 60 RPM, 1M tokens/day)
 * Generates UGC ad scripts from product description
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      product_name,
      product_description,
      target_audience,
      tone = "friendly",
      language = "English",
      duration = "30-60 seconds",
    } = body;

    if (!product_name || !product_description) {
      return NextResponse.json(
        { error: "Product name and description are required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // If no Gemini key, use built-in template generation
    if (!apiKey) {
      console.log("[AI Script] No GEMINI_API_KEY, using template-based generation");
      const scripts = generateTemplateScripts(product_name, product_description, target_audience, tone);
      return NextResponse.json({ success: true, scripts, source: "template" });
    }

    // Call Gemini API
    const prompt = buildPrompt(product_name, product_description, target_audience, tone, language, duration);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text().catch(() => "");
      console.error("[AI Script] Gemini API error:", geminiResponse.status, errorBody);

      if (geminiResponse.status === 429) {
        // Rate limited — fall back to templates
        const scripts = generateTemplateScripts(product_name, product_description, target_audience, tone);
        return NextResponse.json({ success: true, scripts, source: "template" });
      }

      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("Gemini returned empty response");
    }

    // Parse the 3 scripts from the response
    const scripts = parseScripts(rawText, product_name);

    return NextResponse.json({ success: true, scripts, source: "gemini" });
  } catch (error) {
    console.error("[AI Script] Error:", error);
    return NextResponse.json(
      { error: error.message || "Script generation failed" },
      { status: 500 }
    );
  }
}

function buildPrompt(productName, productDesc, audience, tone, language, duration) {
  return `You are an expert UGC (User Generated Content) ad script writer for the Indian market. 
Write exactly 3 different video ad scripts for the following product:

Product: ${productName}
Description: ${productDesc}
Target Audience: ${audience || "Young Indian adults (18-35)"}
Tone: ${tone}
Language: ${language}
Duration: ${duration}

RULES:
1. Each script must be 30-80 words (suitable for a ${duration} video)
2. Start with an attention-grabbing hook (question or bold statement)
3. Include a clear call-to-action at the end
4. Make it conversational and natural (like a person talking to camera)
5. Use Indian context and references where appropriate
6. Include one emoji per script
7. Focus on benefits, not just features
8. Each script should have a different approach (e.g., problem-solution, testimonial-style, urgency-based)

Format your response as:
SCRIPT 1: [title]
[script text]

SCRIPT 2: [title]
[script text]

SCRIPT 3: [title]
[script text]

Write ONLY the scripts, no other commentary.`;
}

function parseScripts(rawText, productName) {
  const scripts = [];
  const parts = rawText.split(/SCRIPT\s*\d+\s*:\s*/i).filter(Boolean);

  for (const part of parts) {
    const lines = part.trim().split("\n").filter(Boolean);
    if (lines.length === 0) continue;

    const title = lines[0].replace(/^[\*\#\-\s]+/, "").replace(/[\*\#]+$/, "").trim();
    const text = lines.slice(1).join("\n").trim();

    if (text.length > 10) {
      scripts.push({
        title: title || `Script for ${productName}`,
        text: text.replace(/[\*]+/g, "").trim(),
        word_count: text.split(/\s+/).length,
      });
    }
  }

  // If parsing failed, treat the whole thing as one script
  if (scripts.length === 0 && rawText.length > 20) {
    scripts.push({
      title: `Ad Script for ${productName}`,
      text: rawText.replace(/[\*\#]+/g, "").trim().substring(0, 500),
      word_count: rawText.split(/\s+/).length,
    });
  }

  return scripts.slice(0, 3);
}

function generateTemplateScripts(productName, productDesc, audience, tone) {
  const hooks = {
    friendly: [
      `Have you tried ${productName} yet? 😍`,
      `I just discovered ${productName} and I'm obsessed!`,
      `Okay but why is nobody talking about ${productName}?`,
    ],
    professional: [
      `Introducing ${productName} — the smart choice.`,
      `Here's why experts recommend ${productName}.`,
      `Looking for results? Meet ${productName}.`,
    ],
    excited: [
      `OMG you guys! ${productName} just changed EVERYTHING! 🔥`,
      `DROP EVERYTHING! You need to see ${productName}!`,
      `I literally can't stop using ${productName}!`,
    ],
    calm: [
      `Let me tell you about ${productName}.`,
      `Here's something that quietly changed my routine — ${productName}.`,
      `${productName} is the upgrade you didn't know you needed.`,
    ],
    serious: [
      `It's time to talk about ${productName}.`,
      `${productName} isn't just a product — it's a solution.`,
      `Why I switched to ${productName} and never looked back.`,
    ],
  };

  const ctas = [
    "Link in bio to shop now! Use code SAVE20 for 20% off!",
    "Tap the link below to get yours today — limited stock!",
    "Follow for more reviews! Link in bio to grab the deal! 🛒",
  ];

  const selectedHooks = hooks[tone] || hooks.friendly;

  return selectedHooks.map((hook, i) => ({
    title: i === 0 ? "Hook & CTA" : i === 1 ? "Expert Pick" : "FOMO Style",
    text: `${hook}\n\n${productDesc.substring(0, 150)}.\n\n${ctas[i]}`,
    word_count: (hook + productDesc.substring(0, 150) + ctas[i]).split(/\s+/).length,
  }));
}
