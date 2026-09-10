/* ─────────────────────────────────────────────
   OCR Text Normalization Layer
   Context-aware corrections for packaging text, dates, prices, units, and multiline labels
   ───────────────────────────────────────────── */

/**
 * Standardize full OCR text without losing layout or line breaks.
 */
export function normalizeOCRText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    // Normalize quotes and dashes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    // Clean excessive spaces per line while preserving lines
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Clean OCR numbers in currency / price contexts (e.g. "Rs. 24O.OO" -> "Rs. 240.00").
 */
export function normalizePriceString(rawStr) {
  if (!rawStr) return '';

  let str = rawStr
    .replace(/₹/g, 'Rs. ')
    .replace(/\bINR\b/gi, 'Rs. ')
    .replace(/\bMRP\b/gi, 'MRP')
    .replace(/M\.?\s*R\.?\s*P\.?/gi, 'MRP')
    .replace(/Maximum\s*Retail\s*Price/gi, 'MRP');

  // Replace common letter substitutions in price numbers
  str = str.replace(/MRP\s*[:\-]?\s*(?:Rs\.?|₹)?\s*([0-9OIlSBzZ.,\s/-]+)/i, (match, numPart) => {
    let cleanNum = numPart
      .replace(/[O]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8')
      .replace(/[zZ]/g, '2')
      .replace(/\s+/g, '')
      .replace(/\/-$/, '')
      .replace(/,$/, '');
    return `MRP Rs. ${cleanNum}`;
  });

  return str;
}

/**
 * Clean OCR date strings (e.g. "O3/2O26" -> "03/2026", "12-O3-2O26" -> "12-03-2026").
 */
export function normalizeDateDigits(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';

  let cleaned = dateStr.trim();

  // If text contains date-like patterns with letters O, I, l, S, B, fix them
  cleaned = cleaned.replace(/([0-9OIlSBzZ]{1,2})[\/\-\.]([0-9OIlSBzZ]{1,2})[\/\-\.]([0-9OIlSBzZ]{2,4})/g, (m, d, mo, y) => {
    const fixDigits = (s) => s.replace(/[O]/gi, '0').replace(/[Il|]/g, '1').replace(/[S]/gi, '5').replace(/[B]/g, '8').replace(/[zZ]/g, '2');
    return `${fixDigits(d)}/${fixDigits(mo)}/${fixDigits(y)}`;
  });

  cleaned = cleaned.replace(/([0-9OIlSBzZ]{1,2})[\/\-\.]([0-9OIlSBzZ]{2,4})/g, (m, mo, y) => {
    const fixDigits = (s) => s.replace(/[O]/gi, '0').replace(/[Il|]/g, '1').replace(/[S]/gi, '5').replace(/[B]/g, '8').replace(/[zZ]/g, '2');
    return `${fixDigits(mo)}/${fixDigits(y)}`;
  });

  return cleaned;
}

/**
 * Standardize metric units for Net Quantity.
 */
export function normalizeMetricQuantity(raw) {
  if (!raw) return '';

  let val = raw.replace(/,/g, '').trim();

  // Replace common OCR unit variations
  val = val.replace(/\bgm(s)?\b/gi, 'g');
  val = val.replace(/\bgram(s)?\b/gi, 'g');
  val = val.replace(/\bkilogram(s)?\b/gi, 'kg');
  val = val.replace(/\bkgs\b/gi, 'kg');
  val = val.replace(/\bltr(s)?\b/gi, 'L');
  val = val.replace(/\blitre(s)?\b/gi, 'L');
  val = val.replace(/\bliter(s)?\b/gi, 'L');
  val = val.replace(/\bml\b/gi, 'ml');
  val = val.replace(/\bpieces?\b/gi, 'pcs');
  val = val.replace(/\bnos?\b/gi, 'N');
  val = val.replace(/\bunits?\b/gi, 'N');

  // Ensure single space between quantity number and unit
  val = val.replace(/(\d+)\s*([a-zA-Z]+)/g, '$1 $2');
  return val;
}

/**
 * Standardize FSSAI License numbers (removes spaces / dashes from 14-digit number).
 */
export function normalizeFSSAILicense(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 14) {
    return digits;
  }
  return raw.trim();
}
