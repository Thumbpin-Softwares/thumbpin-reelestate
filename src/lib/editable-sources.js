// Pipelines whose generated videos can be reopened in the unified Remotion
// editor at /dashboard/edit. Each entry maps the Asset's metadata.source to the
// render API and the "back to generator" path for that pipeline.
//
// compositionType selects which Remotion component/duration-calc the Editor
// (modules/edit/layout/editor) uses for preview + render props:
//   "seedance"    — avatarVideoUrl + brollClips + ctaVideoUrl + part2AudioUrl
//                   (SeedanceReelComposition) — no active producer since
//                   news-anchor was purged; kept in case a future pipeline
//                   needs this shape again, otherwise a purge candidate.
//   "action-reel" — part1VideoUrl + part2VideoUrl, two flat baked-audio clips
//                   (ActionReelComposition) — action-reel/comedy-reel/luxury-car-exit
//
// isFlatExport sources are already-rendered/flattened MP4s (a previous export)
// reopened as a single-clip "action-reel" composition (part1 only, no part2) —
// lets a user re-trim/re-cut/add music/captions to something they already
// exported, always starting from a fresh blank edit (never resumes the
// original session that produced the export — see buildCompositionFromAsset).
export const EDITABLE_SOURCES = {
  "luxury-car-exit": {
    compositionType: "action-reel",
    renderEndpoint: "/api/luxury-car-exit/render-remotion",
    generatorPath: "/dashboard/luxury-car-exit",
    downloadFilename: "luxury-car-exit.mp4",
  },
  // Back-compat: assets generated before the "seedance-reel" pipeline was
  // renamed to "luxury-car-exit" still have this old metadata.source value —
  // keep them editable by pointing at the same (moved) render endpoint.
  "seedance-reel": {
    compositionType: "action-reel",
    renderEndpoint: "/api/luxury-car-exit/render-remotion",
    generatorPath: "/dashboard/luxury-car-exit",
    downloadFilename: "seedance-reel.mp4",
  },
  "action-reel": {
    compositionType: "action-reel",
    renderEndpoint: "/api/action-reel/render-remotion",
    generatorPath: "/dashboard/action-reel",
    downloadFilename: "action-reel.mp4",
  },
  "comedy-reel": {
    compositionType: "action-reel",
    renderEndpoint: "/api/comedy-reel/render-remotion",
    generatorPath: "/dashboard/comedy-reel",
    downloadFilename: "comedy-reel.mp4",
  },
  // Flattened exports from each pipeline's render-remotion route — reopenable
  // as a single-clip composition, re-exported through the shared generic
  // endpoint below (which re-tags the new export as "video-export").
  "luxury-car-exit-export": {
    compositionType: "action-reel",
    isFlatExport: true,
    renderEndpoint: "/api/exports/render-remotion",
    generatorPath: "/dashboard/luxury-car-exit",
    downloadFilename: "luxury-car-exit.mp4",
  },
  "action-reel-export": {
    compositionType: "action-reel",
    isFlatExport: true,
    renderEndpoint: "/api/exports/render-remotion",
    generatorPath: "/dashboard/action-reel",
    downloadFilename: "action-reel.mp4",
  },
  "comedy-reel-export": {
    compositionType: "action-reel",
    isFlatExport: true,
    renderEndpoint: "/api/exports/render-remotion",
    generatorPath: "/dashboard/comedy-reel",
    downloadFilename: "comedy-reel.mp4",
  },
  // model-tour (the property-commercial template's Residential flow) is a
  // single flat video straight out of fal's omni-hometour-pipeline — no
  // part1/part2 split, so it reopens the same way a flattened export does:
  // a single-clip "action-reel" composition (part1 only).
  "model-tour": {
    compositionType: "action-reel",
    isFlatExport: true,
    renderEndpoint: "/api/exports/render-remotion",
    generatorPath: "/dashboard/template/property-commercial",
    downloadFilename: "home-tour.mp4",
  },
  // What re-exporting any of the above (or re-exporting a re-export) gets
  // tagged as — still editable again the same way, so a user can keep
  // trimming/re-cutting/re-captioning an export indefinitely.
  "video-export": {
    compositionType: "action-reel",
    isFlatExport: true,
    renderEndpoint: "/api/exports/render-remotion",
    generatorPath: null,
    downloadFilename: "video.mp4",
  },
};

export const COMPOSITION_STORAGE_KEY = "video_composition";
export const EDIT_PATH = "/dashboard/edit";

/** Probe video duration via browser <video> element (header only, no full download). */
export async function getVideoDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const video = document.createElement("video");
    video.addEventListener("loadedmetadata", () => {
      resolve(isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
    });
    video.addEventListener("error", () => resolve(0));
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.src = url;
  });
}

/** Probe audio duration via browser <audio> element (header only, no full download). */
export async function getAudioDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      resolve(isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0);
    });
    audio.addEventListener("error", () => resolve(0));
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.src = url;
  });
}

/** Build Remotion composition props from a saved Asset's metadata (best-effort —
 * brollClips timing/ctaText are reconstructed via duration probing, not the
 * exact values used at generation time). */
export async function buildCompositionFromAsset(asset) {
  const source = asset.metadata?.source;
  const sourceConfig = EDITABLE_SOURCES[source];
  if (!sourceConfig) return null;

  if (sourceConfig.isFlatExport) {
    const part1Dur = await getVideoDuration(asset.url);
    return {
      source,
      assetId: asset.id || "",
      name: asset.name || "",
      part1VideoUrl: asset.url || "",
      part2VideoUrl: "",
      part1Duration: part1Dur > 0 ? part1Dur : 15,
      part2Duration: 0,
    };
  }

  if (sourceConfig.compositionType === "action-reel") {
    const { part1VideoUrl, part2VideoUrl } = asset.metadata;
    const [part1Dur, part2Dur] = await Promise.all([
      getVideoDuration(part1VideoUrl),
      getVideoDuration(part2VideoUrl),
    ]);

    return {
      source,
      assetId: asset.id || "",
      name: asset.name || "",
      part1VideoUrl: part1VideoUrl || "",
      part2VideoUrl: part2VideoUrl || "",
      part1Duration: part1Dur > 0 ? part1Dur : 15,
      part2Duration: part2Dur > 0 ? part2Dur : 15,
    };
  }

  const { avatarVideoUrl, walkthroughVideoUrl, ctaVideoUrl, part2AudioUrl } = asset.metadata;

  const [avatarDur, walkthroughDur, ctaDur, part2AudioDur] = await Promise.all([
    getVideoDuration(avatarVideoUrl),
    getVideoDuration(walkthroughVideoUrl),
    getVideoDuration(ctaVideoUrl),
    getAudioDuration(part2AudioUrl),
  ]);

  const { clampBrollClips } = await import("@/lib/remotion/duration");

  const avatarDuration = avatarDur > 0 ? avatarDur : 15;
  const ctaDuration = ctaDur > 0 ? ctaDur : 10;
  const videoDuration = walkthroughDur > 0 ? walkthroughDur : 12;
  const segmentDuration = part2AudioDur > 0 ? part2AudioDur : videoDuration;

  const rawBrollClips = walkthroughVideoUrl
    ? [{ url: walkthroughVideoUrl, videoDuration, segmentDuration }]
    : [];
  const brollClips = clampBrollClips({ avatarDuration, brollClips: rawBrollClips, ctaDuration });

  return {
    source,
    assetId: asset.id || "",
    name: asset.name || "",
    avatarVideoUrl: avatarVideoUrl || "",
    brollClips,
    ctaVideoUrl: ctaVideoUrl || "",
    part2AudioUrl: part2AudioUrl || "",
    avatarDuration,
    ctaDuration,
    ctaText: "",
  };
}
