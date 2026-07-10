import dynamic from "next/dynamic";

// Maps a template slug to its step-by-step runner component. Templates
// served by the generic /dashboard/template/[slug] route start out with no
// entry here — they render <ComingSoon /> with their configured steps
// previewed. Once a template's real flow is built (a component that owns
// its own step state, drafts, and generation calls — same shape as e.g.
// modules/luxury-car-exit), add it here and it takes over automatically.
export const TEMPLATE_RUNNERS = {
  "property-commercial": dynamic(() => import("@/modules/template-property-commercial")),
};

export function getTemplateRunner(slug) {
  return TEMPLATE_RUNNERS[slug] || null;
}
