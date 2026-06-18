import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { OffthreadVideo } from "remotion";
import { Audio } from "@remotion/media";
import { IntroAnimation } from "./IntroAnimation";
import { OutroAnimation } from "./OutroAnimation";

const INTRO_S = 3;
const OUTRO_S = 3;

function FadeContent({ children, totalFrames, fade, fadeIn = true, fadeOut = true }) {
  const frame = useCurrentFrame();
  const inOpacity  = fadeIn  ? interpolate(frame, [0, fade], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) : 1;
  const outOpacity = fadeOut ? interpolate(frame, [totalFrames - fade, totalFrames], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) : 1;
  const opacity = Math.min(inOpacity, outOpacity);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/**
 * Props:
 *   avatarVideoUrl  — intro avatar MP4 (Seedance-baked audio)
 *   brollClips      — Array<{ url, videoDuration, segmentDuration }>
 *                     Each clip plays for segmentDuration seconds.
 *                     playbackRate = min(1, videoDuration / segmentDuration)
 *                     so clips shorter than the voiceover window are slowed down.
 *   ctaVideoUrl     — CTA avatar MP4 (Seedance-baked audio)
 *   part2AudioUrl   — ElevenLabs Part 2 TTS; plays over the entire B-roll section
 *   avatarDuration  — avatar video length in seconds (default 15)
 *   ctaDuration     — CTA video length in seconds (default 10)
 *   ctaText         — text shown in outro card
 */
export function SeedanceReelComposition({
  avatarVideoUrl = "",
  brollClips     = [],
  ctaVideoUrl    = "",
  part2AudioUrl  = "",
  avatarDuration = 15,
  ctaDuration    = 10,
  ctaText        = "",
}) {
  const { fps } = useVideoConfig();

  const introFrames  = Math.round(INTRO_S * fps);
  const avatarFrames = Math.round(avatarDuration * fps);
  const ctaFrames    = Math.round(ctaDuration * fps);
  const outroFrames  = Math.round(OUTRO_S * fps);

  // Pre-compute per-clip frame counts and playback rates.
  // rawRate = videoDuration / segmentDuration:
  //   < 1 → slow down (clip is shorter than its voiceover window)
  //   > 1 → speed up (clip is longer than its voiceover window)
  // Clamped to [0.5, 4] — the range @remotion/media guarantees.
  // loop handles the gap when rawRate < 0.5 (very long voiceover / very short clip).
  const clips = brollClips.map((clip) => {
    const segFrames = Math.round((clip.segmentDuration || 10) * fps);
    const rawRate =
      clip.videoDuration > 0 && clip.segmentDuration > 0
        ? clip.videoDuration / clip.segmentDuration
        : 1;
    const rate = Math.min(4, Math.max(0.5, rawRate));
    return { ...clip, segFrames, rate };
  });

  const totalBrollFrames = clips.reduce((s, c) => s + c.segFrames, 0);

  const FADE = Math.round(fps * 0.5);

  // Timeline offsets
  let at = 0;
  const introAt  = at; at += introFrames;
  const avatarAt = at; at += avatarFrames;
  const brollAt  = at; at += totalBrollFrames;
  const ctaAt    = at; at += ctaFrames;
  const outroAt  = at;

  // Clip-level offsets within the B-roll Sequence
  let clipCursor = 0;
  const clipOffsets = clips.map((clip) => {
    const offset = clipCursor;
    clipCursor += clip.segFrames;
    return offset;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* 1 — Intro animation (luxury white screen) */}
      <Sequence from={introAt} durationInFrames={introFrames}>
        <IntroAnimation />
      </Sequence>

      {/* 2 — Avatar intro (Seedance-baked audio preserved) */}
      {avatarVideoUrl && (
        <Sequence from={avatarAt} durationInFrames={avatarFrames}>
          <FadeContent totalFrames={avatarFrames} fade={FADE} fadeIn fadeOut={false}>
            <AbsoluteFill>
              <OffthreadVideo
                src={avatarVideoUrl}
                objectFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </AbsoluteFill>
          </FadeContent>
        </Sequence>
      )}

      {/* 3 — B-roll section: clips in sequence, Part 2 audio over all of them */}
      {clips.length > 0 && (
        <Sequence from={brollAt} durationInFrames={totalBrollFrames}>
          {part2AudioUrl && <Audio src={part2AudioUrl} />}

          {clips.map((clip, i) => (
            <Sequence
              key={clip.url || i}
              from={clipOffsets[i]}
              durationInFrames={clip.segFrames}
            >
              <FadeContent totalFrames={clip.segFrames} fade={FADE} fadeIn={false} fadeOut={false}>
                <AbsoluteFill>
                  <OffthreadVideo
                    src={clip.url}
                    playbackRate={clip.rate}
                    muted
                    objectFit="cover"
                    style={{ width: "100%", height: "100%" }}
                  />
                </AbsoluteFill>
              </FadeContent>
            </Sequence>
          ))}
        </Sequence>
      )}

      {/* 4 — CTA avatar (Seedance-baked audio preserved) */}
      {ctaVideoUrl && (
        <Sequence from={ctaAt} durationInFrames={ctaFrames}>
          <FadeContent totalFrames={ctaFrames} fade={FADE} fadeIn={false} fadeOut>
            <AbsoluteFill>
              <OffthreadVideo
                src={ctaVideoUrl}
                objectFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
            </AbsoluteFill>
          </FadeContent>
        </Sequence>
      )}

      {/* 5 — Outro animation (luxury white screen + CTA text) */}
      <Sequence from={outroAt} durationInFrames={outroFrames}>
        <OutroAnimation ctaText={ctaText} />
      </Sequence>
    </AbsoluteFill>
  );
}

export { calcDurationInFrames } from "./duration";
