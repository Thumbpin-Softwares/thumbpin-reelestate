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

export const compressImage = async (file) => {
  // Your compression logic here
  return file;
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
      localStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  }
};