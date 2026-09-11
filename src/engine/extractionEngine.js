/* ─────────────────────────────────────────────
   Declaration Extraction Engine — Legal Metrology (Packaged Commodities) Rules, 2011
   Extracts mandatory Rule 6 declarations with weight, measure & number support
   ───────────────────────────────────────────── */
import {
  normalizeOCRText,
  normalizePriceString,
  normalizeDateDigits,
  normalizeMetricQuantity,
  normalizeFSSAILicense,
} from '../utils/ocrNormalization.js';
import { getCountryFromGS1Barcode } from './barcodeEngine.js';

export function extractDeclarations(rawOcrText, ocrConfidence = 75, metadata = {}) {
  const detectedBarcodes = metadata.detectedBarcodes || [];

  if (!rawOcrText || rawOcrText.trim().length === 0) {
    // If no OCR text but we have a barcode, still extract barcode and country of origin
    const list = getAllDeclarationsAsNotDetected(metadata);
    if (detectedBarcodes.length > 0) {
      const ean = detectedBarcodes.find(b => b.country);
      if (ean) {
        const countryIdx = list.findIndex(d => d.field === 'countryOfOrigin');
        if (countryIdx >= 0) {
          list[countryIdx] = makeDeclaration(
            'countryOfOrigin',
            'Country of Origin',
            ean.country,
            95,
            'detected',
            'Rule 6(1)(g)',
            `Derived from GS1 Barcode ${ean.rawValue} (${ean.country})`,
            metadata
          );
        }
      }
    }
    return list;
  }

  const text = normalizeOCRText(rawOcrText);
  const confMultiplier = Math.max(0.6, Math.min(1.0, (ocrConfidence || 75) / 100));

  return [
    extractProductNameAndBrand(text, confMultiplier, metadata),
    extractManufacturer(text, confMultiplier, metadata),
    extractPacker(text, confMultiplier, metadata),
    extractImporter(text, confMultiplier, metadata),
    extractNetQuantity(text, confMultiplier, metadata),
    extractMRP(text, confMultiplier, metadata),
    extractManufacturingDate(text, confMultiplier, metadata),
    extractBestBefore(text, confMultiplier, metadata),
    extractCountryOfOrigin(text, confMultiplier, metadata),
    extractConsumerCare(text, confMultiplier, metadata),
    extractUnitSalePrice(text, confMultiplier, metadata),
    extractFSSAILicense(text, confMultiplier, metadata),
    extractBatchNumber(text, confMultiplier, metadata),
  ];
}

function makeDeclaration(field, label, value, confidence, status, rule, evidence = '', metadata = {}) {
  return {
    field,
    label,
    value: value || null,
    confidence: Math.min(100, Math.max(0, Math.round(confidence))),
    status,
    rule,
    evidence: evidence ? evidence.trim() : (value ? String(value) : ''),
    source: metadata.source || 'ocr',
    frameNumber: metadata.frameNumber !== undefined ? metadata.frameNumber : null,
    timestamp: metadata.timestamp || null,
  };
}

function notDetected(field, label, rule, metadata = {}) {
  return makeDeclaration(field, label, null, 0, 'not_detected', rule, '', metadata);
}

function getAllDeclarationsAsNotDetected(metadata = {}) {
  return [
    notDetected('productName', 'Product Name / Commodity', 'Rule 6(1)(b)', metadata),
    notDetected('manufacturer', 'Manufacturer', 'Rule 6(1)(a)', metadata),
    notDetected('packer', 'Packer', 'Rule 6(1)(a)', metadata),
    notDetected('importer', 'Importer', 'Rule 6(1)(a)', metadata),
    notDetected('netQuantity', 'Net Quantity', 'Rule 6(1)(c)', metadata),
    notDetected('mrp', 'MRP (Maximum Retail Price)', 'Rule 6(1)(e)', metadata),
    notDetected('manufacturingDate', 'Manufacturing / Packing Date', 'Rule 6(1)(d)', metadata),
    notDetected('bestBefore', 'Best Before / Expiry Date', 'Rule 6(1)(d) proviso', metadata),
    notDetected('countryOfOrigin', 'Country of Origin', 'Rule 6(1)(g)', metadata),
    notDetected('consumerCare', 'Consumer Care Details', 'Rule 6(1)(n)', metadata),
    notDetected('unitSalePrice', 'Unit Sale Price', 'Rule 6(1)(h)', metadata),
    notDetected('fssaiLicense', 'FSSAI License', 'FSSAI Rule 9', metadata),
    notDetected('batchNumber', 'Batch / Lot Number', 'Rule 6(1)(q)', metadata),
  ];
}

/**
 * Rule 6(1)(b) — Common / Generic Name of Commodity
 */
export function extractProductNameAndBrand(text, confMul, metadata = {}) {
  const field = 'productName';
  const label = 'Product Name / Commodity';
  const rule = 'Rule 6(1)(b)';

  // 1. Explicit declaration "Product Name: ...", "Commodity: ..."
  const explicit = text.match(
    /(?:product\s*(?:name)?|commodity(?:\s*name)?|name\s*of\s*(?:the\s*)?(?:product|commodity|item))\s*[:\-]?\s*(.{3,80})/i
  );
  if (explicit) {
    const val = explicit[1].split(/\n/)[0].trim().replace(/[:;\-_]+$/, '');
    if (val.length >= 3) {
      return makeDeclaration(field, label, val, 95 * confMul, 'detected', rule, explicit[0], metadata);
    }
  }

  // 2. Known Commodity generic terms (Beverage, Food, Stationery, Household)
  const genericKeywords = [
    'Tender Coconut Water', 'Coconut Water', 'Cold Pressed Juice', 'Fruit Juice', 'Fruit Drink', 'Juice',
    'Notebook', 'Exercise Book', 'Long Book', 'Drawing Book', 'Diary', 'Register', 'Stationery',
    'Chocolate Cookies', 'Biscuits', 'Cookies', 'Bread', 'Cake', 'Atta', 'Flour', 'Rice',
    'Edible Oil', 'Mustard Oil', 'Sunflower Oil', 'Tea', 'Coffee', 'Milk', 'Butter', 'Ghee',
    'Bathing Soap', 'Soap', 'Shampoo', 'Toothpaste', 'Face Wash', 'Detergent',
    'LED Bulb', 'USB Cable', 'Earphones', 'Headphones', 'Battery', 'Apparel', 'T-Shirt', 'Shirt'
  ];

  for (const kw of genericKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(text)) {
      // Find Brand line if any (must be valid word, not numbers or dates)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const topBrand = lines.find(l => l.length >= 2 && l.length <= 30 && !/^\d|[\d.]{2,}|mrp|net|mfg|lic|rs|₹|date|www|use by|batch|nutri|tax|incl|qty/i.test(l));
      const finalName = topBrand && !topBrand.toLowerCase().includes(kw.toLowerCase()) && !kw.toLowerCase().includes(topBrand.toLowerCase())
        ? `${topBrand} ${kw}`
        : kw;
      return makeDeclaration(field, label, finalName, 92 * confMul, 'detected', rule, kw, metadata);
    }
  }

  // 3. Trademark / Brand declaration e.g. "SHAPE IS A REGISTERED TRADEMARK OF RISHABH INDUSTRIES"
  const tmMatch = text.match(/([A-Za-z0-9\s]{2,30})\s+is\s+a\s+registered\s+trademark/i);
  if (tmMatch) {
    const brand = tmMatch[1].trim();
    const commodityMatch = text.match(/\b(notebook|stationery|book|diary|register|pen|pencil|paper)\b/i);
    const combinedName = commodityMatch
      ? `${brand} ${commodityMatch[1].charAt(0).toUpperCase() + commodityMatch[1].slice(1)}`
      : `${brand} Product`;
    return makeDeclaration(field, label, combinedName, 92 * confMul, 'detected', rule, tmMatch[0], metadata);
  }

  // 4. Fallback line candidate scoring
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  const skipPattern = /^(mrp|net|mfg|mfd|best|exp|batch|fssai|lic|made|product of|country|import|pack|manufact|ingredient|nutrition|energy|protein|fat|carb|sugar|storage|allergen|serving|scan|visit|customer|care|tel|call|toll|www|use by|use before|see sleeve|see back|\d+$)/i;

  const scoredCandidates = [];

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (skipPattern.test(line)) continue;
    if (line.length < 3 || line.length > 70) continue;

    let score = 50;
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 6) score += 20;
    if (/^[A-Z]/.test(line)) score += 15;
    if (line === line.toUpperCase()) score += 10;
    if (i < 3) score += 15;

    scoredCandidates.push({ line, score });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length > 0) {
    const best = scoredCandidates[0];
    const status = best.score >= 65 ? 'detected' : 'needs_review';
    return makeDeclaration(field, label, best.line, Math.min(90, best.score * confMul), status, rule, best.line, metadata);
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(a) — Manufacturer Identity & Address
 */
export function extractManufacturer(text, confMul, metadata = {}) {
  const field = 'manufacturer';
  const label = 'Manufacturer';
  const rule = 'Rule 6(1)(a)';

  const patterns = [
    /(?:marketed\s*&\s*manufactured\s*(?:by)?|manufactured\s*&\s*marketed\s*(?:by)?|mkt\s*&\s*mfg\s*(?:by)?)\s*[:\-]?\s*([\s\S]{5,220}?)(?=(?:\n\s*(?:size|total\s*pages|pages|pkg|pack|mfg\s*date|exp|batch|fssai|net|mrp|country|storage|ingredient|plant|go green|scan))|$)/i,
    /(?:manufactured\s*by|marketed\s*by|mfg\.?\s*by|mfd\.?\s*by|manufactured\s*and\s*packed\s*by)\s*[:\-]?\s*([\s\S]{5,200}?)(?=(?:\n\s*(?:size|total\s*pages|pkg|pack|mfg\s*date|exp|batch|fssai|net|mrp|country|storage|ingredient|go green))|$)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let val = m[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim();
      val = val.replace(/[,;\-_.]+$/, '').trim();
      if (val.length >= 4 && !/^\s*date\s*[:\-]/i.test(val)) {
        return makeDeclaration(field, label, val, 95 * confMul, 'detected', rule, m[0].slice(0, 120), metadata);
      }
    }
  }

  // Fallback: Registered Trademark of <Company>
  const tm = text.match(/(?:registered\s*trademark\s*of|trademark\s*of)\s+([A-Za-z0-9\s.,\-_]{4,100})/i);
  if (tm) {
    const val = tm[1].replace(/\n+/g, ', ').trim().replace(/[,;\-_.]+$/, '');
    return makeDeclaration(field, label, val, 85 * confMul, 'detected', rule, tm[0], metadata);
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(a) — Packer Identity
 */
export function extractPacker(text, confMul, metadata = {}) {
  const field = 'packer';
  const label = 'Packer';
  const rule = 'Rule 6(1)(a)';

  const m = text.match(
    /(?:pack(?:ed|er|ing|aged)\s*by|pkd\.?\s*by)\s*[:\-]?\s*([\s\S]{5,180}?)(?=\n\s*(?:mfg|exp|batch|fssai|net|mrp|country|$))/i
  );
  if (m) {
    let val = m[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim();
    val = val.replace(/[,;\-_.]+$/, '').trim();
    if (val.length >= 4) {
      return makeDeclaration(field, label, val, 90 * confMul, 'detected', rule, m[0].slice(0, 100), metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(a) — Importer Identity
 */
export function extractImporter(text, confMul, metadata = {}) {
  const field = 'importer';
  const label = 'Importer';
  const rule = 'Rule 6(1)(a)';

  const m = text.match(
    /(?:import(?:ed|er|ing)\s*by)\s*[:\-]?\s*([\s\S]{5,180}?)(?=\n\s*(?:mfg|exp|batch|fssai|net|mrp|$))/i
  );
  if (m) {
    let val = m[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim();
    val = val.replace(/[,;\-_.]+$/, '').trim();
    if (val.length >= 4) {
      return makeDeclaration(field, label, val, 90 * confMul, 'detected', rule, m[0].slice(0, 100), metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(c) — Net Quantity
 * Supports weight (g, kg), measure/volume (ml, L), and number/count (Pages, Sheets, N, Units, Pcs, Dimensions)
 */
export function extractNetQuantity(text, confMul, metadata = {}) {
  const field = 'netQuantity';
  const label = 'Net Quantity';
  const rule = 'Rule 6(1)(c)';

  // 1. Stationery / Paper / Books: "Total Pages : 288 (with cover)", "288 Pages", "Size (cm): 24 x 18"
  const pagesMatch = text.match(
    /(?:total\s*pages?|pages?|sheets?|leaves?)\s*[:\-]?\s*([0-9OIlSBzZ]+)(?:\s*\((?:with\s*cover|without\s*cover|inclusive)\))?/i
  );
  const sizeMatch = text.match(/(?:size\s*(?:\(cm\)|\(mm\)|\(in\))?)\s*[:\-]?\s*([0-9.,]+\s*(?:x|\*)\s*[0-9.,]+(?:\s*cm|\s*mm|\s*m)?)/i);

  if (pagesMatch) {
    const rawNum = pagesMatch[1].replace(/[O]/g, '0').replace(/[Il]/g, '1').replace(/[S]/g, '5').replace(/[B]/g, '8');
    const sizePart = sizeMatch ? ` (${sizeMatch[1].trim()})` : '';
    const hasCover = /with\s*cover/i.test(text.slice(Math.max(0, pagesMatch.index - 10), pagesMatch.index + 50));
    const coverSuffix = hasCover ? ' (with cover)' : '';
    const formatted = `${rawNum} Pages${coverSuffix}${sizePart}`;
    return makeDeclaration(field, label, formatted, 95 * confMul, 'detected', rule, pagesMatch[0], metadata);
  }

  // 2. Weight / Volume: "Net Qty. : 1.01L", "Net Wt. 500 g", "Net Quantity: 1 L", "750 ml"
  const patterns = [
    /(?:net\s*(?:wt|weight|qty|quantity|content|vol|volume|mass)|contents?|netto)[\s\S]{0,30}?[:\-]?\s*([0-9OIlSBzZ.,]+\s*(?:g|gm|gms|gram|grams|kg|kgs|kilogram|ml|mL|l|ltr|litre|liter|cm|mm|m|pieces?|pcs?|units?|nos?|n)\b)/i,
    /([\d.,]+\s*(?:g|gm|kg|ml|l|ltr)\b)\s*(?:net|e\b)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let rawQty = m[1].trim();
      let normalized = normalizeMetricQuantity(rawQty);
      return makeDeclaration(field, label, normalized, 95 * confMul, 'detected', rule, m[0], metadata);
    }
  }

  // 3. Count / Number format: "1 N", "10 Units", "1 Pc", "100 Numbers"
  const countMatch = text.match(
    /(?:net\s*(?:qty|quantity|count|number)?|quantity|qty|contents?)\s*[:\-]?\s*([0-9OIlSBzZ]+\s*(?:n|u|units?|pcs?|pieces?|nos?|numbers?|count))\b/i
  );
  if (countMatch) {
    const norm = normalizeMetricQuantity(countMatch[1]);
    const sizePart = sizeMatch ? ` (${sizeMatch[1].trim()})` : '';
    return makeDeclaration(field, label, `${norm}${sizePart}`, 92 * confMul, 'detected', rule, countMatch[0], metadata);
  }

  // 4. Standalone Dimensions / Size as quantity indicator
  if (sizeMatch) {
    const sizeVal = `1 N (${sizeMatch[1].trim()})`;
    return makeDeclaration(field, label, sizeVal, 88 * confMul, 'detected', rule, sizeMatch[0], metadata);
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(e) — Retail Sale Price / Maximum Retail Price (MRP)
 */
export function extractMRP(text, confMul, metadata = {}) {
  const field = 'mrp';
  const label = 'MRP (Maximum Retail Price)';
  const rule = 'Rule 6(1)(e)';

  const normalizedPriceText = normalizePriceString(text);

  const patterns = [
    /MRP[\s\S]{0,60}?(?:Rs\.?|₹|INR)?\s*[:\-.]?\s*(?:\(?[^0-9\n]{0,30}\)?\s*)?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /(?:maximum\s*retail\s*price|max\.?\s*retail\s*price)[\s\S]{0,60}?(?:Rs\.?|₹|INR)?\s*[:\-.]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    /(?:Rs\.?|₹)\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:\/\-|only|\(incl|incl|\n|$)/i,
    /M\.?\s*R\.?\s*P\.?[\s\S]{0,40}?(?:Rs\.?|₹)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
  ];

  for (const pat of patterns) {
    const m = normalizedPriceText.match(pat);
    if (m) {
      const cleanNum = m[1].replace(/,/g, '').replace(/\.$/, '');
      const price = parseFloat(cleanNum);

      if (!isNaN(price) && price > 0 && price < 100000 && cleanNum.length <= 8) {
        const hasTax = /incl|tax|all\s*taxes/i.test(text.slice(Math.max(0, m.index - 30), m.index + 90));
        const taxSuffix = hasTax ? ' (Incl. of all taxes)' : '';
        const formatted = `Rs. ${price.toFixed(2)}${taxSuffix}`;
        return makeDeclaration(field, label, formatted, 95 * confMul, 'detected', rule, m[0], metadata);
      }
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(d) — Month and Year of Manufacture / Packing
 */
export function extractManufacturingDate(text, confMul, metadata = {}) {
  const field = 'manufacturingDate';
  const label = 'Manufacturing / Packing Date';
  const rule = 'Rule 6(1)(d)';

  const patterns = [
    /(?:mfg\.?\s*(?:d(?:ate|t)?)?|mfd\.?\s*(?:d(?:ate|t)?)?|pkg\.?\s*(?:d(?:ate|t)?)?|pack(?:ed|ing)\s*(?:date|on)?|date\s*of\s*(?:mfg|manufacture|packing))[\s\S]{0,35}?[:\-.]?\s*([0-9OIlSBzZ]{1,2}\s*[\/\-\.]\s*[0-9OIlSBzZ]{1,2}\s*[\/\-\.]\s*[0-9OIlSBzZ]{2,4}|[A-Za-z]{3,9}\s*[,']?\s*[0-9OIlSBzZ]{2,4}|[0-9OIlSBzZ]{1,2}\s*[\/\-\.]\s*[0-9OIlSBzZ]{2,4})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const rawDate = m[1].replace(/\s+/g, '');
      const cleaned = normalizeDateDigits(rawDate);
      return makeDeclaration(field, label, cleaned, 90 * confMul, 'detected', rule, m[0], metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(d) proviso — Best Before / Expiry Date
 */
export function extractBestBefore(text, confMul, metadata = {}) {
  const field = 'bestBefore';
  const label = 'Best Before / Expiry Date';
  const rule = 'Rule 6(1)(d) proviso';

  const patterns = [
    /(?:best\s*before|best\s*by|exp(?:iry)?\s*(?:date)?|use\s*by|use\s*before|bb)[\s\S]{0,35}?[:\-.]?\s*([0-9OIlSBzZ]{1,2}\s*[\/\-\.]\s*[0-9OIlSBzZ]{1,2}\s*[\/\-\.]\s*[0-9OIlSBzZ]{2,4}|\d+\s*months?(?:\s*from\s*(?:mfg|manufacture|packing|packaging))?|[A-Za-z]{3,9}\s*[,']?\s*[0-9OIlSBzZ]{2,4}|[0-9OIlSBzZ]{1,2}\s*[\/\-\.]\s*[0-9OIlSBzZ]{2,4})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const rawDate = m[1].trim();
      const cleaned = /month/i.test(rawDate) ? rawDate : normalizeDateDigits(rawDate);
      return makeDeclaration(field, label, cleaned, 88 * confMul, 'detected', rule, m[0], metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(g) — Country of Origin
 */
export function extractCountryOfOrigin(text, confMul, metadata = {}) {
  const field = 'countryOfOrigin';
  const label = 'Country of Origin';
  const rule = 'Rule 6(1)(g)';

  // 1. Explicit Country of Origin: "Country of Origin: India", "Made in India", "Product of India"
  const patterns = [
    /(?:country\s*of\s*origin|origin\s*country)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    /(?:made\s*in|product\s*of|produced\s*in|assembled\s*in)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const country = m[1].split(/\n/)[0].trim().replace(/[,;\-_.]+$/, '');
      if (country.length >= 3) {
        return makeDeclaration(field, label, country, 95 * confMul, 'detected', rule, m[0], metadata);
      }
    }
  }

  // 2. Address / State suffix indicating India: "MP - INDIA", "Ratlam, MP - INDIA", "Mumbai, INDIA"
  const indiaMatch = text.match(/(?:[A-Za-z]{2,15}\s*[-–,]\s*)?(?:INDIA|Bharat)\b/i);
  if (indiaMatch) {
    return makeDeclaration(field, label, 'India', 94 * confMul, 'detected', rule, indiaMatch[0], metadata);
  }

  // 3. GS1 Barcode Prefix lookup (890 = GS1 India)
  const detectedBarcodes = metadata.detectedBarcodes || [];
  for (const bc of detectedBarcodes) {
    if (bc.country) {
      return makeDeclaration(
        field,
        label,
        bc.country,
        92 * confMul,
        'detected',
        rule,
        `Verified via GS1 Barcode (${bc.rawValue})`,
        metadata
      );
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(n) — Consumer Care Details
 */
export function extractConsumerCare(text, confMul, metadata = {}) {
  const field = 'consumerCare';
  const label = 'Consumer Care Details';
  const rule = 'Rule 6(1)(n)';

  // 1. Explicit section
  const sectionMatch = text.match(
    /(?:consumer\s*(?:care|helpline|grievance|complaint)|customer\s*(?:care|service|support|helpline)|grievance|toll\s*free|helpline|feedback|scan\s*for)\s*[:\-]?\s*([\s\S]{5,150}?)(?=\n\s*(?:mfg|exp|batch|mrp|$))/i
  );

  if (sectionMatch) {
    let val = sectionMatch[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim().replace(/[,;.]+$/, '');
    return makeDeclaration(field, label, val, 92 * confMul, 'detected', rule, sectionMatch[0], metadata);
  }

  // 2. Phone, Email, Website matches (filter out 12-14 digit standalone barcodes from phone match)
  const textWithoutBarcodes = text.replace(/\b\d{12,14}\b/g, '');
  const phoneMatch = textWithoutBarcodes.match(/(?:\+91[\s\-]?)?[6-9]\d{4}[\s\-]?\d{5}\b|1800[\s\-]?\d{3}[\s\-]?\d{3,4}\b/i);
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i);
  const webMatch = text.match(/(?:www\.[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}|https?:\/\/[a-zA-Z0-9.\-]+)/i);

  if (phoneMatch || emailMatch || webMatch) {
    const parts = [];
    if (phoneMatch) parts.push(`Ph: ${phoneMatch[0].trim()}`);
    if (emailMatch) parts.push(`Email: ${emailMatch[0].trim()}`);
    if (webMatch) parts.push(`Web: ${webMatch[0].trim()}`);
    const combined = parts.join(', ');
    return makeDeclaration(field, label, combined, 90 * confMul, 'detected', rule, combined, metadata);
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(h) — Unit Sale Price
 */
export function extractUnitSalePrice(text, confMul, metadata = {}) {
  const field = 'unitSalePrice';
  const label = 'Unit Sale Price';
  const rule = 'Rule 6(1)(h)';

  const m = text.match(
    /(?:unit\s*(?:sale)?\s*price|price\s*per\s*(?:unit|g|kg|ml|l|piece))\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per\s*)?(?:\/\s*)?(g|kg|ml|l|unit|piece|pc)?/i
  );

  if (m) {
    const price = m[1].replace(/,/g, '');
    const unit = m[2] || '';
    const val = `Rs. ${price}${unit ? ' per ' + unit : ''}`;
    return makeDeclaration(field, label, val, 85 * confMul, 'detected', rule, m[0], metadata);
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * FSSAI License (for food items)
 */
export function extractFSSAILicense(text, confMul, metadata = {}) {
  const field = 'fssaiLicense';
  const label = 'FSSAI License';
  const rule = 'FSSAI Rule 9';

  const m = text.match(
    /(?:fssai|lic\.?\s*no\.?|license\s*(?:no\.?|number)?)\s*[:\-.]?\s*([0-9\s\-]{10,18})/i
  );

  if (m) {
    const cleaned = normalizeFSSAILicense(m[1]);
    if (cleaned.length >= 10 && cleaned.length <= 14) {
      return makeDeclaration(field, label, cleaned, 92 * confMul, 'detected', rule, m[0], metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

/**
 * Rule 6(1)(q) — Batch / Lot Number
 */
export function extractBatchNumber(text, confMul, metadata = {}) {
  const field = 'batchNumber';
  const label = 'Batch / Lot Number';
  const rule = 'Rule 6(1)(q)';

  const m = text.match(
    /(?:batch\s*(?:no\.?|number)?|lot\s*(?:no\.?|number)?|b\.?\s*no\.?|b\/no)\s*[:\-.]?\s*([A-Za-z0-9\-\/]{3,24})/i
  );

  if (m) {
    const val = m[1].trim();
    return makeDeclaration(field, label, val, 88 * confMul, 'detected', rule, m[0], metadata);
  }

  return notDetected(field, label, rule, metadata);
}
