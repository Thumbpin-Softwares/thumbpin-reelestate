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
} = {}) {
  const brollSeconds = brollClips
    ? brollClips.reduce((s, c) => s + (c.segmentDuration || 0), 0)
    : walkthroughAudioDuration;

  return Math.ceil((3 + avatarDuration + brollSeconds + ctaDuration + 3) * fps);
}
