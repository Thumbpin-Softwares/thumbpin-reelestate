import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ADMIN_SESSION_TOKEN = "admin_session";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@adoraai.com";

export async function verifyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_TOKEN)?.value;
  if (!token) return null;

  try {
    const sessionData = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (
      sessionData.role === "admin" &&
      sessionData.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    ) {
      // Max session age: 8 hours
      if (Date.now() - sessionData.iat < 8 * 60 * 60 * 1000) {
        return sessionData;
      }
    }
  } catch {
    // invalid token
  }
  return null;
}

export async function GET() {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ admin: session.email });
}
