// Central registry for dashboard templates.
//
// Every template (built or not-yet-built) gets one entry here. Templates
// that already have a bespoke, fully custom flow keep their own route
// folder under src/app/dashboard/<slug>/ and just set `href` to point at
// it. Everything else is served by the single dynamic route
// src/app/dashboard/template/[slug]/page.jsx — add a `runner` (dynamic
// import of the step-by-step component) once it's built; until then it
// falls back to a shared "coming soon" scaffold that still previews the
// configured steps. This is what lets the catalog scale to 50-100
// templates without adding a route folder per template.

export const TEMPLATES = [
  {
    slug: "luxury-car-exit",
    title: "Model exiting a luxury vehicle",
    category: "real-estate",
    video: "https://content.thumbpin.in/templates/modelLuxuryVehicle.mp4",
    tag: "Popular",
    steps: ["Add Assets", "Script", "Finalize"],
    href: "/dashboard/luxury-car-exit",
    hidden: true,
  },
  {
    slug: "comedy-reel",
    title: "Frustrated Anchor",
    category: "real-estate",
    video:
      "https://content.thumbpin.in/users/69e20794114a93d739a79321/videos/comedy-part1-1782435955101-f239cdf4.mp4",
    tag: "Popular",
    steps: ["Add Assets", "Script", "Finalize"],
    href: "/dashboard/comedy-reel",
    hidden: true,
  },
  {
    slug: "action-reel",
    title: "Action-Packed Property Reveal",
    category: "real-estate",
    video:
      "https://content.thumbpin.in/users/69e20794114a93d739a79321/videos/areel-final-1782433444937-1782433444937-38a76a27.mp4",
    tag: "New",
    steps: ["Add Assets", "Script", "Finalize"],
    href: "/dashboard/action-reel",
    hidden: true,
  },
  {
    slug: "property-commercial",
    title: "Model doing a property commerical",
    category: "real-estate",
    video: "https://content.thumbpin.in/templates/property-commercial.mp4",
    tag: "Popular",
    steps: ["Add Assets", "Script", "Finalize"],
  },
];

// Templates shown in the catalog. Set `hidden: true` on a template above to
// keep it out of the listing without deleting its entry — it stays reachable
// by direct link via getTemplateBySlug.
export function getAllTemplates() {
  return TEMPLATES.filter((t) => !t.hidden);
}

export function getTemplateBySlug(slug) {
  return TEMPLATES.find((t) => t.slug === slug);
}

// Templates rendered through the generic /dashboard/template/[slug] route —
// i.e. everything that doesn't already own a dedicated route via `href`.
export function getGenericTemplates() {
  return TEMPLATES.filter((t) => !t.href);
}
