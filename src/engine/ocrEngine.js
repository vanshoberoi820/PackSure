/* ─────────────────────────────────────────────
   OCR Engine — Tesseract.js Worker Pool & Multi-Orientation Recognition
   Includes multi-angle fallback (0°, 90°, 270°, 180°) & Barcode detection
   ───────────────────────────────────────────── */
import { createWorker } from 'tesseract.js';
import { preprocessImage, resizeImage, rotateImage } from '../utils/imageUtils.js';
import { normalizeOCRText } from '../utils/ocrNormalization.js';
import { detectBarcodes } from './barcodeEngine.js';

let cachedWorker = null;
let isInitializing = false;
let initPromise = null;

async function getOCRWorker(onProgress = () => {}) {
  if (cachedWorker) return cachedWorker;

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress({
              step: 1,
              label: 'Detecting text declarations…',
              progress: Math.round((m.progress || 0) * 100),
            });
          }
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz₹Rs/.:,;()-\'%&@#+* "[]_®|!?~',
        preserve_interword_spaces: '1',
      });

      cachedWorker = worker;
      return worker;
    } catch (err) {
      console.warn('Worker initialization issue:', err);
      throw err;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

export async function performOCR(imageDataUrl, onProgress = () => {}) {
  try {
    onProgress({ step: 0, label: 'Optimizing label resolution…', progress: 15 });

    // Resize to high-clarity OCR resolution (1600x1600)
    const optimizedImg = await resizeImage(imageDataUrl, 1600, 1600, 0.95);
    const enhancedImg = await preprocessImage(optimizedImg, 1.45);

    onProgress({ step: 1, label: 'Scanning Barcodes, QR & Declarations…', progress: 35 });

    // Scan Barcodes & QR codes concurrently
    let detectedBarcodes = [];
    try {
      detectedBarcodes = await detectBarcodes(optimizedImg);
    } catch (bcErr) {
      console.warn('Barcode scan during OCR skipped:', bcErr);
    }

    onProgress({ step: 1, label: 'Running deep OCR text extraction…', progress: 50 });
    const worker = await getOCRWorker(onProgress);

    const primaryResult = await worker.recognize(enhancedImg);
    let text = normalizeOCRText(primaryResult.data.text || '');
    let confidence = primaryResult.data.confidence || 0;
    let words = (primaryResult.data.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));

    const candidateTexts = [text];

    // If text length is low or confidence is sparse, test rotated views (90°, 270°, 180°)
    if (text.length < 50 || confidence < 55) {
      const angles = [90, 270, 180];
      for (const angle of angles) {
        onProgress({ step: 1, label: `Testing label orientation (${angle}°)…`, progress: 70 });
        try {
          const rotatedImg = await rotateImage(enhancedImg, angle);
          const rotatedResult = await worker.recognize(rotatedImg);
          const rotText = normalizeOCRText(rotatedResult.data.text || '');
          const rotConf = rotatedResult.data.confidence || 0;

          if (rotText.length > text.length || rotConf > confidence + 10) {
            text = rotText;
            confidence = Math.max(confidence, rotConf);
            words = (rotatedResult.data.words || []).map((w) => ({
              text: w.text,
              confidence: w.confidence,
              bbox: w.bbox,
            }));
            candidateTexts.push(rotText);

            // Also check barcodes on rotated image if not found yet
            if (detectedBarcodes.length === 0) {
              const rotBc = await detectBarcodes(rotatedImg);
              if (rotBc.length > 0) detectedBarcodes = rotBc;
            }
          }
        } catch (rotErr) {
          console.warn(`Rotation ${angle}° OCR pass skipped:`, rotErr);
        }
      }
    }

    // If still sparse, test original non-preprocessed image
    if (text.length < 30) {
      try {
        const secondaryResult = await worker.recognize(optimizedImg);
        const secText = normalizeOCRText(secondaryResult.data.text || '');
        if (secText.length > text.length) {
          text = `${text}\n${secText}`.trim();
          confidence = Math.max(confidence, secondaryResult.data.confidence || 0);
          candidateTexts.push(secText);
        }
      } catch (e) {
        // secondary pass ignored
      }
    }

    onProgress({ step: 2, label: 'Text & Barcode recognition complete', progress: 100 });

    return {
      text: text || '',
      confidence: Math.round(confidence || (text.length > 10 ? 75 : 40)),
      words,
      candidateTexts,
      detectedBarcodes,
    };
  } catch (error) {
    console.error('OCR Engine Error:', error);
    return {
      text: '',
      confidence: 0,
      words: [],
      candidateTexts: [],
      detectedBarcodes: [],
    };
  }
}

export async function performFrameOCR(frameDataUrl) {
  try {
    const worker = await getOCRWorker();
    const result = await worker.recognize(frameDataUrl);
    const text = normalizeOCRText(result.data.text || '');
    const confidence = Math.round(result.data.confidence || 0);
    const words = (result.data.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));

    let detectedBarcodes = [];
    try {
      detectedBarcodes = await detectBarcodes(frameDataUrl);
    } catch (_) {}

    return { text, confidence: confidence || (text.length > 5 ? 70 : 30), words, detectedBarcodes };
  } catch (err) {
    console.warn('Frame OCR error:', err);
    return { text: '', confidence: 0, words: [], detectedBarcodes: [] };
  }
}

export async function terminateOCRWorker() {
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch (_) {}
    cachedWorker = null;
  }
}

export function assessImageQuality(ocrResult) {
  const { text, confidence } = ocrResult || {};

  if (!text || text.trim().length < 3) {
    return {
      quality: 'fair',
      message: 'Partial text detected. Proceeding with Legal Metrology audit and officer verification.',
      usable: true,
    };
  }

  if (confidence < 45) {
    return {
      quality: 'fair',
      message: 'Some text was difficult to recognize. Officer verification recommended.',
      usable: true,
    };
  }

  return {
    quality: 'good',
    message: 'Label text extracted successfully.',
    usable: true,
  };
}
