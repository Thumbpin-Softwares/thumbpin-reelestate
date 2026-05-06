"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Trash2, Crown, Loader2, MoreVertical } from "lucide-react";

export default function UserRow({ user, onCreditClick, onUpdate, onDelete }) {
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
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm text-gray-900 font-medium leading-none">
              {user.name || user.email.split("@")[0]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
            user.plan === "pro"
              ? "bg-black text-white border-black"
              : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          {user.plan === "pro" && <Crown className="w-3 h-3" />}
          {user.plan === "pro" ? "Pro" : "Free"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900 font-semibold">{user.credits}</span>
          <button
            onClick={() => onCreditClick(user)}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            title="Manage credits"
          >
            <CreditCard className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
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
            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    onCreditClick(user);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Manage Credits
                </button>
                <button
                  onClick={togglePlan}
                  disabled={updatingPlan}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {updatingPlan ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crown className="w-3.5 h-3.5" />
                  )}
                  {user.plan === "pro" ? "Downgrade to Free" : "Upgrade to Pro"}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    confirmDel
                      ? "text-red-600 bg-red-50"
                      : "text-gray-700 hover:bg-red-50 hover:text-red-600"
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