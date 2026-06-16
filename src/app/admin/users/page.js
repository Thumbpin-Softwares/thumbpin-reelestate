"use client";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, UserX } from "lucide-react";
import UserRow from "@/modules/admin/components/userRow";
import CreditModal from "@/modules/admin/components/creditModal";

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
    const fetchUsers = async () => {
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
    };

    fetchUsers();
  }, [page, debouncedSearch]);

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
          <h1 className="text-2xl font-bold text-gray-900 font-heading tracking-tight">
            User Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString()} registered accounts
          </p>
        </div>
        <button
          onClick={loadUsers}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 bg-white text-sm px-3 py-2 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          id="user-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Plan
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Credits
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Joined
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            {/* Added pb-12 to create space for the dropdown on the last row */}
            <tbody className="pb-12"> 
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <UserX className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} total users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 hover:border-gray-300 bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:text-gray-900 hover:border-gray-300 bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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