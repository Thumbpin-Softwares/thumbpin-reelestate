import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import Ticket from "@/models/Ticket";

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];

// PATCH /api/admin/support/tickets/:id  { status }
export async function PATCH(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await request.json();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await dbConnect();

  const ticket = await Ticket.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  return NextResponse.json({
    ticket: {
      id: ticket._id.toString(),
      status: ticket.status,
    },
  });
}
