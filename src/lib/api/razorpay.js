// Razorpay Integration Helpers

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function initRazorpayPayment({ orderId, amount, credits, userEmail, userId, onSuccess, onFailure }) {
  const loaded = await loadRazorpayScript();

  if (!loaded) {
    console.error("Failed to load Razorpay script");
    onFailure?.("Failed to load Razorpay");
    return;
  }

  const options = {
    key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
    amount: amount * 100,
    currency: "INR",
    name: "Thumb AI",
    description: `${credits} Video Credits`,
    order_id: orderId,
    prefill: {
      email: userEmail,
    },
    notes: {
      user_id: userId,
      credits: credits.toString(),
    },
    theme: {
      color: "#8B5CF6",
    },
    handler: function (response) {
      onSuccess?.(response);
    },
    modal: {
      ondismiss: function () {
        onFailure?.("Payment cancelled");
      },
    },
  };

  const razorpay = new window.Razorpay(options);
  razorpay.on("payment.failed", function (response) {
    onFailure?.(response.error.description);
  });
  razorpay.open();
}
