/* ─────────────────────────────────────────────
   Barcode & QR Code Detection Engine
   Dual-layer scanning: Native BarcodeDetector + @zxing/library fallback
   Includes GS1 Country Prefix resolution & EAN Checksum Validation
   ───────────────────────────────────────────── */
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';

// GS1 Country Code Prefixes
const GS1_COUNTRY_PREFIXES = [
  { prefix: [890], country: 'India', flag: '🇮🇳' },
  { prefix: [0, 19], range: true, country: 'United States & Canada', flag: '🇺🇸' },
  { prefix: [30, 37], range: true, country: 'France', flag: '🇫🇷' },
  { prefix: [400, 440], range: true, country: 'Germany', flag: '🇩🇪' },
  { prefix: [450, 459], range: true, country: 'Japan', flag: '🇯🇵' },
  { prefix: [490, 499], range: true, country: 'Japan', flag: '🇯🇵' },
  { prefix: [500, 509], range: true, country: 'United Kingdom', flag: '🇬🇧' },
  { prefix: [540, 549], range: true, country: 'Belgium & Luxembourg', flag: '🇧🇪' },
  { prefix: [690, 699], range: true, country: 'China', flag: '🇨🇳' },
  { prefix: [730, 739], range: true, country: 'Sweden', flag: '🇸🇪' },
  { prefix: [760, 769], range: true, country: 'Switzerland', flag: '🇨🇭' },
  { prefix: [800, 839], range: true, country: 'Italy', flag: '🇮🇹' },
  { prefix: [840, 849], range: true, country: 'Spain', flag: '🇪🇸' },
  { prefix: [870, 879], range: true, country: 'Netherlands', flag: '🇳🇱' },
  { prefix: [880], country: 'South Korea', flag: '🇰🇷' },
  { prefix: [885], country: 'Thailand', flag: '🇹🇭' },
  { prefix: [888], country: 'Singapore', flag: '🇸🇬' },
  { prefix: [893], country: 'Vietnam', flag: '🇻🇳' },
  { prefix: [896], country: 'Pakistan', flag: '🇵🇰' },
  { prefix: [899], country: 'Indonesia', flag: '🇮🇩' },
  { prefix: [930, 939], range: true, country: 'Australia', flag: '🇦🇺' },
  { prefix: [940, 949], range: true, country: 'New Zealand', flag: '🇳🇿' },
];

/**
 * Resolve country from barcode digits using GS1 prefix tables
 */
export function getCountryFromGS1Barcode(barcodeStr) {
  if (!barcodeStr || typeof barcodeStr !== 'string') return null;
  const digits = barcodeStr.replace(/\D/g, '');
  if (digits.length < 3) return null;

  const prefix3 = parseInt(digits.substring(0, 3), 10);
  const prefix2 = parseInt(digits.substring(0, 2), 10);

  for (const item of GS1_COUNTRY_PREFIXES) {
    if (item.range) {
      const min = item.prefix[0];
      const max = item.prefix[1];
      if ((digits.length >= 2 && prefix2 >= min && prefix2 <= max) ||
          (digits.length >= 3 && prefix3 >= min && prefix3 <= max)) {
        return { country: item.country, flag: item.flag, prefix: item.prefix };
      }
    } else {
      if (item.prefix.includes(prefix3) || item.prefix.includes(prefix2)) {
        return { country: item.country, flag: item.flag, prefix: item.prefix[0] };
      }
    }
  }

  return null;
}

/**
 * Validate EAN-13 / UPC-A Checksum
 */
export function validateEANChecksum(barcodeStr) {
  if (!barcodeStr) return false;
  const digits = barcodeStr.replace(/\D/g, '');
  if (digits.length !== 13 && digits.length !== 8 && digits.length !== 12) return false;

  const len = digits.length;
  const checkDigit = parseInt(digits[len - 1], 10);
  let sum = 0;

  for (let i = 0; i < len - 1; i++) {
    const d = parseInt(digits[i], 10);
    if (len === 13) {
      sum += (i % 2 === 0) ? d * 1 : d * 3;
    } else if (len === 12) {
      sum += (i % 2 === 0) ? d * 3 : d * 1;
    } else if (len === 8) {
      sum += (i % 2 === 0) ? d * 3 : d * 1;
    }
  }

  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
}

let zxingReaderInstance = null;

function getZXingReader() {
  if (!zxingReaderInstance) {
    const hints = new Map();
    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.ITF,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    zxingReaderInstance = reader;
  }
  return zxingReaderInstance;
}

/**
 * Scan an HTML Video element or Image or Canvas using native BarcodeDetector or ZXing fallback.
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement|string} source
 * @returns {Promise<Array<{ rawValue: string, format: string, country: string, isEANValid: boolean, boundingBox?: Object }>>}
 */
export async function detectBarcodes(source) {
  const detected = [];
  const seenValues = new Set();

  // 1. Try Native BarcodeDetector API if supported (Chrome, Android, Edge)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const formats = [
        'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'
      ];
      const detector = new window.BarcodeDetector({ formats });
      let imageElement = source;

      if (typeof source === 'string') {
        imageElement = await loadImageElement(source);
      }

      if (imageElement) {
        const barcodes = await detector.detect(imageElement);
        for (const bc of barcodes) {
          const raw = (bc.rawValue || '').trim();
          if (raw && !seenValues.has(raw)) {
            seenValues.add(raw);
            const gs1 = getCountryFromGS1Barcode(raw);
            const isEAN = /^\d{8,14}$/.test(raw);
            detected.push({
              rawValue: raw,
              format: (bc.format || 'barcode').toUpperCase(),
              type: bc.format?.includes('qr') ? 'qr' : 'barcode',
              country: gs1 ? gs1.country : null,
              countryFlag: gs1 ? gs1.flag : null,
              isValidChecksum: isEAN ? validateEANChecksum(raw) : true,
              boundingBox: bc.boundingBox || null,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Native BarcodeDetector pass failed, falling back to ZXing:', err);
    }
  }

  // 2. If no barcodes detected or native detector not available, run ZXing MultiFormatReader
  if (detected.length === 0) {
    try {
      let canvas;
      if (typeof source === 'string') {
        canvas = await imageToCanvas(source);
      } else if (source instanceof HTMLCanvasElement) {
        canvas = source;
      } else if (source instanceof HTMLImageElement || source instanceof HTMLVideoElement) {
        canvas = elementToCanvas(source);
      }

      if (canvas && canvas.width > 0 && canvas.height > 0) {
        const zxingResults = await scanCanvasWithZXing(canvas);
        for (const res of zxingResults) {
          const raw = (res.text || '').trim();
          if (raw && !seenValues.has(raw)) {
            seenValues.add(raw);
            const gs1 = getCountryFromGS1Barcode(raw);
            const isEAN = /^\d{8,14}$/.test(raw);
            const fmtStr = res.format ? String(res.format) : 'EAN_13';
            const isQR = fmtStr.includes('QR') || res.format === BarcodeFormat.QR_CODE;
            detected.push({
              rawValue: raw,
              format: fmtStr,
              type: isQR ? 'qr' : 'barcode',
              country: gs1 ? gs1.country : null,
              countryFlag: gs1 ? gs1.flag : null,
              isValidChecksum: isEAN ? validateEANChecksum(raw) : true,
              boundingBox: null,
            });
          }
        }
      }
    } catch (err) {
      console.warn('ZXing barcode scan pass failed:', err);
    }
  }

  return detected;
}

/**
 * Scan canvas with ZXing across normal and rotated views (0, 90, 270)
 */
async function scanCanvasWithZXing(canvas) {
  const reader = getZXingReader();
  const results = [];

  const testRotations = [0, 90, 270];

  for (const deg of testRotations) {
    try {
      let targetCanvas = canvas;
      if (deg !== 0) {
        targetCanvas = rotateCanvas(canvas, deg);
      }

      const imgDataUrl = targetCanvas.toDataURL('image/jpeg', 0.95);
      const img = await loadImageElement(imgDataUrl);
      const res = await reader.decodeFromImageElement(img);

      if (res && res.getText()) {
        results.push({
          text: res.getText(),
          format: res.getBarcodeFormat(),
        });
        // Found barcode at this rotation
        break;
      }
    } catch (e) {
      // Decode not found at this angle, continue
    }
  }

  return results;
}

function loadImageElement(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function imageToCanvas(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function elementToCanvas(el) {
  const canvas = document.createElement('canvas');
  const w = el.videoWidth || el.naturalWidth || el.width || 640;
  const h = el.videoHeight || el.naturalHeight || el.height || 480;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(el, 0, 0, w, h);
  return canvas;
}

function rotateCanvas(canvas, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const is90or270 = degrees === 90 || degrees === 270;
  const w = is90or270 ? canvas.height : canvas.width;
  const h = is90or270 ? canvas.width : canvas.height;

  const rotated = document.createElement('canvas');
  rotated.width = w;
  rotated.height = h;
  const ctx = rotated.getContext('2d', { willReadFrequently: true });

  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return rotated;
}
