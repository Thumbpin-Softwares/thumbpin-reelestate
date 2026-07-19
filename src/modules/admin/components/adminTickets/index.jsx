"use client";

import { useEffect, useState } from "react";
import { adminNotify } from "@/modules/admin/components/notification";
import { Ticket as TicketIcon } from "lucide-react";

const STATUSES = ["all", "open", "in_progress", "resolved", "closed"];

const STATUS_LABEL = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_BADGE_CLASS = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

export function AdminTickets() {
  const [tickets, setTickets] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  async function loadTickets() {
    try {
      const params = new URLSearchParams({ status: statusFilter });
      const res = await fetch(`/api/admin/support/tickets?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data.tickets);
    } catch (err) {
      console.error("[AdminTickets] Failed to load tickets:", err);
      adminNotify.error("Failed to load tickets");
      setTickets([]);
    }
  }

  useEffect(() => {
    setTickets(null);
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      adminNotify.success("Ticket updated");
    } catch (err) {
      adminNotify.error("Update failed", { description: err.message });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
              statusFilter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Raised</th>
            </tr>
          </thead>
          <tbody>
            {tickets === null ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-2.5">
                    <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                  </td>
                </tr>
              ))
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <TicketIcon className="w-6 h-6 text-gray-300" />
                    <p className="text-sm text-gray-400">No tickets</p>
                  </div>
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.subject}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 max-w-md">{t.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{t.user?.name || "—"}</p>
                    <p className="text-xs text-gray-500">{t.user?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRIORITY_BADGE_CLASS[t.priority]}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      disabled={updatingId === t.id}
                      onChange={(e) => handleStatusChange(t.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-900 bg-white disabled:opacity-50"
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
