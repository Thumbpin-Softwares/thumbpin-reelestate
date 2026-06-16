"use client";

import { CreditCard, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/hooks/use-user";

export function CreditsBadge() {
  const { credits, loading } = useUser();

  const creditColor =
    credits > 10
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : credits > 5
      ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      : "bg-red-500/10 text-red-600 border-red-500/20";

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted animate-pulse">
        <div className="w-4 h-4 bg-muted-foreground/20 rounded" />
        <div className="w-16 h-4 bg-muted-foreground/20 rounded" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${creditColor}`}>
      <CreditCard className="w-4 h-4" />
      <span className="text-sm font-medium">{credits} Credits</span>
      {credits <= 5 && (
        <Sparkles className="w-3 h-3 animate-pulse" />
      )}
    </div>
  );
}
