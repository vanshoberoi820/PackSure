/* ─────────────────────────────────────────────
   Image Utilities — High-Fidelity Preprocessing & Normalization
   Multi-angle rotation, adaptive contrast & candidate generation
   ───────────────────────────────────────────── */

export function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function resizeImage(dataUrl, maxWidth = 1800, maxHeight = 1800, quality = 0.95) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function rotateImage(dataUrl, degrees) {
  if (!degrees || degrees % 360 === 0) return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const rad = (degrees * Math.PI) / 180;
      const is90or270 = Math.abs(degrees % 180) === 90;
      const w = is90or270 ? img.height : img.width;
      const h = is90or270 ? img.width : img.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Crop center Region of Interest (ROI) where the package/label is held and upscale 2x.
 * Greatly improves OCR accuracy on fine label text (MRP, Expiry, Mfg Date, Batch).
 */
export function cropCenterROI(dataUrl, scale = 2.0) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      // Focus on central 65% width and 75% height
      const cropW = Math.round(width * 0.65);
      const cropH = Math.round(height * 0.75);
      const cropX = Math.round((width - cropW) / 2);
      const cropY = Math.round((height - cropH) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1800, Math.round(cropW * scale));
      canvas.height = Math.min(1800, Math.round(cropH * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}


export function preprocessImage(dataUrl, contrastBoost = 1.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const adjusted = Math.min(255, Math.max(0, ((gray - 128) * contrastBoost) + 128));

        data[i] = adjusted;
        data[i + 1] = adjusted;
        data[i + 2] = adjusted;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function binarizeImage(dataUrl, threshold = 135) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const val = gray > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function calculateImageSharpness(canvas) {
  try {
    const { width, height } = canvas;
    const sampleW = Math.min(width, 320);
    const sampleH = Math.min(height, 240);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sampleW;
    tempCanvas.height = sampleH;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(canvas, 0, 0, sampleW, sampleH);

    const imgData = tempCtx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    let totalDiff = 0;
    let count = 0;

    for (let y = 1; y < sampleH - 1; y += 2) {
      for (let x = 1; x < sampleW - 1; x += 2) {
        const idx = (y * sampleW + x) * 4;
        const center = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;

        const left = data[idx - 4] * 0.299 + data[idx - 3] * 0.587 + data[idx - 2] * 0.114;
        const right = data[idx + 4] * 0.299 + data[idx + 5] * 0.587 + data[idx + 6] * 0.114;
        const up = data[idx - sampleW * 4] * 0.299 + data[idx - sampleW * 4 + 1] * 0.587 + data[idx - sampleW * 4 + 2] * 0.114;
        const down = data[idx + sampleW * 4] * 0.299 + data[idx + sampleW * 4 + 1] * 0.587 + data[idx + sampleW * 4 + 2] * 0.114;

        const lap = Math.abs(4 * center - left - right - up - down);
        totalDiff += lap;
        count++;
      }
    }

    return count > 0 ? totalDiff / count : 0;
  } catch (e) {
    return 0;
  }
}

export async function generateOCRCandidates(base64Image) {
  const highRes = await resizeImage(base64Image, 1800, 1800, 0.95);
  const enhanced = await preprocessImage(highRes, 1.5);
  const binarized = await binarizeImage(highRes, 130);

  return [
    { type: 'enhanced', dataUrl: enhanced },
    { type: 'original', dataUrl: highRes },
    { type: 'binarized', dataUrl: binarized },
  ];
}
