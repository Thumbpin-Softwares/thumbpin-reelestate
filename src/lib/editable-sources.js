// Pipelines whose generated videos can be reopened in the unified Remotion
// editor at /app/edit. Each entry maps the Asset's metadata.source to the
// render API and the "back to generator" path for that pipeline.
export const EDITABLE_SOURCES = {
  "seedance-reel": {
    renderEndpoint: "/api/seedance-reel/render-remotion",
    generatorPath: "/app/seedance-reel",
    downloadFilename: "seedance-reel.mp4",
  },
  "news-anchor": {
    renderEndpoint: "/api/news-anchor/render-remotion",
    generatorPath: "/app/news-anchor",
    downloadFilename: "news-anchor.mp4",
  },
  "home-tour": {
    renderEndpoint: "/api/home-tour/render-remotion",
    generatorPath: "/app/home-tour",
    downloadFilename: "home-tour.mp4",
  },
};

export const COMPOSITION_STORAGE_KEY = "video_composition";
export const EDIT_PATH = "/app/edit";

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
  if (!EDITABLE_SOURCES[source]) return null;

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
