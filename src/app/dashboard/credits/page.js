"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/hooks/use-user";
import { CreditCard } from "lucide-react";
import Payment from "@/modules/pricing/payment";
import { CreditTransactions } from "@/modules/dashboard/components/credit-transactions";

export default function CreditsPage() {
  const { credits, profile, loading } = useUser();

  const freeVideoUsed = profile?.freeVideoGenerationsUsed ?? 0;
  const freeAvatarUsed = profile?.freeAvatarGenerationsUsed ?? 0;
  const freePlanUsagePercent = Math.min(100, ((freeVideoUsed + freeAvatarUsed) / 4) * 100);

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

      {/* Transaction history — thumbpin-backend's credits module */}
      <CreditTransactions />

      {/* Pricing — same plans/cards as the public pricing page */}
      <Payment />
    </div>
  );
}
