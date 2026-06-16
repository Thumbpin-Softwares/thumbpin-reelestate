import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/app/api/admin/auth/me/route";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import CreditTransaction from "@/models/CreditTransaction";

// PATCH /api/admin/users/[id]/credits
// Body: { action: "set" | "add" | "remove", amount: number }
export async function PATCH(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { action, amount } = await request.json();

  if (!["set", "add", "remove"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'set', 'add', or 'remove'" },
      { status: 400 }
    );
  }
  if (typeof amount !== "number" || amount < 0) {
    return NextResponse.json(
      { error: "amount must be a non-negative number" },
      { status: 400 }
    );
  }

  await dbConnect();

  let update;
  let newCredits;

  if (action === "set") {
    update = { $set: { credits: amount } };
  } else if (action === "add") {
    update = { $inc: { credits: amount } };
  } else {
    // remove — clamp to 0
    const user = await User.findById(id).select("credits");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const newAmount = Math.max(0, user.credits - amount);
    update = { $set: { credits: newAmount } };
  }

  const updated = await User.findByIdAndUpdate(id, update, { new: true }).select(
    "_id email name credits plan"
  );

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Log the admin credit transaction
  try {
    await CreditTransaction.create({
      userId: id,
      action: "admin_credit_adjustment",
      eventType:
        action === "add"
          ? "credits_added"
          : action === "remove"
          ? "credits_debited"
          : "credits_set",
      mode: "admin",
      creditsDelta:
        action === "set"
          ? 0
          : action === "add"
          ? amount
          : -amount,
      balanceAfter: updated.credits,
      metadata: { adminAction: action, adminEmail: session.email },
    });
  } catch (e) {
    console.warn("[Admin Credits] Failed to log transaction:", e.message);
  }

  return NextResponse.json({ success: true, user: updated });
}

// GET /api/admin/users/[id]/credits — get current credits + history
export async function GET(request, { params }) {
  const session = await verifyAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await dbConnect();

  const [user, transactions] = await Promise.all([
    User.findById(id).select("_id email name credits plan freeVideoGenerationsUsed freeAvatarGenerationsUsed createdAt"),
    CreditTransaction.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user, transactions });
}
