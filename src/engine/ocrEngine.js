/* ─────────────────────────────────────────────
   OCR Engine — Tesseract.js Worker Pool & Multi-Candidate Recognition
   ───────────────────────────────────────────── */
import { createWorker } from 'tesseract.js';
import { generateOCRCandidates, preprocessImage } from '../utils/imageUtils';
import { normalizeOCRText } from '../utils/ocrNormalization';

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
              label: 'Detecting text…',
              progress: Math.round(m.progress * 100),
            });
          }
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz₹/.:,;()-\'%&@#+* "[]',
        preserve_interword_spaces: '1',
      });

      cachedWorker = worker;
      return worker;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

export async function performOCR(imageDataUrl, onProgress = () => {}) {
  try {
    onProgress({ step: 0, label: 'Enhancing label clarity…', progress: 15 });

    const enhancedImg = await preprocessImage(imageDataUrl, 1.6);
    const worker = await getOCRWorker(onProgress);

    onProgress({ step: 1, label: 'Running deep text extraction…', progress: 40 });
    const primaryResult = await worker.recognize(enhancedImg);

    let text = normalizeOCRText(primaryResult.data.text || '');
    let confidence = primaryResult.data.confidence || 0;
    const words = (primaryResult.data.words || []).map((w) => ({
      text: w.text,
      confidence: w.confidence,
      bbox: w.bbox,
    }));

    const candidateTexts = [text];

    if (text.length < 50) {
      onProgress({ step: 1, label: 'Refining secondary text pass…', progress: 70 });
      try {
        const secondaryResult = await worker.recognize(imageDataUrl);
        const secondaryText = normalizeOCRText(secondaryResult.data.text || '');
        if (secondaryText.length > text.length) {
          text = `${text}\n${secondaryText}`.trim();
          confidence = Math.max(confidence, secondaryResult.data.confidence || 0);
          candidateTexts.push(secondaryText);
        }
      } catch (e) {
        console.warn('Secondary OCR pass skipped:', e);
      }
    }

    onProgress({ step: 2, label: 'Text recognition complete', progress: 100 });

    return {
      text,
      confidence: Math.round(confidence),
      words,
      candidateTexts,
    };
  } catch (error) {
    console.error('OCR Engine Error:', error);
    throw new Error(
      'OCR analysis encountered an issue. Please try a clearer image or use Demo Mode.'
    );
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

    return { text, confidence, words };
  } catch (err) {
    console.warn('Frame OCR error:', err);
    return { text: '', confidence: 0, words: [] };
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
  const { text, confidence } = ocrResult;

  if (!text || text.trim().length < 5) {
    return {
      quality: 'poor',
      message: 'No readable text detected. Please hold camera closer to the label.',
      usable: false,
    };
  }

  if (confidence < 25 && text.trim().length < 15) {
    return {
      quality: 'poor',
      message: 'Image is too blurry or low contrast. Please capture again with steady focus.',
      usable: false,
    };
  }

  if (confidence < 50) {
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
