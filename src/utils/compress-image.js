/**
 * Resize + JPEG-compress an image File in the browser using Canvas.
 * Keeps aspect ratio; falls back to the original file on any error.
 */
export async function compressImage(file, maxPx = 900, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height / width) * maxPx);
          width = maxPx;
        } else {
          width = Math.round((width / height) * maxPx);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Convenience wrapper for Blobs fetched from a URL
 * (e.g. prebuilt avatar URLs fetched at runtime).
 */
export async function compressBlob(blob, maxPx = 900, quality = 0.72) {
  const file = new File([blob], "image.jpg", { type: blob.type || "image/jpeg" });
  return compressImage(file, maxPx, quality);
}
