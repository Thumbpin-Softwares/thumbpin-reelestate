import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

// GET /api/support/messages?since=<ISO timestamp>
// Returns the user's own support conversation + messages. Pass `since` to
// poll for only what's arrived after the last message already on screen.
export async function GET(request) {
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();

  const conversation = await Conversation.findOne({ userId: user._id });
  if (!conversation) {
    return NextResponse.json({ conversationId: null, messages: [] });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  const query = { conversationId: conversation._id };
  if (since) query.createdAt = { $gt: new Date(since) };

  const messages = await Message.find(query).sort({ createdAt: 1 }).lean();

  // Opening/polling the chat as the user means any admin replies on screen
  // have now been seen.
  await Message.updateMany(
    { conversationId: conversation._id, senderRole: "admin", readByUser: false },
    { $set: { readByUser: true } }
  );

  return NextResponse.json({
    conversationId: conversation._id.toString(),
    messages: messages.map((m) => ({
      id: m._id.toString(),
      senderRole: m.senderRole,
      body: m.body,
      createdAt: m.createdAt,
    })),
  });
}

// POST /api/support/messages  { message: string }
export async function POST(request) {
  const { resolveUserFromSession } = await import("@/lib/user-resolver");
  const user = await resolveUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await request.json();
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }

  await dbConnect();

  let conversation = await Conversation.findOne({ userId: user._id });
  if (!conversation) {
    conversation = await Conversation.create({ userId: user._id });
  }

  const body = message.trim();
  const created = await Message.create({
    conversationId: conversation._id,
    senderRole: "user",
    body,
    readByUser: true,
  });

  conversation.status = "open";
  conversation.lastMessageAt = created.createdAt;
  conversation.lastMessagePreview = body.slice(0, 140);
  await conversation.save();

  return NextResponse.json({
    message: {
      id: created._id.toString(),
      senderRole: "user",
      body: created.body,
      createdAt: created.createdAt,
    },
  });
}
