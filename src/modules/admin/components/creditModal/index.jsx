"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Minus, RefreshCw, Loader2, Clock, X } from "lucide-react";

export default function CreditModal({ user, onClose, onUpdated }) {
    const [action, setAction] = useState("add");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${user._id}/credits`)
      .then((r) => r.json())
      .then((d) => setHistory(d.transactions || []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, [user._id]);

  async function handleSubmit(e) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (isNaN(n) || n < 0) return toast.error("Enter a valid positive number");
    if (!Number.isInteger(n)) return toast.error("Credits must be a whole number");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user._id}/credits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amount: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        action === "set"
          ? `Credits set to ${data.user.credits}`
          : action === "add"
          ? `Added ${n} credits → now ${data.user.credits}`
          : `Removed ${n} credits → now ${data.user.credits}`
      );
      onUpdated(data.user);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to update credits");
    } finally {
      setLoading(false);
    }
  }

  // Black & White styling for actions
  const actionStyles = {
    add:
      action === "add"
        ? "bg-black text-white border-black"
        : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
    remove:
      action === "remove"
        ? "bg-black text-white border-black"
        : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
    set:
      action === "set"
        ? "bg-black text-white border-black"
        : "border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-2xl w-full max-w-lg p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-gray-900 font-semibold text-base font-heading">Credit Manager</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gray-600">{user.name || user.email.split("@")[0]}</p>
              <span className="text-gray-300">·</span>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5">
          <p className="text-xs text-gray-500 mb-1">Current Balance</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-gray-900 font-heading">{user.credits}</p>
            <p className="text-gray-500 text-sm mb-0.5">credits</p>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>Plan: <span className={`font-medium ${user.plan === "pro" ? "text-black" : "text-gray-600"}`}>{user.plan}</span></span>
          </div>
        </div>

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Action</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "add", label: "Add", icon: Plus },
                { val: "remove", label: "Remove", icon: Minus },
                { val: "set", label: "Set to", icon: RefreshCw },
              ].map(({ val, label, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAction(val)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition-all ${actionStyles[val]}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">
              Amount
              {action === "remove" && user.credits < parseInt(amount || "0") && (
                <span className="text-gray-600 ml-2">Will be clamped to 0</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              required
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
            />
            {amount && !isNaN(parseInt(amount)) && (
              <p className="text-xs text-gray-500 mt-1.5">
                Preview:{" "}
                <span className="text-gray-900 font-medium">
                  {action === "set"
                    ? parseInt(amount)
                    : action === "add"
                    ? user.credits + parseInt(amount)
                    : Math.max(0, user.credits - parseInt(amount))}{" "}
                  credits
                </span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !amount}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : (
              "Apply Changes"
            )}
          </button>
        </form>

        {/* Transaction History */}
        <div className="mt-6">
          <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Recent Transactions
          </p>
          {histLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {history.map((tx, i) => (
                <div
                  key={tx._id || i}
                  className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-xs text-gray-700 capitalize">{tx.action?.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      tx.creditsDelta > 0
                        ? "text-gray-900"
                        : tx.creditsDelta < 0
                        ? "text-gray-500"
                        : "text-gray-400"
                    }`}
                  >
                    {tx.creditsDelta > 0 ? "+" : ""}
                    {tx.creditsDelta} → {tx.balanceAfter}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}