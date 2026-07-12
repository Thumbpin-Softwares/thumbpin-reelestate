import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import Ticket from "@/models/Ticket";
import "@/models/User"; // registers the "User" model so Ticket.populate("userId") resolves

// GET /api/admin/support/tickets?status=open — every user's ticket, newest first.
export async function GET(request) {
  const session = await verifyAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  await dbConnect();

  const query = status && status !== "all" ? { status } : {};
  const tickets = await Ticket.find(query)
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t._id.toString(),
      user: t.userId ? { id: t.userId._id.toString(), name: t.userId.name, email: t.userId.email } : null,
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
    })),
  });
}
