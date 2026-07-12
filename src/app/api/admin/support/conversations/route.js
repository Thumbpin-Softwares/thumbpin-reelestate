import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import "@/models/User"; // registers the "User" model so Conversation.populate("userId") resolves

// GET /api/admin/support/conversations — every user's support thread,
// most recently active first, with an unread (by admin) count each.
export async function GET() {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const conversations = await Conversation.find({})
    .populate("userId", "name email")
    .sort({ lastMessageAt: -1 })
    .lean();

  const unreadCounts = await Message.aggregate([
    { $match: { senderRole: "user", readByAdmin: false } },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);
  const unreadByConversation = new Map(unreadCounts.map((u) => [u._id.toString(), u.count]));

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c._id.toString(),
      user: c.userId ? { id: c.userId._id.toString(), name: c.userId.name, email: c.userId.email } : null,
      status: c.status,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      unreadCount: unreadByConversation.get(c._id.toString()) || 0,
    })),
  });
}
