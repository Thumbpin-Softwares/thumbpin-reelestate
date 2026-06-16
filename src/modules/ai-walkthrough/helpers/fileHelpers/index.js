export const dataURLToBlob = (dataURL) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export const dataUrlToFile = (dataUrl, filename) => {
  const blob = dataURLToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
};

export const ensureFileObject = async (input) => {
  if (!input) return null;
  
  if (input instanceof File) return input;
  
  if (Array.isArray(input)) {
    return Promise.all(input.map(item => ensureFileObject(item)));
  }
  
  if (typeof input === 'string') {
    if (input.startsWith('data:')) {
      return dataUrlToFile(input, 'image.png');
    }
    try {
      const response = await fetch(input);
      const blob = await response.blob();
      return new File([blob], 'image.jpg', { type: blob.type });
    } catch (err) {
      console.error('Failed to fetch URL:', err);
      return null;
    }
  }
  
  if (input.url && typeof input.url === 'string') {
    return ensureFileObject(input.url);
  }
  
  return input;
};

export const compressImage = async (file, maxDimension = 1200, quality = 0.7) => {
  if (!file) return null;
  
  // If we're on the server, we can't use canvas, but these helpers are used in the client
  if (typeof window === 'undefined') return file;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxDimension) { 
              height *= maxDimension / width; 
              width = maxDimension; 
            }
          } else {
            if (height > maxDimension) { 
              width *= maxDimension / height; 
              height = maxDimension; 
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              resolve(new File([blob], file.name || 'image.jpg', { type: "image/jpeg", lastModified: Date.now() }));
            },
            "image/jpeg",
            quality
          );
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

export const safeLocalStorage = {
  getItem: (key) => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        if (error?.name === 'QuotaExceededError' || String(error?.message || '').toLowerCase().includes('quota')) {
          console.warn('[safeLocalStorage] Storage quota exceeded, skipping key:', key);
          return;
        }
        throw error;
      }
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};