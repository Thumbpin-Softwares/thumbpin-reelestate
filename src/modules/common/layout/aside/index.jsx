"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Plus,
  Clock,
  Megaphone,
  RectangleGoggles,
  Columns2,
} from "lucide-react";

const STORAGE_KEY = "aside_collapsed";

const navItems = [
  { label: "Get Started", href: "/app", icon: Plus },
  { label: "Library", href: "/app/assets", icon: FolderOpen },
  { label: "History", href: "/app/history", icon: Clock },
];

const whatsNewItem = { label: "What's New", href: "/app/whats-new", icon: Megaphone };

export default function Aside() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 sticky top-0 z-20 h-screen shadow-xl border border-neutral-100 bg-white rounded-2xl px-3 py-6 gap-1 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className={`flex items-center gap-2 pb-6 ${collapsed ? "justify-center px-0" : "justify-between px-3"}`}>
        <Link href="/" className="flex items-center gap-2 group min-w-0">
          <div className="bg-black flex items-center justify-center p-2 rounded-full shrink-0">
            <RectangleGoggles className="w-4 h-4" fill="#c7f038" />
          </div>
          {!collapsed && <span className="text-xl font-semibold truncate"></span>}
        </Link>

        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            title="Collapse"
            className="flex items-center bg-neutral-200 text-black justify-center w-7 h-7 rounded-full hover:bg-neutral-300 hover:text-neutral-900 cursor-pointer shrink-0"
          >
            <Columns2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggleCollapsed}
          title="Expand"
          className="absolute top-7 -right-3 flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-md border border-neutral-200 text-neutral-500 hover:text-neutral-900 cursor-pointer"
        >
          <Columns2 className="w-3.5 h-3.5" />
        </button>
      )}

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 py-2 rounded-lg text-sm transition-colors ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${
                isActive
                  ? "bg-neutral-200 text-black font-medium"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-neutral-200">
        <Link
          href={whatsNewItem.href}
          title={collapsed ? whatsNewItem.label : undefined}
          className={`flex items-center gap-3 py-2 rounded-lg text-sm transition-colors ${
            collapsed ? "justify-center px-0" : "px-3"
          } ${
            pathname === whatsNewItem.href
              ? "bg-neutral-200 text-black font-medium"
              : "text-neutral-700 hover:bg-neutral-100"
          }`}
        >
          <whatsNewItem.icon className="w-4 h-4 shrink-0" />
          {!collapsed && whatsNewItem.label}
        </Link>
      </div>
    </aside>
  );
}
