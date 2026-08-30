/* ─────────────────────────────────────────────
   OCR Engine — Tesseract.js wrapper
   ───────────────────────────────────────────── */
import { createWorker } from 'tesseract.js';

/**
 * Perform OCR on an image using Tesseract.js.
 * @param {string} imageDataUrl – base64 data URL or blob URL of the image
 * @param {function} onProgress – callback({ step, label, progress })
 * @returns {Promise<{ text: string, confidence: number, words: Array }>}
 */
export async function performOCR(imageDataUrl, onProgress = () => {}) {
  let worker = null;

  try {
    onProgress({ step: 0, label: 'Initializing OCR engine…', progress: 0 });

    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress({
            step: 1,
            label: 'Detecting text…',
            progress: Math.round(m.progress * 100),
          });
        }
      },
    });

    onProgress({ step: 1, label: 'Detecting text…', progress: 0 });

    const result = await worker.recognize(imageDataUrl);

    const text = result.data.text || '';
    const confidence = result.data.confidence || 0;
    const words = (result.data.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox, // { x0, y0, x1, y1 }
    }));

    onProgress({ step: 2, label: 'Text detection complete', progress: 100 });

    return { text, confidence, words };
  } catch (error) {
    console.error('OCR Engine Error:', error);
    throw new Error(
      'OCR analysis failed. Please try a clearer image or use Demo Mode.'
    );
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {
        /* ignore termination errors */
      }
    }
  }
}

/**
 * Quick quality check on the OCR result.
 */
export function assessImageQuality(ocrResult) {
  const { text, confidence } = ocrResult;

  if (!text || text.trim().length < 10) {
    return {
      quality: 'poor',
      message: 'No readable text detected. Please capture a clearer image of the product label.',
      usable: false,
    };
  }

  if (confidence < 30) {
    return {
      quality: 'poor',
      message: 'Image quality is too low. Please capture the label again with better lighting.',
      usable: false,
    };
  }

  if (confidence < 55) {
    return {
      quality: 'fair',
      message: 'Some text is difficult to read. Results may have lower accuracy.',
      usable: true,
    };
  }

  return {
    quality: 'good',
    message: 'Image quality is suitable for analysis.',
    usable: true,
  };
}
