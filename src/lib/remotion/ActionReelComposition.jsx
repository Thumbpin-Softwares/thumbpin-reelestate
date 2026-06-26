import { AbsoluteFill, Sequence, OffthreadVideo, useVideoConfig } from "remotion";

/**
 * Props:
 *   part1VideoUrl, part2VideoUrl — Seedance clips, each with baked lip-synced
 *     audio already (generate_audio: true + audio_urls at generation time), so
 *     no separate <Audio> overlay is needed here, unlike SeedanceReelComposition.
 *   part1Duration, part2Duration — seconds, probed client-side after generation.
 *
 * Hard cut between the two — no crossfade — matches the fast-paced UGC aesthetic.
 */
export function ActionReelComposition({
  part1VideoUrl = "",
  part2VideoUrl = "",
  part1Duration = 15,
  part2Duration = 15,
}) {
  const { fps } = useVideoConfig();
  const part1Frames = Math.round(part1Duration * fps);
  const part2Frames = Math.round(part2Duration * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence from={0} durationInFrames={part1Frames}>
        <AbsoluteFill>
          <OffthreadVideo
            src={part1VideoUrl}
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={part1Frames} durationInFrames={part2Frames}>
        <AbsoluteFill>
          <OffthreadVideo
            src={part2VideoUrl}
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
}

export { calcActionReelDurationInFrames } from "./duration";
