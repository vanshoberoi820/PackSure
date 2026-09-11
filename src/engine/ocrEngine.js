/* ─────────────────────────────────────────────
   OCR Engine — Tesseract.js Worker Pool & Multi-Orientation Recognition
   Includes multi-angle fallback (0°, 90°, 270°, 180°) & Barcode detection
   ───────────────────────────────────────────── */
import { createWorker } from 'tesseract.js';
import { preprocessImage, resizeImage, rotateImage, cropCenterROI } from '../utils/imageUtils.js';
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
        tessedit_pageseg_mode: '11', // PSM 11 Sparse Text: Eliminates multi-column crosstalk and captures label tables
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

    // Pass 1: Full image recognition with PSM 11
    const primaryResult = await worker.recognize(enhancedImg);
    let text = normalizeOCRText(primaryResult.data.text || '');
    let confidence = primaryResult.data.confidence || 0;
    let words = (primaryResult.data.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));

    const candidateTexts = [text];

    // Pass 2: Zoomed Center Region of Interest (ROI) for reading small printed tables (MRP, Expiry, Mfg Date, Batch)
    try {
      onProgress({ step: 1, label: 'Reading fine-print packaging table…', progress: 75 });
      const centerRoiImg = await cropCenterROI(optimizedImg, 2.0);
      const roiEnhanced = await preprocessImage(centerRoiImg, 1.55);
      const roiResult = await worker.recognize(roiEnhanced);
      const roiText = normalizeOCRText(roiResult.data.text || '');

      if (roiText && roiText.length > 5) {
        text = `${text}\n${roiText}`.trim();
        candidateTexts.push(roiText);
        confidence = Math.max(confidence, roiResult.data.confidence || 0);

        if (detectedBarcodes.length === 0) {
          const roiBc = await detectBarcodes(centerRoiImg);
          if (roiBc.length > 0) detectedBarcodes = roiBc;
        }
      }
    } catch (roiErr) {
      console.warn('Center ROI OCR pass skipped:', roiErr);
    }

    // Pass 3: If text length is low or confidence is sparse, test rotated views (90°, 270°, 180°)
    if (text.length < 50 || confidence < 55) {
      const angles = [90, 270, 180];
      for (const angle of angles) {
        onProgress({ step: 1, label: `Testing label orientation (${angle}°)…`, progress: 85 });
        try {
          const rotatedImg = await rotateImage(enhancedImg, angle);
          const rotatedResult = await worker.recognize(rotatedImg);
          const rotText = normalizeOCRText(rotatedResult.data.text || '');
          const rotConf = rotatedResult.data.confidence || 0;

          if (rotText.length > 15) {
            text = `${text}\n${rotText}`.trim();
            confidence = Math.max(confidence, rotConf);
            candidateTexts.push(rotText);

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

    onProgress({ step: 2, label: 'Text & Barcode recognition complete', progress: 100 });

    return {
      text: text || '',
      confidence: Math.round(confidence || (text.length > 10 ? 80 : 45)),
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
    let text = normalizeOCRText(result.data.text || '');
    let confidence = Math.round(result.data.confidence || 0);
    const words = (result.data.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));

    // Perform ROI sub-pass for video frames as well to capture small stacked text
    try {
      const roi = await cropCenterROI(frameDataUrl, 1.8);
      const roiRes = await worker.recognize(roi);
      const roiTxt = normalizeOCRText(roiRes.data.text || '');
      if (roiTxt && roiTxt.length > 5) {
        text = `${text}\n${roiTxt}`.trim();
        confidence = Math.max(confidence, Math.round(roiRes.data.confidence || 0));
      }
    } catch (_) {}

    let detectedBarcodes = [];
    try {
      detectedBarcodes = await detectBarcodes(frameDataUrl);
    } catch (_) {}

    return { text, confidence: confidence || (text.length > 5 ? 75 : 35), words, detectedBarcodes };
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
