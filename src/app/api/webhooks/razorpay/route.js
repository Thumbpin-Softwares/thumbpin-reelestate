import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import WebhookEvent from "@/models/WebhookEvent";
import { addCredits } from "@/lib/credit-system";

export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    // Verify webhook signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const eventId = event?.payload?.payment?.entity?.id
      || event?.payload?.subscription?.entity?.id
      || event?.id;

    await dbConnect();

    if (!eventId) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    try {
      await WebhookEvent.create({
        provider: "razorpay",
        eventId,
        eventType,
      });
    } catch (dupErr) {
      if (dupErr?.code === 11000) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw dupErr;
    }

    switch (eventType) {
      case "payment.captured": {
        // Payment successful – add credits to user
        const payment = event.payload.payment.entity;
        const userId = payment.notes?.user_id;
        const credits = parseInt(payment.notes?.credits || "0", 10);
        const orderId = payment.order_id;

        console.log(`Payment captured: ${payment.id} for user ${userId}, ${credits} credits`);

        if (userId && credits > 0) {
          await addCredits({
            userId,
            amount: credits,
            action: "credits_topup",
            metadata: {
              source: "razorpay",
              paymentId: payment.id,
              orderId,
              eventType,
            },
          });
          console.log(`Successfully added ${credits} credits to user ${userId}`);
        }

        break;
      }

      case "subscription.activated": {
        // Pro subscription started
        const subscription = event.payload.subscription.entity;
        const userId = subscription.notes?.user_id;

        console.log(`Subscription activated: ${subscription.id} for user ${userId}`);

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            plan: "pro",
          });

          await addCredits({
            userId,
            amount: 500,
            action: "subscription_recharge",
            metadata: {
              source: "razorpay",
              subscriptionId: subscription.id,
              eventType,
            },
          });
        }

        break;
      }

      default:
        console.log(`Unhandled Razorpay event: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
