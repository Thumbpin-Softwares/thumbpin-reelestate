import { NextResponse } from "next/server";
import { createUser } from "@/lib/users";

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const user = await createUser({ email, password, name: name?.trim() || undefined });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Registration failed" }, { status: 400 });
  }
}
