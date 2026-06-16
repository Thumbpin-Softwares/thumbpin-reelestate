"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useUser } from "@/hooks/use-user";

export function UpgradeBanner() {
  const { credits, profile } = useUser();

  if (credits > 5 || profile?.plan === "pro") return null;

  return (
    <div className="rounded-xl gradient-bg p-4 text-white shadow-lg glow-purple">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Running Low on Credits</h3>
          <p className="text-xs text-white/80 mt-1">
            You have {credits} credits left. Upgrade to Pro for 500 credits/month.
          </p>
          <Link href="/app/credits">
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 cursor-pointer bg-white/20 hover:bg-white/30 text-white border-0"
            >
              Upgrade Now <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
