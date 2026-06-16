import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const CREDIT_PACKS = {
  "pack-10": { credits: 10, amount: 199 },
  "pack-50": { credits: 50, amount: 799 },
  "pack-200": { credits: 200, amount: 2499 },
  "pack-500": { credits: 500, amount: 4999 },
};

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { packId } = body;

    if (!packId || !CREDIT_PACKS[packId]) {
      return NextResponse.json(
        { error: "Invalid credit pack" },
        { status: 400 }
      );
    }

    await dbConnect();
    const user = await User.findById(session.user.id).select("_id email");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const selectedPack = CREDIT_PACKS[packId];
    const userId = user._id.toString();

    const amount = selectedPack.amount;
    const credits = selectedPack.credits;

    const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      // Mock order for development
      return NextResponse.json({
        id: `order_mock_${Date.now()}`,
        amount: amount * 100, // Razorpay expects paise
        currency: "INR",
        notes: { user_id: userId, credits: credits.toString(), pack_id: packId },
      });
    }

    // Create Razorpay order
    const Razorpay = (await import("razorpay")).default;
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100, // Amount in paise
      currency: "INR",
      receipt: `credits_${userId}_${Date.now()}`,
      notes: {
        user_id: userId,
        credits: credits.toString(),
        pack_id: packId,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
