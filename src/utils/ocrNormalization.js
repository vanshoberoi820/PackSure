/* ─────────────────────────────────────────────
   OCR Text Normalization Layer — Legal Metrology Standardizer
   Context-aware corrections for Rule 6 declarations: MRP, Net Quantity (Weight/Measure/Number/Pages), Dates & Units
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
 * Clean OCR numbers in currency / price contexts (Rule 6(1)(e)).
 * Handles "M.R.P. : ₹ 185", "MRP Rs. 240", "M.R.P. : 185 Incl. of all taxes"
 */
export function normalizePriceString(rawStr) {
  if (!rawStr) return '';

  let str = rawStr
    .replace(/₹/g, 'Rs. ')
    .replace(/\bINR\b/gi, 'Rs. ')
    .replace(/M\.?\s*R\.?\s*P\.?/gi, 'MRP')
    .replace(/Maximum\s*Retail\s*Price/gi, 'MRP')
    .replace(/Max\.?\s*Retail\s*Price/gi, 'MRP');

  // Replace common letter substitutions in price numbers following MRP on the same line
  str = str.replace(/MRP[^\n\d]*([0-9OIlSBzZ]+(?:[.,][0-9OIlSBzZ]{1,2})?)/gi, (match, numPart) => {
    let cleanNum = numPart
      .replace(/[O]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8')
      .replace(/[zZ]/g, '2');
    return `MRP Rs. ${cleanNum}`;
  });

  return str;
}

/**
 * Clean OCR date strings (Rule 6(1)(d)) (e.g. "O3/2O26" -> "03/2026", "12-O3-2O26" -> "12-03-2026").
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
 * Standardize quantity units for Net Quantity under Rule 6(1)(c):
 * Supports weight (g, kg), measure/volume (ml, L), and number/count (pages, sheets, units, N, pcs).
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
  val = val.replace(/\btotal\s*pages?\b/gi, 'Pages');
  val = val.replace(/\bpages?\b/gi, 'Pages');
  val = val.replace(/\bsheets?\b/gi, 'Sheets');
  val = val.replace(/\bleaves?\b/gi, 'Leaves');

  // Ensure single space between quantity number and unit
  val = val.replace(/(\d+)\s*([a-zA-Z]+)/g, '$1 $2');
  return val.trim();
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
