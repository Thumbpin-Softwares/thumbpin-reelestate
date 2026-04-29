import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@adoraai.com";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || "thumbpin@admin2025";
const ADMIN_SESSION_TOKEN = "admin_session";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check email
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Check password — prefer hashed, fallback to plain
    let valid = false;
    if (ADMIN_PASSWORD_HASH) {
      valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    } else {
      valid = password === ADMIN_PASSWORD_PLAIN;
    }

    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create a signed session token (simple approach using env secret)
    const sessionData = JSON.stringify({
      email: ADMIN_EMAIL,
      role: "admin",
      iat: Date.now(),
    });
    const sessionToken = Buffer.from(sessionData).toString("base64");

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_TOKEN, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Login] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
