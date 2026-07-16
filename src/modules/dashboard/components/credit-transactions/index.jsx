"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Loader2 } from "lucide-react";
import { CREDIT_ACTIONS } from "@/lib/credit-costs";

const PAGE_SIZE = 10;

const EVENT_LABEL = {
  free_quota_consumed: "Free usage",
  credits_debited: "Spent",
  credits_refunded: "Refunded",
  credits_added: "Added",
  credits_set: "Balance set",
  subscription_recharge: "Subscription recharge",
  admin_adjustment: "Adjusted by support",
};

function actionLabel(action) {
  return CREDIT_ACTIONS[action]?.label || action.replace(/_/g, " ");
}

function formatDelta(tx) {
  if (tx.mode === "free_quota") return "Free";
  if (tx.creditsDelta > 0) return `+${tx.creditsDelta}`;
  if (tx.creditsDelta < 0) return `${tx.creditsDelta}`;
  return "0";
}

function deltaClass(tx) {
  if (tx.mode === "free_quota") return "text-muted-foreground";
  if (tx.creditsDelta > 0) return "text-emerald-600";
  if (tx.creditsDelta < 0) return "text-red-600";
  return "text-muted-foreground";
}

export function CreditTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (skip) => {
    const res = await fetch(`/api/credits/transactions?limit=${PAGE_SIZE}&skip=${skip}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to load transactions");
    return res.json();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load(0);
        if (cancelled) return;
        setTransactions(data.transactions || []);
        setHasMore(Boolean(data.hasMore));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const data = await load(transactions.length);
      setTransactions((prev) => [...prev, ...(data.transactions || [])]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Couldn&apos;t load your transaction history. Try refreshing.
          </p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No transactions yet — your credit activity will show up here.
          </p>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div
                key={tx._id}
                className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{actionLabel(tx.action)}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {EVENT_LABEL[tx.eventType] || tx.eventType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(tx.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className={`text-sm font-semibold ${deltaClass(tx)}`}>{formatDelta(tx)}</div>
                  {tx.balanceAfter != null && (
                    <div className="text-[11px] text-muted-foreground">balance: {tx.balanceAfter}</div>
                  )}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="pt-3 flex justify-center">
                <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
