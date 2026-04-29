"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Users,
  CreditCard,
  Trash2,
  Crown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RefreshCw,
  X,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  UserX,
  MoreVertical,
  TrendingUp,
  Shield,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────
// Credit Manager Modal
// ────────────────────────────────────────────────────────────────
function CreditModal({ user, onClose, onUpdated }) {
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

  const actionStyles = {
    add: "bg-emerald-600/15 border-emerald-500/30 text-emerald-400",
    remove: "bg-red-600/15 border-red-500/30 text-red-400",
    set: "bg-indigo-600/15 border-indigo-500/30 text-indigo-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold text-base font-heading">Credit Manager</h3>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-slate-400">{user.name || user.email.split("@")[0]}</p>
              <span className="text-slate-600">·</span>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-5">
          <p className="text-xs text-slate-400 mb-1">Current Balance</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-white font-heading">{user.credits}</p>
            <p className="text-slate-400 text-sm mb-0.5">credits</p>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>Plan: <span className={`font-medium ${user.plan === "pro" ? "text-amber-400" : "text-slate-400"}`}>{user.plan}</span></span>
          </div>
        </div>

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">Action</label>
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
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                    action === val
                      ? actionStyles[val]
                      : "border-slate-700 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 block">
              Amount
              {action === "remove" && user.credits < parseInt(amount || "0") && (
                <span className="text-amber-400 ml-2">Will be clamped to 0</span>
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {amount && !isNaN(parseInt(amount)) && (
              <p className="text-xs text-slate-500 mt-1.5">
                Preview:{" "}
                <span className="text-slate-300 font-medium">
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
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all"
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
          <p className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Recent Transactions
          </p>
          {histLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-600 py-3 text-center">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {history.map((tx, i) => (
                <div
                  key={tx._id || i}
                  className="flex items-center justify-between bg-slate-800/50 border border-slate-800 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-xs text-slate-300">{tx.action?.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      tx.creditsDelta > 0
                        ? "text-emerald-400"
                        : tx.creditsDelta < 0
                        ? "text-red-400"
                        : "text-slate-500"
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

// ────────────────────────────────────────────────────────────────
// User Row
// ────────────────────────────────────────────────────────────────
function UserRow({ user, onCreditClick, onUpdate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  const initials = (user.name || user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function togglePlan() {
    const newPlan = user.plan === "pro" ? "free" : "pro";
    setUpdatingPlan(true);
    try {
      const res = await fetch(`/api/admin/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Plan updated to ${newPlan}`);
      onUpdate(data.user);
    } catch (err) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setUpdatingPlan(false);
      setMenuOpen(false);
    }
  }

  async function handleDelete() {
    if (!confirmDel) {
      setConfirmDel(true);
      setTimeout(() => setConfirmDel(false), 4000);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("User deleted");
      onDelete(user._id);
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleting(false);
      setConfirmDel(false);
      setMenuOpen(false);
    }
  }

  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-400 flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm text-white font-medium leading-none">
              {user.name || user.email.split("@")[0]}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            user.plan === "pro"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}
        >
          {user.plan === "pro" && <Crown className="w-3 h-3" />}
          {user.plan === "pro" ? "Pro" : "Free"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white font-semibold">{user.credits}</span>
          <button
            onClick={() => onCreditClick(user)}
            className="p-1 text-indigo-400 hover:bg-indigo-600/10 rounded-lg transition-colors"
            title="Manage credits"
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {new Date(user.createdAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    onCreditClick(user);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Manage Credits
                </button>
                <button
                  onClick={togglePlan}
                  disabled={updatingPlan}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  {updatingPlan ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crown className="w-3.5 h-3.5" />
                  )}
                  {user.plan === "pro" ? "Downgrade to Free" : "Upgrade to Pro"}
                </button>
                <div className="border-t border-slate-700 my-1" />
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    confirmDel
                      ? "text-red-400 bg-red-500/10"
                      : "text-slate-300 hover:bg-red-500/10 hover:text-red-400"
                  }`}
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {confirmDel ? "Confirm Delete?" : "Delete User"}
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [creditUser, setCreditUser] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function handleUserUpdate(updatedUser) {
    setUsers((prev) =>
      prev.map((u) => (u._id === updatedUser._id ? { ...u, ...updatedUser } : u))
    );
  }

  function handleUserDelete(id) {
    setUsers((prev) => prev.filter((u) => u._id !== id));
    setTotal((t) => t - 1);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading tracking-tight">
            User Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {total.toLocaleString()} registered accounts
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 text-sm px-3 py-2 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          id="user-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Credits
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-8 bg-slate-800 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <UserX className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">
                      {debouncedSearch ? "No users match your search" : "No users yet"}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <UserRow
                    key={user._id}
                    user={user}
                    onCreditClick={setCreditUser}
                    onUpdate={handleUserUpdate}
                    onDelete={handleUserDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} · {total} total users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-1.5 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Credit Modal */}
      {creditUser && (
        <CreditModal
          user={creditUser}
          onClose={() => setCreditUser(null)}
          onUpdated={(updated) => {
            handleUserUpdate(updated);
            setCreditUser(null);
          }}
        />
      )}
    </div>
  );
}
