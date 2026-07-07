export const MAX_REEL_SECONDS = 60;

/**
 * Scales down brollClips' segmentDuration (proportionally, if needed) so the
 * total reel — avatar + broll + CTA + optional intro/outro — never exceeds
 * MAX_REEL_SECONDS. The broll segment is the only "elastic" part (its length
 * tracks the Part 2 voiceover, which can run long for a wordy script), so it's
 * the one that gets compressed; playbackRate in SeedanceReelComposition
 * recalculates automatically from videoDuration/segmentDuration.
 */
export function clampBrollClips({
  avatarDuration = 15,
  brollClips     = [],
  ctaDuration    = 10,
  showIntro      = false,
  showOutro      = false,
  maxSeconds     = MAX_REEL_SECONDS,
}) {
  const introSeconds = showIntro ? 3 : 0;
  const outroSeconds = showOutro ? 3 : 0;
  const fixedSeconds = introSeconds + avatarDuration + ctaDuration + outroSeconds;
  const brollBudget  = Math.max(0, maxSeconds - fixedSeconds);

  const brollTotal = brollClips.reduce((s, c) => s + (c.segmentDuration || 0), 0);
  if (brollTotal <= brollBudget || brollTotal === 0) return brollClips;

  const scale = brollBudget / brollTotal;
  return brollClips.map((c) => ({ ...c, segmentDuration: (c.segmentDuration || 0) * scale }));
}

/**
 * Compute total Remotion composition duration in frames.
 *
 * Pass either:
 *   brollClips — array of { segmentDuration } objects (preferred)
 *   walkthroughAudioDuration — legacy single-clip fallback
 */
export function calcDurationInFrames({
  avatarDuration           = 15,
  brollClips               = null,
  walkthroughAudioDuration = 25,
  ctaDuration              = 10,
  fps                      = 30,
  showIntro                = false,
  showOutro                = false,
} = {}) {
  const brollSeconds = brollClips
    ? brollClips.reduce((s, c) => s + (c.segmentDuration || 0), 0)
    : walkthroughAudioDuration;

  const introSeconds = showIntro ? 3 : 0;
  const outroSeconds = showOutro ? 3 : 0;

  return Math.ceil((introSeconds + avatarDuration + brollSeconds + ctaDuration + outroSeconds) * fps);
}

/**
 * Given the full original timeline length and a list of excluded frame
 * ranges (frames to cut out, in original-timeline coordinates), returns the
 * resulting shorter "virtual" timeline plus the original<->virtual mapping
 * for each surviving chunk. Overlapping/adjacent excluded ranges are merged.
 *
 * Used by the editor's Cut tool: deleting a clip on the ruler removes that
 * span from the composition (both preview and export), rippling everything
 * after it earlier — rather than just muting/hiding it in place.
 */
export function applyCutRanges(totalDurationInFrames, excludedRanges = []) {
  const merged = excludedRanges
    .map((r) => ({
      start: Math.max(0, Math.min(r.start, totalDurationInFrames)),
      end:   Math.max(0, Math.min(r.end,   totalDurationInFrames)),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)
    .reduce((acc, r) => {
      const last = acc[acc.length - 1];
      if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
      else acc.push({ ...r });
      return acc;
    }, []);

  const keepRanges = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) keepRanges.push({ originalStart: cursor, originalEnd: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < totalDurationInFrames) {
    keepRanges.push({ originalStart: cursor, originalEnd: totalDurationInFrames });
  }

  let virtualCursor = 0;
  for (const kr of keepRanges) {
    kr.virtualStart = virtualCursor;
    virtualCursor += kr.originalEnd - kr.originalStart;
    kr.virtualEnd = virtualCursor;
  }

  return { keptDurationInFrames: virtualCursor, keepRanges };
}

/**
 * Maps a frame range in the *virtual* (post-cut) timeline back to one or
 * more ranges in the *original* timeline, using the keepRanges produced by
 * applyCutRanges. Needed when the user deletes a clip they selected on the
 * (already-cut) ruler — we need to know what original footage that
 * corresponds to so it can be added to the excluded-ranges list.
 */
export function mapVirtualRangeToOriginal(virtualStart, virtualEnd, keepRanges) {
  const ranges = [];
  for (const kr of keepRanges) {
    const start = Math.max(virtualStart, kr.virtualStart);
    const end   = Math.min(virtualEnd,   kr.virtualEnd);
    if (end > start) {
      ranges.push({
        start: kr.originalStart + (start - kr.virtualStart),
        end:   kr.originalStart + (end   - kr.virtualStart),
      });
    }
  }
  return ranges;
}

/**
 * Base duration calculator for the "Action Reel" composition — two
 * independent, already-baked-audio Seedance clips back to back, no
 * broll/intro/outro layers. Raw (no cuts) — the cuts-aware wrapper used
 * everywhere the actual Player/export duration matters is
 * calcActionReelDurationInFrames, exported from ActionReelComposition.jsx.
 */
export function calcActionReelBaseDurationInFrames({
  part1Duration = 15,
  part2Duration = 15,
  fps           = 30,
} = {}) {
  return Math.ceil((part1Duration + part2Duration) * fps);
}
