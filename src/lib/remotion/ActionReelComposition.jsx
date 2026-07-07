import { AbsoluteFill, Img, Sequence, OffthreadVideo, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { getOverlayFontCss, hexToRgba } from "./overlay-fonts";
import { applyCutRanges, calcActionReelBaseDurationInFrames } from "./duration";

/** Same overlay shape/rendering as SeedanceReelComposition's — see that file
 * for the field reference: { id, type: "text"|"image", x, y, width, ... }. */
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

/**
 * Props:
 *   part1VideoUrl, part2VideoUrl — Seedance clips, each with baked lip-synced
 *     audio already (generate_audio: true + audio_urls at generation time), so
 *     no separate <Audio> overlay is needed for dialogue, unlike music below.
 *   part1Duration, part2Duration — seconds, probed client-side after generation.
 *   overlays, musicUrl/musicTrimStartSeconds/musicVolume — editor additions,
 *     same shape/behavior as SeedanceReelComposition.
 *
 * Hard cut between the two — no crossfade — matches the fast-paced UGC aesthetic.
 */
function ReelContent({
  part1VideoUrl = "",
  part2VideoUrl = "",
  part1Duration = 15,
  part2Duration = 15,
  overlays      = [],
  musicUrl              = "",
  musicTrimStartSeconds = 0,
  musicVolume           = 0.25,
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

      {/* User text/image overlays — on top of everything, full duration.
          Array order is the stacking order: later entries render on top. */}
      {overlays.length > 0 && (
        <AbsoluteFill>
          {overlays.filter((overlay) => !overlay.hidden).map((overlay) => (
            <Overlay key={overlay.id} overlay={overlay} />
          ))}
        </AbsoluteFill>
      )}

      {/* Background music, trimmed to whichever section the user picked in
          the editor. Playback is naturally cut off at the composition's own
          duration, so no explicit trimAfter is needed. */}
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
  return calcActionReelBaseDurationInFrames({
    part1Duration: props.part1Duration,
    part2Duration: props.part2Duration,
  });
}

/**
 * Wraps ReelContent with support for the editor's Cut tool — see
 * SeedanceReelComposition.jsx's identical wrapper for the full explanation of
 * how cutRanges (original-timeline frame ranges the user deleted) get
 * rippled into a shorter virtual timeline via nested Sequences.
 */
export function ActionReelComposition({ cutRanges = [], ...rest }) {
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

/** Total composition length after cuts — use this (not the raw
 * calcActionReelBaseDurationInFrames) anywhere the actual Player/export
 * duration is needed once cuts are in play. */
export function calcActionReelDurationInFrames({ cutRanges = [], ...rest }) {
  const total = originalDurationFor(rest);
  const { keptDurationInFrames } = applyCutRanges(total, cutRanges);
  return Math.max(1, keptDurationInFrames);
}
