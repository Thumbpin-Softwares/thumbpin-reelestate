// src/modules/ai-walkthrough/helpers/compressImage.js

export default async function compressImage(file, maxDimension = 1200, quality = 0.7) {
  // If file is null or undefined
  if (!file) {
    console.error('compressImage: No file provided');
    throw new Error('No file provided to compressImage');
  }
  
  // If file is already a Blob or File with arrayBuffer method
  if (file instanceof File || file instanceof Blob) {
    // Proceed with normal compression
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
  }
  
  // If file is a string (URL or data URL)
  if (typeof file === 'string') {
    console.log('compressImage: Converting string to blob');
    try {
      const response = await fetch(file);
      const blob = await response.blob();
      const fileName = 'image.jpg';
      const fileObj = new File([blob], fileName, { type: blob.type });
      return await compressImage(fileObj, maxDimension, quality);
    } catch (err) {
      console.error('Failed to convert string to blob:', err);
      throw new Error('Invalid image URL provided');
    }
  }
  
  // If file is an object with url property (like from IndexedDB)
  if (file.url && typeof file.url === 'string') {
    console.log('compressImage: Converting object with url to blob');
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const fileName = file.name || 'image.jpg';
      const fileObj = new File([blob], fileName, { type: blob.type });
      return await compressImage(fileObj, maxDimension, quality);
    } catch (err) {
      console.error('Failed to convert object to blob:', err);
      throw new Error('Invalid image object provided');
    }
  }
  
  // If file is a dataURL
  if (typeof file === 'string' && file.startsWith('data:image')) {
    console.log('compressImage: Converting dataURL to blob');
    try {
      const blob = dataURLToBlob(file);
      const fileName = 'image.jpg';
      const fileObj = new File([blob], fileName, { type: blob.type });
      return await compressImage(fileObj, maxDimension, quality);
    } catch (err) {
      console.error('Failed to convert dataURL to blob:', err);
      throw new Error('Invalid dataURL provided');
    }
  }
  
  // If we get here, the file type is unsupported
  console.error('compressImage: Unsupported file type:', typeof file, file);
  throw new Error(`Unsupported file type: ${typeof file}`);
}

// Helper function to convert dataURL to Blob
function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}