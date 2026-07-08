const DRAFTS_KEY = "edit_drafts_v1";

/** Multiple saved edits (one per video) live here, keyed by draftKeyFor(...),
 *  in localStorage — unlike the single active composition in sessionStorage
 *  (see COMPOSITION_STORAGE_KEY), these need to survive closing the tab so
 *  they can show up as resumable draft cards on the /dashboard/edit dashboard. */
function readStore() {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
  } catch (_) {}
}

/** Stable per-video draft key — prefers the underlying Asset id (works even
 *  if the video is regenerated/reprobed) and falls back to a signature of
 *  the composition's source URLs for compositions without one. */
export function draftKeyFor(compositionProps) {
  if (compositionProps?.assetId) return `asset:${compositionProps.assetId}`;
  return [
    compositionProps?.source,
    compositionProps?.avatarVideoUrl,
    compositionProps?.ctaVideoUrl,
    compositionProps?.part2AudioUrl,
  ].join("|");
}

export function loadDraft(key) {
  if (!key) return null;
  const store = readStore();
  return store[key] || null;
}

export function saveDraft(key, draft) {
  if (!key) return;
  const store = readStore();
  store[key] = { ...draft, updatedAt: Date.now() };
  writeStore(store);
}

export function clearDraft(key) {
  if (!key) return;
  const store = readStore();
  delete store[key];
  writeStore(store);
}

/** All saved drafts, most recently edited first — for the dashboard grid. */
export function listDrafts() {
  const store = readStore();
  return Object.entries(store)
    .map(([key, draft]) => ({ key, ...draft }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
