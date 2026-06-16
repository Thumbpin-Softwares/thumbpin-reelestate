import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import { resolveUserFromSession } from "@/lib/user-resolver";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const resolvedUser = await resolveUserFromSession();
    const user = resolvedUser
      ? await User.findById(resolvedUser._id).select("-hashedPassword")
      : await User.findById(session.user.id).select("-hashedPassword");
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[Profile API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
