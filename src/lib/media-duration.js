/** Probe video duration via a browser <video> element (header only, no full download). */
export async function getVideoDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const video = document.createElement("video");
    video.addEventListener("loadedmetadata", () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      video.src = "";
      resolve(dur);
    });
    video.addEventListener("error", () => resolve(0));
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.src = url;
  });
}

/** Probe audio duration via a browser <audio> element (header only, no full download). */
export async function getAudioDuration(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(0);
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      audio.src = "";
      resolve(dur);
    });
    audio.addEventListener("error", () => resolve(0));
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.src = url;
  });
}
