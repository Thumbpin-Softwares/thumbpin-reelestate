"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
const PAGE_SIZE = 10;

export function CreditTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const statusLabels = {
    credits_debited: "Debited",
    credit_debited: "Debited",

    credits_credited: "Credited",
    credit_credited: "Credited",

    credits_refunded: "Refunded",
    credit_refunded: "Refunded",

    credits_set : "Refresh",
    credit_set : "Refresh",

    credits_added : "Added",
    credit_added : "Added",
  };

  async function getTransactions(skip = 0) {
    const response = await fetch(
      `/api/credits/transactions?limit=${PAGE_SIZE}&skip=${skip}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Could not load transactions");
    }

    return response.json();
  }

  useEffect(() => {
    async function loadTransactions() {
      try {
        const data = await getTransactions();

        setTransactions(data.transactions || []);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, []);

  async function loadMore() {
    setLoadingMore(true);

    try {
      const data = await getTransactions(transactions.length);

      setTransactions((current) => [...current, ...(data.transactions || [])]);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <main className="flex h-full w-full items-center justify-center gap-2 flex-col">
        <div className="h-8 w-8 rounded-full animate-spin border-t-4 bg-none border-b-4 border-[#c7f03a]"></div>
        <span>Loading, Please Wait</span>
      </main>
    );
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="max-w-4xl bg-white rounded-3xl border border-neutral-200 p-6">
      <h1 className="text-lg flex items-center tracking-tight pb-4 gap-2">
        <History size={18} />
        Transaction History
      </h1>

      {transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-175">
            <div className="grid grid-cols-5 gap-4 border-b border-neutral-200 px-3 py-3 text-sm font-medium text-neutral-500">
              <span>Transaction Name</span>
              <span>Status</span>
              <span>Amount</span>
              <span>Closing Balance</span>
              <span>Date & Time</span>
            </div>

            {transactions.map((transaction) => (
              <div
                key={transaction._id}
                className="grid grid-cols-5 gap-4 border-b border-neutral-200 px-3 py-4 text-sm items-center"
              >
                <p className="capitalize">{transaction.action ?? "—"}</p>
                <p
                  className={
                    transaction.eventType.includes("debited")
                      ? "text-red-700 w-fit px-6 bg-red-200 py-2 text-xs text-center rounded-full"
                      : transaction.eventType.includes("credited" && "refunded")
                        ? "text-green-700 w-fit text-center text-xs bg-green-200 rounded-full px-6 py-2"
                        : "text-neutral-600 bg-neutral-200 text-center w-fit text-xs px-6 py-2 rounded-full"
                  }
                >
                  {statusLabels[transaction.eventType] ??
                    transaction.eventType ??
                    "—"}
                </p>
                <p
                  className={
                    transaction.creditsDelta >= 0
                      ? "font-medium text-green-500"
                      : "font-medium text-red-500"
                  }
                >
                  {transaction.creditsDelta >= 0 ? "+" : ""}
                  {transaction.creditsDelta ?? 0}
                </p>

                <p>{transaction.balanceAfter ?? 0}</p>

                <p className="text-neutral-500">
                  {transaction.createdAt
                    ? new Date(transaction.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="flex items-center justify-center pt-6">
        {hasMore && (
        <button className="text-black bg-[#c7ef44] px-6 py-2 text-sm tracking-tight rounded-md shadow-md" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
      </div>
    </div>
  );
}
