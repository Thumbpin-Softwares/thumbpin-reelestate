import { Fragment } from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  interpolate,
  Easing,
  getRemotionEnvironment,
  // eslint-disable-next-line remotion/no-legacy-video
  Video,
  OffthreadVideo,
} from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { KEN_BURNS_MOTIONS, LUTS, getPresetById } from "./broll-presets";

const FPS = 30;

// Extra headroom scale so Ken Burns pans/zooms never reveal an empty edge —
// the image is rendered larger than the frame from the very first frame,
// then panned/zoomed within that upscaled canvas.
const BASE_SCALE = 1.15;
const ZOOM_RANGE = 0.15;
const PAN_RANGE = 4; // percent

const TRANSITION_PRESENTATIONS = {
  fade: () => fade(),
  slide: () => slide(),
  wipe: () => wipe(),
};

function clipSeconds(item, preset) {
  if (item.type === "video") return item.durationSeconds || preset.clipDurationSeconds;
  return preset.clipDurationSeconds;
}

/** Total composition length in frames — sum of clip lengths minus the
 * overlap each transition eats from between two consecutive clips. */
export function calcBrollDurationInFrames({ mediaItems = [], presetId, fps = FPS } = {}) {
  const preset = getPresetById(presetId);
  if (mediaItems.length === 0) return fps * 3;

  const transitionFrames = Math.round(preset.transition.durationSeconds * fps);
  const clipFrames = mediaItems.map((item) => Math.max(1, Math.round(clipSeconds(item, preset) * fps)));
  const total = clipFrames.reduce((s, f) => s + f, 0);
  const overlap = transitionFrames * Math.max(0, mediaItems.length - 1);
  return Math.max(fps, total - overlap);
}

function KenBurnsImage({ src, durationInFrames, motion }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  let scale = BASE_SCALE;
  let x = 0;
  let y = 0;

  switch (motion) {
    case "zoom-out":
      scale = BASE_SCALE + ZOOM_RANGE - progress * ZOOM_RANGE;
      break;
    case "pan-left":
      scale = BASE_SCALE + ZOOM_RANGE / 2;
      x = PAN_RANGE - progress * PAN_RANGE * 2;
      break;
    case "pan-up":
      scale = BASE_SCALE + ZOOM_RANGE / 2;
      y = PAN_RANGE - progress * PAN_RANGE * 2;
      break;
    case "zoom-in":
    default:
      scale = BASE_SCALE + progress * ZOOM_RANGE;
      break;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${x}%, ${y}%)`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
}

function VideoClip({ src }) {
  const { isRendering } = getRemotionEnvironment();
  const VideoComponent = isRendering ? OffthreadVideo : Video;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <VideoComponent src={src} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
}

function Letterbox() {
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "9%", background: "#000" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "9%", background: "#000" }} />
    </>
  );
}

function FilmGrain() {
  const frame = useCurrentFrame();
  const seed = frame % 5;
  return (
    <AbsoluteFill style={{ mixBlendMode: "overlay", opacity: 0.18, pointerEvents: "none" }}>
      <svg width="100%" height="100%">
        <filter id="broll-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#broll-grain)" />
      </svg>
    </AbsoluteFill>
  );
}

/**
 * BrollComposition — pure-media cinematic montage for the News Anchor
 * pipeline. No AI, no TTS: just the user's uploaded photos/videos, a Ken
 * Burns treatment on stills, transitions between clips, an optional color
 * grade / letterbox / grain "look", and a background music track.
 *
 * The exact same component is used by the live <Player> preview and the
 * server-side renderMedia() call, so preview always matches output.
 *
 * Props:
 *   mediaItems — Array<{ url, type: "image" | "video", durationSeconds? }>
 *                durationSeconds is only used for video clips (probed
 *                server-side via getVideoMetadata before render).
 *   presetId   — id into BROLL_PRESETS (./broll-presets.js)
 *   musicUrl   — optional override of preset.musicUrl
 */
export function BrollComposition({ mediaItems = [], presetId = "cinematic", musicUrl = "" }) {
  const preset = getPresetById(presetId);
  const transitionFrames = Math.round(preset.transition.durationSeconds * FPS);
  const presentation = (TRANSITION_PRESENTATIONS[preset.transition.type] || TRANSITION_PRESENTATIONS.fade)();
  const lutFilter = LUTS[preset.lut] || "";
  const music = musicUrl || preset.musicUrl;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ filter: lutFilter || undefined }}>
        <TransitionSeries>
          {mediaItems.map((item, i) => {
            const durationInFrames = Math.max(1, Math.round(clipSeconds(item, preset) * FPS));
            const motion = KEN_BURNS_MOTIONS[i % KEN_BURNS_MOTIONS.length];
            return (
              <Fragment key={item.url || i}>
                {i > 0 && (
                  <TransitionSeries.Transition
                    presentation={presentation}
                    timing={springTiming({
                      durationInFrames: transitionFrames,
                      config: { damping: 200 },
                    })}
                  />
                )}
                <TransitionSeries.Sequence durationInFrames={durationInFrames}>
                  {item.type === "video" ? (
                    <VideoClip src={item.url} />
                  ) : (
                    <KenBurnsImage src={item.url} durationInFrames={durationInFrames} motion={motion} />
                  )}
                </TransitionSeries.Sequence>
              </Fragment>
            );
          })}
        </TransitionSeries>
      </AbsoluteFill>

      {preset.letterbox && <Letterbox />}
      {preset.grain && <FilmGrain />}
      {music && <Audio src={music} />}
    </AbsoluteFill>
  );
}
