"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import {
  CreditCard,
  Sparkles,
  Zap,
  Gift,
  Check,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

const creditPacks = [
  { id: "pack-10", credits: 10, price: 199, label: "Starter", popular: false },
  { id: "pack-50", credits: 50, price: 799, label: "Creator", popular: true },
  { id: "pack-200", credits: 200, price: 2499, label: "Brand", popular: false },
  { id: "pack-500", credits: 500, price: 4999, label: "Agency", popular: false },
];

export default function CreditsPage() {
  const { credits, profile, loading } = useUser();
  const [purchasing, setPurchasing] = useState(null);

  const freeVideoUsed = profile?.freeVideoGenerationsUsed ?? 0;
  const freeAvatarUsed = profile?.freeAvatarGenerationsUsed ?? 0;
  const freePlanUsagePercent = Math.min(100, ((freeVideoUsed + freeAvatarUsed) / 4) * 100);

  async function handlePurchase(pack) {
    setPurchasing(pack.id);

    // Simulate Razorpay checkout
    toast.info("Razorpay checkout would open here", {
      description: `Purchase ${pack.credits} credits for ₹${pack.price}`,
    });

    setTimeout(() => setPurchasing(null), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-heading">Credits</h1>
        <p className="text-muted-foreground mt-1">
          Manage your credit balance and purchase more
        </p>
      </div>

      {/* Current Balance */}
      <Card className="border-border/50 overflow-hidden">
        <div className="gradient-bg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Current Balance</p>
              <p className="text-4xl font-bold mt-1">{loading ? "—" : credits}</p>
              <p className="text-sm text-white/70 mt-1">credits remaining</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>Free tier usage</span>
              <span>{freeVideoUsed + freeAvatarUsed} / 4 used</span>
            </div>
            <Progress value={freePlanUsagePercent} className="h-2 bg-white/20" />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {profile?.plan === "pro" ? "Pro Plan" : "Free Plan"}
            </Badge>
            <span className="text-xs text-muted-foreground">• Free: 2 videos + 2 avatars, then paid credits</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              Video quota: <span className="font-medium text-foreground">{freeVideoUsed}/2</span>
            </div>
            <div>
              Avatar quota: <span className="font-medium text-foreground">{freeAvatarUsed}/2</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          Buy Credit Packs
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditPacks.map((pack) => (
            <Card
              key={pack.id}
              className={`relative border-border/50 hover:shadow-lg transition-all hover:-translate-y-1 ${
                pack.popular ? "border-primary ring-1 ring-primary/30" : ""
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge className="gradient-bg text-white border-0 text-xs">
                    <Sparkles className="w-3 h-3 mr-1" /> Best Value
                  </Badge>
                </div>
              )}
              <CardContent className="p-4 pt-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <p className="font-bold text-lg">{pack.label}</p>
                <p className="text-3xl font-extrabold mt-1">{pack.credits}</p>
                <p className="text-xs text-muted-foreground">credits</p>
                <p className="text-lg font-semibold mt-2">₹{pack.price.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground mb-4">
                  ₹{(pack.price / pack.credits).toFixed(1)} per credit
                </p>
                <Button
                  className={`w-full cursor-pointer ${pack.popular ? "gradient-bg text-white" : ""}`}
                  variant={pack.popular ? "default" : "outline"}
                  onClick={() => handlePurchase(pack)}
                  disabled={purchasing === pack.id}
                >
                  {purchasing === pack.id ? "Processing..." : "Buy Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pro Subscription */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upgrade to Pro</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  500 credits/month, priority queue, HD quality, premium voices
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {["500 credits/mo", "Priority queue", "1080p HD", "Custom watermark"].map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">₹9,440</p>
              <p className="text-xs text-muted-foreground">/month</p>
              <Button className="mt-2 gradient-bg text-white cursor-pointer" size="sm">
                Subscribe
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
