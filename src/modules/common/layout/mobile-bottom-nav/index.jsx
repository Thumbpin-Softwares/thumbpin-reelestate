"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, FolderOpen, Pencil, Megaphone } from "lucide-react";

const navItems = [
  { label: "Get Started", href: "/app", icon: Plus },
  { label: "Library", href: "/app/assets", icon: FolderOpen },
  { label: "Edit", href: "/app/edit", icon: Pencil },
  { label: "What's New", href: "/app/whats-new", icon: Megaphone },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-between">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors ${
                isActive ? "text-black font-medium" : "text-neutral-500"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-black" : "text-neutral-500"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
