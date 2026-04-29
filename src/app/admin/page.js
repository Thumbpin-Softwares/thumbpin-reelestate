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

function StatCard({ icon: Icon, label, value, sub, color = "indigo", loading }) {
  const colorMap = {
    indigo: "bg-indigo-600/10 border-indigo-500/20 text-indigo-400",
    emerald: "bg-emerald-600/10 border-emerald-500/20 text-emerald-400",
    amber: "bg-amber-600/10 border-amber-500/20 text-amber-400",
    purple: "bg-purple-600/10 border-purple-500/20 text-purple-400",
    cyan: "bg-cyan-600/10 border-cyan-500/20 text-cyan-400",
    rose: "bg-rose-600/10 border-rose-500/20 text-rose-400",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-20 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold text-white font-heading">{value ?? "—"}</p>
          <p className="text-sm text-slate-400 mt-1">{label}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

function RecentUserRow({ user }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-400">
          {(user.name || user.email)?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm text-white font-medium leading-none">
            {user.name || user.email.split("@")[0]}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.plan === "pro"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {user.plan === "pro" ? "Pro" : "Free"}
        </span>
        <span className="text-xs text-slate-500">{user.credits} cr</span>
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
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white font-heading tracking-tight">
          Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Platform overview — ThumbpinVids Admin
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/avatars"
          className="group bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border border-indigo-500/20 rounded-2xl p-5 hover:border-indigo-500/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Manage Avatars</p>
                <p className="text-slate-400 text-xs mt-0.5">Upload, delete, organize</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          href="/admin/users"
          className="group bg-gradient-to-br from-emerald-600/10 to-cyan-600/10 border border-emerald-500/20 rounded-2xl p-5 hover:border-emerald-500/40 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Manage Users</p>
                <p className="text-slate-400 text-xs mt-0.5">Credits, plans, accounts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers?.toLocaleString()}
          color="indigo"
          loading={loading}
        />
        <StatCard
          icon={Crown}
          label="Pro Users"
          value={stats?.proUsers?.toLocaleString()}
          sub={`${Math.round((stats?.proUsers / stats?.totalUsers) * 100) || 0}% conversion`}
          color="amber"
          loading={loading}
        />
        <StatCard
          icon={UserCheck}
          label="Free Users"
          value={stats?.freeUsers?.toLocaleString()}
          color="cyan"
          loading={loading}
        />
        <StatCard
          icon={BarChart3}
          label="Total Videos"
          value={stats?.totalVideos?.toLocaleString()}
          color="purple"
          loading={loading}
        />
        <StatCard
          icon={ImageIcon}
          label="Avatar Assets"
          value={stats?.totalAvatarAssets?.toLocaleString()}
          color="emerald"
          loading={loading}
        />
        <StatCard
          icon={Zap}
          label="Credits In System"
          value={stats?.totalCreditsInSystem?.toLocaleString()}
          sub={`avg ${stats?.avgCreditsPerUser} per user`}
          color="rose"
          loading={loading}
        />
      </div>

      {/* Recent Users */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Recent Signups</h2>
          </div>
          <Link
            href="/admin/users"
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="px-5">
          {loading ? (
            <div className="space-y-3 py-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="text-slate-500 text-sm py-6 text-center">No users yet</p>
          ) : (
            recentUsers.map((u) => <RecentUserRow key={u._id} user={u} />)
          )}
        </div>
      </div>
    </div>
  );
}
