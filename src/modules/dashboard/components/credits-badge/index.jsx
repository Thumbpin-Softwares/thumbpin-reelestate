"use client";
import { useEffect } from "react";
import { CreditCard } from "lucide-react";
import { useUser } from "@/hooks/use-user";

export function CreditsBadge() {
  const { credits, loading, refetch } = useUser();

  useEffect(() => {
    const id = setInterval(refetch, 5000);
    return () => clearInterval(id);
  }, [refetch]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-4 h-4" />
        <div className="w-16 h-3" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 rounded shadow-lg bg-linear-to-b from-black to-neutral-600 text-white py-2">
      <CreditCard className="w-4 h-4" />
      <span className="text-sm">{credits} Credits</span>
    </div>
  ); 
}
