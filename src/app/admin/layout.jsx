"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  LayoutDashboard,
  Users,
  Image as ImageIcon,
  LogOut,
  Menu,
  X,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Login page renders unconditionally below, before any auth check runs.
    if (pathname === "/admin/login") return;

    let cancelled = false;
    fetch("/api/admin/auth/me")
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) router.replace("/admin/login");
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/dashboard");
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-300 flex items-center justify-center animate-pulse">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <p className="text-gray-500 text-sm font-medium">
            Verifying admin session...
          </p>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Manage Avatars", href: "/admin/avatars", icon: ImageIcon },
    { label: "Manage Users", href: "/admin/users", icon: Users },
    { label: "Support", href: "/admin/support", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen bg-white border-r border-gray-200 flex flex-col z-50 transition-all duration-300 ${
          collapsed ? "md:w-20" : "md:w-54"
        } w-54 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Brand */}
        <div
          className={`p-5 border-b border-gray-100 flex items-center ${collapsed ? "md:justify-center md:px-3" : "justify-between"}`}
        >
          <p
            className={`text-black font-semibold font-heading leading-none ${collapsed ? "md:hidden" : ""}`}
          >
            Admin
          </p>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden md:flex p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 group ${
                  collapsed ? "md:justify-center" : ""
                } ${
                  isActive
                    ? "bg-[#c7f038] text-black"
                    : "text-black hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Divider + Return to app */}
        <div className="p-4 space-y-2 border-t border-gray-100">
          <button
            onClick={handleLogout}
            id="admin-logout"
            title={collapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 text-white bg-red-500 rounded-md ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className={collapsed ? "md:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-200 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-900" />
            <span className="text-gray-900 text-sm font-bold">Admin</span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
