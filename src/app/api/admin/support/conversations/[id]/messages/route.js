import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

// GET /api/admin/support/conversations/:id/messages?since=<ISO timestamp>
export async function GET(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const query = { conversationId: id };
  if (since) query.createdAt = { $gt: new Date(since) };

  const messages = await Message.find(query).sort({ createdAt: 1 }).lean();

  // Opening/polling this thread as an admin means any user messages on
  // screen have now been seen.
  await Message.updateMany(
    { conversationId: id, senderRole: "user", readByAdmin: false },
    { $set: { readByAdmin: true } }
  );

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderRole: m.senderRole,
      body: m.body,
      createdAt: m.createdAt,
    })),
  });
}

// POST /api/admin/support/conversations/:id/messages  { body: string }
export async function POST(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { body } = await request.json();
  if (!body?.trim()) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  await dbConnect();

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const trimmed = body.trim();
  const created = await Message.create({
    conversationId: conversation._id,
    senderRole: "admin",
    body: trimmed,
    readByAdmin: true,
  });

  conversation.lastMessageAt = created.createdAt;
  conversation.lastMessagePreview = trimmed.slice(0, 140);
  await conversation.save();

  return NextResponse.json({
    message: {
      id: created._id.toString(),
      senderRole: "admin",
      body: created.body,
      createdAt: created.createdAt,
    },
  });
}
