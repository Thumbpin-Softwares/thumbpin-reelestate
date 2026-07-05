const DRAFT_KEY = "news_anchor_draft";

/** Sessionstorage-backed draft so a page refresh doesn't wipe progress
 *  through Upload → Script → Finalize (Generate has its own resume path). */
export function loadDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function saveDraft(partial) {
  try {
    const current = loadDraft() || {};
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, ...partial }));
  } catch (_) {}
}

export function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) {}
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
