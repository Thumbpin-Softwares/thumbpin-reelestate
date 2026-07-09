// Audio (both the Part 2 voiceover and background music) uses the classic,
// stable `remotion` Audio (ffmpeg-based extraction) rather than
// @remotion/media's — that package is explicitly "Experimental
// WebCodecs-based media tags" and would silently drop a track on
// codec/format edge cases instead of erroring, which is why background
// music in particular looked like it "sometimes" didn't apply.
import {
  AbsoluteFill,
  Img,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  // eslint-disable-next-line remotion/no-legacy-video
  Video,
  getRemotionEnvironment,
  OffthreadVideo,
  Audio,
} from "remotion";
import { IntroAnimation } from "./IntroAnimation";
import { OutroAnimation } from "./OutroAnimation";
import { getOverlayFontCss, hexToRgba } from "./overlay-fonts";
import { calcDurationInFrames, applyCutRanges } from "./duration";

/**
 * A user-placed text or image overlay that stays on screen for the whole
 * reel. Position is stored as a percent (x, y = center point) so it's
 * resolution-independent between the editor's drag layer and this
 * composition. Shape: { id, type: "text"|"image", x, y, width, text,
 * fontSize, color, fontFamily, bgColor, bgOpacity, url }.
 */
function Overlay({ overlay }) {
  const style = {
    position: "absolute",
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
    width: `${overlay.width}%`,
    transform: "translate(-50%, -50%)",
  };

  if (overlay.type === "image") {
    return (
      <div style={style}>
        <Img src={overlay.url} style={{ width: "100%", display: "block" }} />
      </div>
    );
  }

  return (
    <div
      style={{
        ...style,
        boxSizing: "border-box",
        fontSize: overlay.fontSize || 48,
        color: overlay.color || "#ffffff",
        fontWeight: 700,
        textAlign: "center",
        fontFamily: getOverlayFontCss(overlay.fontFamily),
        whiteSpace: "pre-wrap",
        textShadow: "0 2px 10px rgba(0,0,0,0.55)",
        backgroundColor: hexToRgba(overlay.bgColor, overlay.bgOpacity),
        padding: overlay.bgOpacity ? "0.3em 0.5em" : 0,
        borderRadius: overlay.bgOpacity ? 12 : 0,
      }}
    >
      {overlay.text}
    </div>
  );
}

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
function ReelContent({
  avatarVideoUrl = "",
  brollClips     = [],
  ctaVideoUrl    = "",
  part2AudioUrl  = "",
  avatarDuration = 15,
  ctaDuration    = 10,
  ctaText        = "",
  // Intro/outro title cards are NOT baked into the generated reel by default —
  // they're optional, user-editable additions made on the edit page.
  showIntro      = false,
  showOutro      = false,
  introTitle     = "Luxury",
  introSubtitle  = "Living",
  introTagline   = "Where Every Detail Matters",
  outroBrandText = "thumbpin.ai",
  overlays       = [],
  musicUrl              = "",
  musicTrimStartSeconds = 0,
  musicVolume           = 0.25,
}) {
  const { fps } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const VideoComponent = isRendering ? OffthreadVideo : Video;

  const introFrames  = showIntro ? Math.round(INTRO_S * fps) : 0;
  const avatarFrames = Math.round(avatarDuration * fps);
  const ctaFrames    = Math.round(ctaDuration * fps);
  const outroFrames  = showOutro ? Math.round(OUTRO_S * fps) : 0;

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
      {/* 1 — Intro animation (luxury white screen) — optional, off by default */}
      {showIntro && (
        <Sequence from={introAt} durationInFrames={introFrames}>
          <IntroAnimation title={introTitle} subtitle={introSubtitle} tagline={introTagline} />
        </Sequence>
      )}

      {/* 2 — Avatar intro (Seedance-baked audio preserved) */}
      {avatarVideoUrl && (
        <Sequence from={avatarAt} durationInFrames={avatarFrames}>
          <FadeContent totalFrames={avatarFrames} fade={FADE} fadeIn fadeOut={false}>
            <AbsoluteFill>
              <VideoComponent
                src={avatarVideoUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                  <VideoComponent
                    src={clip.url}
                    playbackRate={clip.rate}
                    muted
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
              <VideoComponent
                src={ctaVideoUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </AbsoluteFill>
          </FadeContent>
        </Sequence>
      )}

      {/* 5 — Outro animation (luxury white screen + CTA text) — optional, off by default */}
      {showOutro && (
        <Sequence from={outroAt} durationInFrames={outroFrames}>
          <OutroAnimation ctaText={ctaText} brandText={outroBrandText} />
        </Sequence>
      )}

      {/* 6 — User text/image overlays — on top of everything, full duration.
          Array order is the stacking order: later entries render on top. */}
      {overlays.length > 0 && (
        <AbsoluteFill>
          {overlays.filter((overlay) => !overlay.hidden).map((overlay) => (
            <Overlay key={overlay.id} overlay={overlay} />
          ))}
        </AbsoluteFill>
      )}

      {/* 7 — Background music, trimmed to whichever section the user picked
          in the editor. Playback is naturally cut off at the composition's
          own duration, so no explicit trimAfter is needed. */}
      {musicUrl && (
        <Audio
          src={musicUrl}
          trimBefore={Math.round(musicTrimStartSeconds * fps)}
          volume={musicVolume}
        />
      )}
    </AbsoluteFill>
  );
}

function originalDurationFor(props) {
  return calcDurationInFrames({
    avatarDuration: props.avatarDuration,
    brollClips:     props.brollClips,
    ctaDuration:    props.ctaDuration,
    showIntro:      props.showIntro,
    showOutro:      props.showOutro,
  });
}

/**
 * Wraps ReelContent with support for the editor's Cut tool: `cutRanges` is a
 * list of { start, end } frame ranges (in the *original*, uncut timeline)
 * that the user deleted. Each surviving chunk is re-mounted as its own pair
 * of nested Sequences — the outer one places it at its new, rippled
 * position; the inner one re-bases time back to the original frame it
 * should render, via a negative `from` (Remotion shifts child frames by
 * `parentFrame - from`, so a negative `from` shifts them forward).
 *
 * The exact same wrapper renders both the live <Player> preview and the
 * server-side export, so what you cut in the editor is what gets rendered.
 */
export function SeedanceReelComposition({ cutRanges = [], ...rest }) {
  const totalOriginalFrames = originalDurationFor(rest);
  const { keepRanges } = applyCutRanges(totalOriginalFrames, cutRanges);

  if (keepRanges.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: "#000000" }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {keepRanges.map((kr, i) => (
        <Sequence key={i} from={kr.virtualStart} durationInFrames={kr.virtualEnd - kr.virtualStart}>
          <Sequence from={-kr.originalStart} durationInFrames={totalOriginalFrames - kr.originalStart}>
            <ReelContent {...rest} />
          </Sequence>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Total composition length after cuts — use this (not the raw calcDurationInFrames)
 * anywhere the actual Player/export duration is needed once cuts are in play. */
export function calcSeedanceReelDurationInFrames({ cutRanges = [], ...rest }) {
  const total = originalDurationFor(rest);
  const { keptDurationInFrames } = applyCutRanges(total, cutRanges);
  return Math.max(1, keptDurationInFrames);
}

export { calcDurationInFrames } from "./duration";
