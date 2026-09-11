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

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  eighteen: 18, twenty: 20, 'twenty four': 24, 'twenty-four': 24, 'thirty six': 36,
};

/**
 * Clean OCR numbers in currency / price contexts (Rule 6(1)(e)).
 * Handles "M.R.P. : ₹ 185", "MRP Rs. 240", "M.R.P. : 185 Incl. of all taxes", "MBP", "182.OO", etc.
 */
export function normalizePriceString(rawStr) {
  if (!rawStr) return '';

  let str = rawStr
    .replace(/₹/g, 'Rs. ')
    .replace(/\bINR\b/gi, 'Rs. ')
    .replace(/\b(?:MBP|MAP|WRP|NRP|M\.R\.P|MR\.P|M\s+R\s+P)\b/gi, 'MRP')
    .replace(/Maximum\s*Retail\s*Price/gi, 'MRP')
    .replace(/Max\.?\s*Retail\s*Price/gi, 'MRP');

  // Replace common letter substitutions in price numbers following MRP (multiline aware)
  str = str.replace(/MRP[\s\S]{0,40}?([0-9OIlSBzZ]+(?:\.[0-9OIlSBzZ]{1,2})?)/gi, (match, numPart) => {
    let cleanNum = numPart
      .replace(/[O]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8')
      .replace(/[zZ]/g, '2');
    return match.replace(numPart, cleanNum);
  });

  return str;
}

/**
 * Clean OCR date strings (Rule 6(1)(d)) (e.g. "O3/2O26" -> "03/2026", "23/O1/27" -> "23/01/27", "NINE MONTHS" -> "9 months").
 */
export function normalizeDateDigits(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';

  let cleaned = dateStr.trim();

  // Convert number words in shelf life (e.g. "nine months" -> "9 months")
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    const wordReg = new RegExp(`\\b${word}\\s+months?\\b`, 'gi');
    cleaned = cleaned.replace(wordReg, `${num} months`);
  }

  // Normalize common OCR misreads of date headers
  cleaned = cleaned
    .replace(/\b(?:USE\s*8Y|USEBY|USE\s*BEFORE|CONSUME\s*BEFORE)\b/gi, 'USE BY')
    .replace(/\b(?:EXP\.?\s*DT\.?|EXP\.?\s*DATE|EXPIRY\s*DATE|EXPD)\b/gi, 'EXP')
    .replace(/\b(?:MFD\.?\s*DT\.?|MFD\.?\s*DATE|MFG\.?\s*DATE|MFGD)\b/gi, 'MFD');

  // Fix OCR digits in date: "23/O1/27" -> "23/01/27", "2B/01/26" -> "28/01/26"
  cleaned = cleaned.replace(/([0-9OIlSBzZ]{1,2})[\/\-\.]([0-9OIlSBzZ]{1,2})[\/\-\.]([0-9OIlSBzZ]{2,4})/g, (m, d, mo, y) => {
    const fixDigits = (s) => s.replace(/[O]/gi, '0').replace(/[Il|]/g, '1').replace(/[S]/gi, '5').replace(/[B]/g, '8').replace(/[zZ]/g, '2');
    return `${fixDigits(d)}/${fixDigits(mo)}/${fixDigits(y)}`;
  });

  cleaned = cleaned.replace(/([0-9OIlSBzZ]{1,2})[\/\-\.]([0-9OIlSBzZ]{2,4})/g, (m, mo, y) => {
    const fixDigits = (s) => s.replace(/[O]/gi, '0').replace(/[Il|]/g, '1').replace(/[S]/gi, '5').replace(/[B]/g, '8').replace(/[zZ]/g, '2');
    return `${fixDigits(mo)}/${fixDigits(y)}`;
  });

  // Clean spaces around slashes/dots: "23 / 01 / 2027" -> "23/01/2027"
  cleaned = cleaned.replace(/\s*([\/\-\.])\s*/g, '$1');

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
