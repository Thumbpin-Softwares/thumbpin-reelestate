// Maps a template slug to its own script-generation module. Every
// template's video pipeline needs different copy — a commercial listing
// script reads nothing like a comedy-reel script, and some templates will
// eventually need a different AI provider or prompt shape entirely — so
// generation logic is split one file per template, loaded lazily by slug.
// Templates without an entry here fall back to `./generic`, a reasonable
// default for any template that's just describing a property from
// SiteForm fields.
const GENERATORS = {
  "property-commercial": () => import("./property-commercial"),
};

export async function getScriptGenerator(slug) {
  const loader = GENERATORS[slug];
  const mod = loader ? await loader() : await import("./generic");
  return mod.generateScript;
}
