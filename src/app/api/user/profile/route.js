import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { resolveUserFromSession } from "@/lib/user-resolver";

export async function GET() {
  try {
    await dbConnect();
    const resolvedUser = await resolveUserFromSession();
    const user = resolvedUser
      ? await User.findById(resolvedUser._id).select("-hashedPassword")
      : null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[Profile API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
