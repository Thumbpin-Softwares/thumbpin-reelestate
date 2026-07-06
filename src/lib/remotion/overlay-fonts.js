// Font choices for text overlays. Kept to common web-safe stacks (same
// convention as IntroAnimation/OutroAnimation) rather than pulling in
// @remotion/google-fonts — no async font loading, and no risk of the
// preview (browser fonts) drifting from the server render (headless
// Chromium fonts) for a name that isn't actually installed there.
export const OVERLAY_FONTS = [
  { id: "sans",      label: "Sans",       css: "'Arial', 'Helvetica', sans-serif" },
  { id: "serif",     label: "Serif",      css: "'Georgia', 'Times New Roman', serif" },
  { id: "mono",      label: "Mono",       css: "'Courier New', monospace" },
  { id: "trebuchet", label: "Trebuchet",  css: "'Trebuchet MS', sans-serif" },
  { id: "verdana",   label: "Verdana",    css: "'Verdana', sans-serif" },
  { id: "impact",    label: "Impact",     css: "'Impact', 'Arial Narrow', sans-serif" },
  { id: "comic",     label: "Comic",      css: "'Comic Sans MS', cursive" },
];

export function getOverlayFontCss(id) {
  return OVERLAY_FONTS.find((f) => f.id === id)?.css || OVERLAY_FONTS[0].css;
}

// opacityPercent is 0-100. Returns "transparent" at 0 so callers can skip
// padding/background entirely without a separate "enabled" flag.
export function hexToRgba(hex, opacityPercent = 0) {
  if (!opacityPercent) return "transparent";
  const clean = (hex || "#000000").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(100, Math.max(0, opacityPercent)) / 100})`;
}
