"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

// Shared breadcrumb strip for every template pipeline: Dashboard / Templates
// / <template title>. Every template just passes its own `template` (from
// the registry in src/lib/templates.js) — the trail updates automatically,
// so nothing here changes as templates #4 through #100 get added.
export function Breadcrumbs({ template }) {
  const items = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Templates", href: "/dashboard" },
    { label: template?.title || "Template" },
  ];

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 px-1 py-2">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <ChevronRight className="w-3 h-3 text-neutral-300" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="flex items-center gap-1 hover:text-neutral-800 transition-colors">
                {item.icon && <item.icon className="w-3 h-3" />}
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-neutral-900" : "flex items-center gap-1"}>
                {item.icon && <item.icon className="w-3 h-3" />}
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
