"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Image as ImageIcon,
  CreditCard,
  TrendingUp,
  Crown,
  UserCheck,
  Clock,
  ArrowRight,
  BarChart3,
  Zap,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, loading }) {
  // Unified black and white styling
  const containerStyle = "bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-400 transition-all duration-200 shadow-sm";
  const iconContainerStyle = "w-10 h-10 rounded-xl border flex items-center justify-center bg-gray-100 border-gray-200 text-gray-900";

  return (
    <div className={containerStyle}>
      <div className="flex items-start justify-between mb-4">
        <div className={iconContainerStyle}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-gray-900 font-heading">{value ?? "—"}</p>
          <p className="text-sm text-gray-600 mt-1">{label}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

function RecentUserRow({ user }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
          {(user.name || user.email)?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm text-gray-900 font-medium leading-none">
            {user.name || user.email.split("@")[0]}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
            user.plan === "pro"
              ? "bg-gray-900 text-white border-gray-900"
              : "bg-gray-50 text-gray-600 border-gray-200"
          }`}
        >
          {user.plan === "pro" ? "Pro" : "Free"}
        </span>
        <span className="text-xs text-gray-500 font-mono">{user.credits} cr</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;
  const recentUsers = data?.recentUsers || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in bg-gray-50 min-h-screen p-4 sm:p-8 rounded-none sm:rounded-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-heading tracking-tight">
          Dashboard
        </h1>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/avatars"
          className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-900 transition-all duration-200 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-sm">Manage Avatars</p>
                <p className="text-gray-500 text-xs mt-0.5">Upload, delete, organize</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          href="/admin/users"
          className="group bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-900 transition-all duration-200 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-sm">Manage Users</p>
                <p className="text-gray-500 text-xs mt-0.5">Credits, plans, accounts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers?.toLocaleString()}
          loading={loading}
        />
        <StatCard
          icon={Crown}
          label="Pro Users"
          value={stats?.proUsers?.toLocaleString()}
          sub={`${Math.round((stats?.proUsers / stats?.totalUsers) * 100) || 0}% conversion`}
          loading={loading}
        />
        <StatCard
          icon={UserCheck}
          label="Free Users"
          value={stats?.freeUsers?.toLocaleString()}
          loading={loading}
        />
        <StatCard
          icon={BarChart3}
          label="Total Videos"
          value={stats?.totalVideos?.toLocaleString()}
          loading={loading}
        />
        <StatCard
          icon={ImageIcon}
          label="Avatar Assets"
          value={stats?.totalAvatarAssets?.toLocaleString()}
          loading={loading}
        />
        <StatCard
          icon={Zap}
          label="Credits In System"
          value={stats?.totalCreditsInSystem?.toLocaleString()}
          sub={`avg ${stats?.avgCreditsPerUser} per user`}
          loading={loading}
        />
      </div>

      {/* Recent Users */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Recent Signups</h2>
          </div>
          <Link
            href="/admin/users"
            className="text-xs text-gray-900 hover:underline flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="px-5">
          {loading ? (
            <div className="space-y-3 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="text-gray-500 text-sm py-6 text-center">No users yet</p>
          ) : (
            recentUsers.map((u) => <RecentUserRow key={u._id} user={u} />)
          )}
        </div>
      </div>
    </div>
  );
}