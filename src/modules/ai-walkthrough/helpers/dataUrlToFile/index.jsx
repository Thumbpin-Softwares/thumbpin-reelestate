// src/modules/ai-walkthrough/helpers/dataUrlToFile.js

export default function dataUrlToFile(dataUrl, filename) {
  if (!dataUrl) {
    throw new Error('No dataUrl provided');
  }
  
  try {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (err) {
    console.error('Error converting dataUrl to file:', err);
    // Fallback: try to fetch as URL
    return fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => new File([blob], filename, { type: blob.type }));
  }
}