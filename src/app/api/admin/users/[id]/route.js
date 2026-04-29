import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// PATCH /api/admin/users/[id] — update plan, role, name
export async function PATCH(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const allowed = ["plan", "role", "name"];
  const update = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await dbConnect();
  const updated = await User.findByIdAndUpdate(id, { $set: update }, { new: true }).select(
    "-hashedPassword -googleId"
  );

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: updated });
}

// DELETE /api/admin/users/[id] — delete user account
export async function DELETE(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await dbConnect();

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
