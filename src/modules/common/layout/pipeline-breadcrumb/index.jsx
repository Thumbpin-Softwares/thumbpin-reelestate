"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

// Only these routes count as "pipelines" — library/edit/credits/profile/etc.
// are utility pages and don't get a breadcrumb.
const PIPELINE_LABELS = {
  "seedance-reel": "Luxury Car Exit",
  "news-anchor": "News Anchor",
  "home-tour": "Home Tour",
  "ugc-creator": "UGC Creator",
  "product-to-video": "Product Video",
  "site-view": "Site View",
  "ai-walkthrough": "Real Estate Walkthrough",
  "interior-shots": "Interior Shots",
  "ken-burns": "Ken Burns",
  "veo-long-ad": "Veo Long Ad",
  "action-reel": "Action Reel",
  "comedy-reel": "Comedy Reel",
  "prototype": "Prototype",
};

export default function PipelineBreadcrumb() {
  const pathname = usePathname();
  const segment = pathname.split("/")[2]; // /app/<segment>/...
  const label = PIPELINE_LABELS[segment];

  if (!label) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm pt-12 text-neutral-500">
      <Link href="/app" className="flex items-center gap-1 hover:text-black transition-colors">
        <Home className="w-3.5 h-3.5" />
        Dashboard
      </Link>
      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
      <span className="text-black font-medium">{label}</span>
    </nav>
  );
}
