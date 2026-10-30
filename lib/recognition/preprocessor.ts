/**
 * Math Engine Image Preprocessing Web Worker (FR-PP-01, FR-PP-02, FR-PP-03, FR-PP-04, FR-PP-05, FR-PP-06)
 * Runs off the main thread:
 * 1. Downscales image (max 1600px)
 * 2. Grayscale & Contrast enhancement
 * 3. Otsu binarization
 * 4. Deskew detection
 */

export interface PreprocessRequest {
  imageData: ImageData;
  options?: {
    binarize?: boolean;
    deskew?: boolean;
    contrast?: number;
  };
}

export interface PreprocessResponse {
  processedImageData: ImageData;
  skewAngle?: number;
}

/**
 * Calculates Otsu threshold on grayscale 8-bit image data
 */
export function computeOtsuThreshold(gray: Uint8Array): number {
  const histogram = new Int32Array(256);
  const total = gray.length;

  for (let i = 0; i < total; i++) {
    histogram[gray[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const betweenVariance = wB * wF * (mB - mF) * (mB - mF);
    if (betweenVariance > maxVariance) {
      maxVariance = betweenVariance;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Fast Radian Hough / Variance deskew angle estimator up to 15 degrees
 */
export function estimateSkewAngle(gray: Uint8Array, width: number, height: number): number {
  // Sample middle 50% rows to quickly estimate projection profile variances
  const sampleStep = Math.max(1, Math.floor(height / 100));
  let bestAngle = 0;
  let maxVariance = 0;

  for (let deg = -15; deg <= 15; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    const tan = Math.tan(rad);
    const projection = new Float32Array(height);

    for (let y = 0; y < height; y += sampleStep) {
      let rowSum = 0;
      for (let x = 0; x < width; x += 4) {
        const shiftedY = Math.round(y + x * tan);
        if (shiftedY >= 0 && shiftedY < height) {
          rowSum += 255 - gray[shiftedY * width + x]; // dark pixel count
        }
      }
      projection[y] = rowSum;
    }

    // Measure variance of row projection
    let mean = 0;
    let count = 0;
    for (let y = 0; y < height; y += sampleStep) {
      mean += projection[y];
      count++;
    }
    mean /= count || 1;

    let variance = 0;
    for (let y = 0; y < height; y += sampleStep) {
      variance += (projection[y] - mean) ** 2;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = deg;
    }
  }

  return bestAngle;
}

/**
 * Executes standard image cleanup: Grayscale, Contrast Normalization, and Otsu Binarization
 */
export function preprocessCanvasPixels(imageData: ImageData, binarize = true): { data: ImageData; skewAngle: number } {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);

  // 1. Convert to grayscale & find min/max for contrast normalization
  let min = 255;
  let max = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Luminance standard: 0.299 R + 0.587 G + 0.114 B
    const val = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    gray[j] = val;
    if (val < min) min = val;
    if (val > max) max = val;
  }

  // 2. Contrast stretch
  const range = max - min || 1;
  for (let j = 0; j < gray.length; j++) {
    gray[j] = Math.min(255, Math.max(0, Math.round(((gray[j] - min) / range) * 255)));
  }

  // 3. Estimate skew
  const skewAngle = estimateSkewAngle(gray, width, height);

  // 4. Otsu binarization
  if (binarize) {
    const threshold = computeOtsuThreshold(gray);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const b = gray[j] >= threshold ? 255 : 0;
      data[i] = b;
      data[i + 1] = b;
      data[i + 2] = b;
      // keep alpha
    }
  } else {
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const g = gray[j];
      data[i] = g;
      data[i + 1] = g;
      data[i + 2] = g;
    }
  }

  return { data: imageData, skewAngle };
}
