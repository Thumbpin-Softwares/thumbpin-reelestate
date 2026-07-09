import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Ticket from "@/models/Ticket";

// GET /api/support/tickets — the current user's own tickets, newest first.
export async function GET(request) {
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  const tickets = await Ticket.find({ userId: user._id }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t._id.toString(),
      subject: t.subject,
      description: t.description,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt,
    })),
  });
}

// POST /api/support/tickets  { subject, description, priority }
export async function POST(request) {
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, description, priority } = await request.json();
  if (!subject?.trim() || !description?.trim()) {
    return NextResponse.json({ error: "Subject and description are required" }, { status: 400 });
  }

  await dbConnect();

  const ticket = await Ticket.create({
    userId: user._id,
    subject: subject.trim(),
    description: description.trim(),
    priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
  });

  return NextResponse.json({
    ticket: {
      id: ticket._id.toString(),
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
    },
  });
}
