"use client";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { CreditCard, Trash2, Crown, Loader2, MoreVertical } from "lucide-react";

// Function to generate consistent color based on user ID or email
const getInitialsColor = (userId, email) => {
  const colors = [
    "bg-orange-500 text-white",
    "bg-yellow-500 text-black",
    "bg-green-500 text-black",
    "bg-purple-500 text-white"
  ];
  
  const str = userId || email;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function UserRow({ user, onCreditClick, onUpdate, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const initials = (user.name || user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const initialsColor = getInitialsColor(user._id, user.email);

  // Calculate dropdown position when menu opens
  useEffect(() => {
    if (menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      // Check if there's enough space below
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 200; // Approximate dropdown height
      
      let top = rect.bottom + scrollTop;
      let left = rect.right + scrollLeft - 192; // 192px is dropdown width (w-48)
      
      // If not enough space below, show above
      if (spaceBelow < dropdownHeight) {
        top = rect.top + scrollTop - dropdownHeight;
      }
      
      setDropdownPosition({ top, left });
    }
  }, [menuOpen]);

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
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${initialsColor}`}>
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
              ? "bg-amber-500 text-black border-neutral-400 px-4"
              : "bg-white text-black border-neutral-400 px-6"
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
            ref={buttonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              {/* Dropdown menu with fixed positioning */}
              <div 
                ref={dropdownRef}
                className="fixed z-50"
                style={{ 
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                }}
              >
                <div className="w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden">
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
              </div>
              {/* Click outside overlay */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setMenuOpen(false)} 
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}