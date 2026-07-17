"use client";

import { Card } from "@/components/ui/card";
import { useUser } from "@/hooks/use-user";
import { CreditCard, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { CreditTransactions } from "@/modules/dashboard/components/credit-transactions";

export default function CreditsPage() {
  const { credits, profile, loading } = useUser();

  const freeVideoUsed = profile?.freeVideoGenerationsUsed ?? 0;
  const freeAvatarUsed = profile?.freeAvatarGenerationsUsed ?? 0;
  const freePlanUsagePercent = Math.min(
    100,
    ((freeVideoUsed + freeAvatarUsed) / 4) * 100,
  );

  return (
    <div className="max-w-4xl pt-18 mx-auto space-y-6 animate-fade-in">
      {/* Current Balance */}
      <Card className="bg-black rounded-3xl overflow-hidden">
        <div className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Current Balance</p>
              <p className="text-4xl font-bold text-[#c7f03b] mt-1">
                {loading ? "xxxx" : credits}
              </p>
              <p className="text-sm text-neutral-600 mt-1">credits remaining</p>
            </div>

            <div className="space-y-2">
              <div className="flex w-fit px-6 py-2 items-center justify-center gap-2 text-xs rounded-full font-semibold bg-[#c7f03b] text-black uppercase">
              <CreditCard className="w-4 h-4 text-black" />
              {profile?.plan === "pro" ? "Pro Plan" : "Free Plan"}
            </div>
            <Link href="/pricing" className="flex w-fit px-6 py-2 items-center justify-center gap-2 text-xs rounded-full font-semibold text-[#c7f03b] bg-neutral-900 uppercase">
              <ShoppingBasket className="w-4 h-4 text-[#c7f03b]" />
              Upgrade
            </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* Transaction history thumbpin-backend's credits module */}
      <CreditTransactions />
    </div>
  );
}
