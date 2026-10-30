/**
 * Math Engine Preprocessor - FR-PP-01 to FR-PP-03
 * Grayscale, contrast stretching, Otsu binarization, and ROI crop.
 * Prepares raw camera photo frames for accurate Tesseract recognition.
 */

export function preprocessCameraFrame(
  sourceCanvas: HTMLCanvasElement,
  roiRatio: { x: number; y: number; width: number; height: number }
): { croppedDataUrl: string; binarizedDataUrl: string } {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  // Calculate pixel bounds of ROI frame
  const cropX = Math.floor(roiRatio.x * srcW);
  const cropY = Math.floor(roiRatio.y * srcH);
  const cropW = Math.max(10, Math.floor(roiRatio.width * srcW));
  const cropH = Math.max(10, Math.floor(roiRatio.height * srcH));

  // 1. Create off-screen canvas for the cropped region
  // Scale up by 2x if crop resolution is small (Tesseract needs >= 32px character height)
  // Cap max dimension to 1600px per FR-PP-01 to avoid memory exhaustion on high-DPI canvases
  const scaleFactor = Math.max(1, Math.min(2.5, 600 / cropH));
  const rawTargetW = Math.round(cropW * scaleFactor);
  const rawTargetH = Math.round(cropH * scaleFactor);

  const maxDimension = 1600;
  const downscaleRatio = Math.max(rawTargetW, rawTargetH) > maxDimension ? maxDimension / Math.max(rawTargetW, rawTargetH) : 1;

  const targetW = Math.max(10, Math.round(rawTargetW * downscaleRatio));
  const targetH = Math.max(10, Math.round(rawTargetH * downscaleRatio));

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = targetW;
  cropCanvas.height = targetH;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) {
    return { croppedDataUrl: sourceCanvas.toDataURL(), binarizedDataUrl: sourceCanvas.toDataURL() };
  }

  // Draw scaled ROI crop with high image smoothing
  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = 'high';
  cropCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  const croppedDataUrl = cropCanvas.toDataURL('image/png');

  // 2. Grayscale & Contrast Stretched Binarization
  const imgData = cropCtx.getImageData(0, 0, targetW, targetH);
  const d = imgData.data;
  const numPixels = targetW * targetH;

  const grays = new Uint8Array(numPixels);
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    const pIdx = i / 4;
    grays[pIdx] = gray;
    if (gray < minLum) minLum = gray;
    if (gray > maxLum) maxLum = gray;
  }

  // Linear contrast stretching
  const lumRange = Math.max(1, maxLum - minLum);
  const stretched = new Uint8Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    stretched[i] = Math.round(((grays[i] - minLum) / lumRange) * 255);
  }

  // Histogram on contrast-stretched pixels
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < numPixels; i++) {
    histogram[stretched[i]]++;
  }

  // Otsu threshold on stretched image
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = numPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  // Background polarity: count pixels in the middle 80% vs border
  // For camera frames, background usually occupies > 60% of total area
  const countDark = stretched.reduce((acc, v) => (v < threshold ? acc + 1 : acc), 0);
  const countLight = numPixels - countDark;
  const isDarkBackground = countDark > countLight;

  // Render clean high-contrast black-on-white image into padded canvas
  const pad = 30;
  const paddedCanvas = document.createElement('canvas');
  paddedCanvas.width = targetW + pad * 2;
  paddedCanvas.height = targetH + pad * 2;
  const padCtx = paddedCanvas.getContext('2d');

  if (padCtx) {
    padCtx.fillStyle = '#FFFFFF';
    padCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);

    for (let i = 0; i < d.length; i += 4) {
      const pIdx = i / 4;
      const isInk = isDarkBackground ? stretched[pIdx] > threshold : stretched[pIdx] <= threshold;
      const val = isInk ? 0 : 255;
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
      d[i + 3] = 255;
    }

    cropCtx.putImageData(imgData, 0, 0);
    padCtx.drawImage(cropCanvas, pad, pad);
    const binarizedDataUrl = paddedCanvas.toDataURL('image/png');
    return { croppedDataUrl, binarizedDataUrl };
  }

  for (let i = 0; i < d.length; i += 4) {
    const pIdx = i / 4;
    const isInk = isDarkBackground ? grays[pIdx] > threshold : grays[pIdx] <= threshold;
    const val = isInk ? 0 : 255;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
    d[i + 3] = 255;
  }

  cropCtx.putImageData(imgData, 0, 0);
  const binarizedDataUrl = cropCanvas.toDataURL('image/png');

  return { croppedDataUrl, binarizedDataUrl };
}
