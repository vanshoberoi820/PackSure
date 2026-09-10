/* ─────────────────────────────────────────────
   Declaration Extraction Engine — Resilient Multiline Legal Metrology Parser
   Window-based tolerant extraction with context-aware OCR normalization
   ───────────────────────────────────────────── */
import {
  normalizeOCRText,
  normalizePriceString,
  normalizeDateDigits,
  normalizeMetricQuantity,
  normalizeFSSAILicense,
} from '../utils/ocrNormalization';

export function extractDeclarations(rawOcrText, ocrConfidence = 75, metadata = {}) {
  if (!rawOcrText || rawOcrText.trim().length === 0) {
    return getAllDeclarationsAsNotDetected(metadata);
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
    notDetected('productName', 'Product Name', 'Rule 6(1)(b)', metadata),
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

export function extractProductNameAndBrand(text, confMul, metadata = {}) {
  const field = 'productName';
  const label = 'Product Name';
  const rule = 'Rule 6(1)(b)';

  const explicit = text.match(
    /(?:product\s*(?:name)?|name\s*of\s*(?:the\s*)?(?:product|commodity|item))\s*[:\-]?\s*(.{3,80})/i
  );
  if (explicit) {
    const val = explicit[1].split(/\n/)[0].trim().replace(/[:;\-_]+$/, '');
    if (val.length >= 3) {
      return makeDeclaration(field, label, val, 95 * confMul, 'detected', rule, explicit[0], metadata);
    }
  }

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  const skipPattern = /^(mrp|net|mfg|mfd|best|exp|batch|fssai|lic|made|product of|country|import|pack|manufact|ingredient|nutrition|energy|protein|fat|carb|sugar|storage|allergen|serving|scan|visit|customer|care|tel|call|toll|www|\d+$)/i;

  const scoredCandidates = [];

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (skipPattern.test(line)) continue;
    if (line.length < 3 || line.length > 70) continue;

    let score = 50;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 6) score += 20;
    if (/^[A-Z]/.test(line)) score += 15;
    if (line === line.toUpperCase()) score += 10;
    if (i < 3) score += 15;

    scoredCandidates.push({ line, score });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length > 0) {
    const best = scoredCandidates[0];
    const status = best.score >= 70 ? 'detected' : 'needs_review';
    return makeDeclaration(field, label, best.line, Math.min(90, best.score * confMul), status, rule, best.line, metadata);
  }

  return notDetected(field, label, rule, metadata);
}

export function extractManufacturer(text, confMul, metadata = {}) {
  const field = 'manufacturer';
  const label = 'Manufacturer';
  const rule = 'Rule 6(1)(a)';

  const patterns = [
    /(?:manufactur(?:ed|er|ing)\s*(?:by|&\s*(?:market|pack|pkd))?|mfg\.?\s*(?:by)?|mfd\.?\s*(?:by)?)\s*[:\-]?\s*([\s\S]{5,180}?)(?=\n\s*(?:pkg|pack|market|mfg|exp|batch|fssai|net|mrp|country|storage|ingredient|$))/i,
    /(?:marketed\s*(?:by|&))\s*[:\-]?\s*([\s\S]{5,180}?)(?=\n\s*(?:pkg|pack|mfg|exp|batch|fssai|net|mrp|$))/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let val = m[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim();
      val = val.replace(/[,;\-_.]+$/, '').trim();
      if (val.length >= 4) {
        return makeDeclaration(field, label, val, 90 * confMul, 'detected', rule, m[0].slice(0, 100), metadata);
      }
    }
  }

  return notDetected(field, label, rule, metadata);
}

export function extractPacker(text, confMul, metadata = {}) {
  const field = 'packer';
  const label = 'Packer';
  const rule = 'Rule 6(1)(a)';

  const m = text.match(
    /(?:pack(?:ed|er|ing|aged)\s*(?:by|&\s*\w+)?|pkd\.?\s*by)\s*[:\-]?\s*([\s\S]{5,180}?)(?=\n\s*(?:mfg|exp|batch|fssai|net|mrp|country|$))/i
  );
  if (m) {
    let val = m[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim();
    val = val.replace(/[,;\-_.]+$/, '').trim();
    if (val.length >= 4) {
      return makeDeclaration(field, label, val, 88 * confMul, 'detected', rule, m[0].slice(0, 100), metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

export function extractImporter(text, confMul, metadata = {}) {
  const field = 'importer';
  const label = 'Importer';
  const rule = 'Rule 6(1)(a)';

  const m = text.match(
    /(?:import(?:ed|er|ing)\s*(?:by|&\s*\w+)?)\s*[:\-]?\s*([\s\S]{5,180}?)(?=\n\s*(?:mfg|exp|batch|fssai|net|mrp|$))/i
  );
  if (m) {
    let val = m[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim();
    val = val.replace(/[,;\-_.]+$/, '').trim();
    if (val.length >= 4) {
      return makeDeclaration(field, label, val, 88 * confMul, 'detected', rule, m[0].slice(0, 100), metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

export function extractNetQuantity(text, confMul, metadata = {}) {
  const field = 'netQuantity';
  const label = 'Net Quantity';
  const rule = 'Rule 6(1)(c)';

  const patterns = [
    /(?:net\s*(?:wt|weight|qty|quantity|content|vol|volume|mass)|contents?|netto)[\s\S]{0,30}?[:\-]?\s*([0-9OIlSBzZ.,]+\s*(?:g|gm|gms|gram|grams|kg|kgs|kilogram|ml|mL|l|ltr|litre|liter|cm|mm|m|pieces?|pcs?|units?|nos?|n)\b)/i,
    /([\d.,]+\s*(?:g|gm|kg|ml|l|ltr)\b)\s*(?:net|e\b)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let rawQty = m[1].trim();
      let normalized = normalizeMetricQuantity(rawQty);
      return makeDeclaration(field, label, normalized, 94 * confMul, 'detected', rule, m[0], metadata);
    }
  }

  return notDetected(field, label, rule, metadata);
}

export function extractMRP(text, confMul, metadata = {}) {
  const field = 'mrp';
  const label = 'MRP (Maximum Retail Price)';
  const rule = 'Rule 6(1)(e)';

  const normalizedPriceText = normalizePriceString(text);

  const patterns = [
    /MRP[\s\S]{0,50}?(?:Rs\.?|₹|INR)?\s*[:\-]?\s*([0-9.,]+)(?:\s*\/?-|\s*only|\s*incl|\n|$)/i,
    /(?:maximum\s*retail\s*price)[\s\S]{0,50}?(?:Rs\.?|₹|INR)?\s*[:\-]?\s*([0-9.,]+)/i,
    /(?:Rs\.?|₹)\s*([0-9.,]+)\s*(?:\/\-|only|\(incl)/i,
  ];

  for (const pat of patterns) {
    const m = normalizedPriceText.match(pat);
    if (m) {
      const cleanNum = m[1].replace(/,/g, '').replace(/\.$/, '');
      const price = parseFloat(cleanNum);

      if (!isNaN(price) && price > 0 && price < 100000 && cleanNum.length <= 8) {
        const hasTax = /incl|tax/i.test(text.slice(Math.max(0, m.index - 30), m.index + 80));
        const taxSuffix = hasTax ? ' (Incl. of all taxes)' : '';
        const formatted = `Rs. ${price.toFixed(2)}${taxSuffix}`;
        return makeDeclaration(field, label, formatted, 95 * confMul, 'detected', rule, m[0], metadata);
      }
    }
  }

  return notDetected(field, label, rule, metadata);
}

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

export function extractCountryOfOrigin(text, confMul, metadata = {}) {
  const field = 'countryOfOrigin';
  const label = 'Country of Origin';
  const rule = 'Rule 6(1)(g)';

  const patterns = [
    /(?:country\s*of\s*origin|origin\s*country)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    /(?:made\s*in|product\s*of|produced\s*in|assembled\s*in)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const country = m[1].split(/\n/)[0].trim().replace(/[,;\-_.]+$/, '');
      if (country.length >= 3) {
        return makeDeclaration(field, label, country, 92 * confMul, 'detected', rule, m[0], metadata);
      }
    }
  }

  return notDetected(field, label, rule, metadata);
}

export function extractConsumerCare(text, confMul, metadata = {}) {
  const field = 'consumerCare';
  const label = 'Consumer Care Details';
  const rule = 'Rule 6(1)(n)';

  const sectionMatch = text.match(
    /(?:consumer\s*(?:care|helpline|grievance|complaint)|customer\s*(?:care|service|support|helpline)|grievance|toll\s*free|helpline)\s*[:\-]?\s*([\s\S]{5,150}?)(?=\n\s*(?:mfg|exp|batch|mrp|$))/i
  );

  if (sectionMatch) {
    let val = sectionMatch[1].replace(/\n+/g, ', ').replace(/\s{2,}/g, ' ').trim().replace(/[,;.]+$/, '');
    return makeDeclaration(field, label, val, 90 * confMul, 'detected', rule, sectionMatch[0], metadata);
  }

  const phoneMatch = text.match(/(?:1800[\s\-]?\d{3}[\s\-]?\d{3,4}|(?:\+91[\s\-]?|0)?[1-9]\d{9})/i);
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i);

  if (phoneMatch || emailMatch) {
    const parts = [];
    if (phoneMatch) parts.push(`Ph: ${phoneMatch[0].trim()}`);
    if (emailMatch) parts.push(`Email: ${emailMatch[0].trim()}`);
    const combined = parts.join(', ');
    return makeDeclaration(field, label, combined, 78 * confMul, 'needs_review', rule, combined, metadata);
  }

  return notDetected(field, label, rule, metadata);
}

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
