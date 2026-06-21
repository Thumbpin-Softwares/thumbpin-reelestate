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
