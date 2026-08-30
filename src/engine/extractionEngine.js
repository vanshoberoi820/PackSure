/* ─────────────────────────────────────────────
   Declaration Extraction Engine
   Regex-based extraction of Legal Metrology
   mandatory declarations from OCR text
   ───────────────────────────────────────────── */

/**
 * Extract all mandatory declarations from raw OCR text.
 * @param {string} ocrText — raw text from OCR
 * @param {number} ocrConfidence — overall OCR confidence (0-100)
 * @returns {Array<Declaration>}
 */
export function extractDeclarations(ocrText, ocrConfidence = 70) {
  if (!ocrText || ocrText.trim().length === 0) {
    return getAllDeclarationsAsNotDetected();
  }

  const text = normalizeText(ocrText);
  const confMultiplier = Math.min(ocrConfidence / 100, 1);

  return [
    extractProductName(text, confMultiplier),
    extractManufacturer(text, confMultiplier),
    extractPacker(text, confMultiplier),
    extractImporter(text, confMultiplier),
    extractNetQuantity(text, confMultiplier),
    extractMRP(text, confMultiplier),
    extractManufacturingDate(text, confMultiplier),
    extractBestBefore(text, confMultiplier),
    extractCountryOfOrigin(text, confMultiplier),
    extractConsumerCare(text, confMultiplier),
    extractUnitSalePrice(text, confMultiplier),
    extractFSSAILicense(text, confMultiplier),
    extractBatchNumber(text, confMultiplier),
  ];
}

/* ─── Text Normalization ─── */

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ─── Helper: Create declaration object ─── */

function makeDeclaration(field, label, value, confidence, status) {
  return { field, label, value, confidence: Math.round(confidence), status };
}

function notDetected(field, label) {
  return makeDeclaration(field, label, null, 0, 'not_detected');
}

function getAllDeclarationsAsNotDetected() {
  return [
    notDetected('productName', 'Product Name'),
    notDetected('manufacturer', 'Manufacturer'),
    notDetected('packer', 'Packer'),
    notDetected('importer', 'Importer'),
    notDetected('netQuantity', 'Net Quantity'),
    notDetected('mrp', 'MRP (Maximum Retail Price)'),
    notDetected('manufacturingDate', 'Manufacturing / Packing Date'),
    notDetected('bestBefore', 'Best Before / Expiry Date'),
    notDetected('countryOfOrigin', 'Country of Origin'),
    notDetected('consumerCare', 'Consumer Care Details'),
    notDetected('unitSalePrice', 'Unit Sale Price'),
    notDetected('fssaiLicense', 'FSSAI License'),
    notDetected('batchNumber', 'Batch / Lot Number'),
  ];
}

/* ─── Individual Extractors ─── */

function extractProductName(text, confMul) {
  const field = 'productName';
  const label = 'Product Name';

  // Look for explicit "Product:" or "Name:" labels
  const explicit = text.match(
    /(?:product\s*(?:name)?|name\s*of\s*(?:the\s*)?(?:product|commodity))\s*[:\-]?\s*(.{3,60})/i
  );
  if (explicit) {
    const val = explicit[1].split(/\n/)[0].trim();
    return makeDeclaration(field, label, val, 90 * confMul, 'detected');
  }

  // Heuristic: first non-trivial line that looks like a product name
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 2);
  for (const line of lines.slice(0, 5)) {
    // Skip lines that are clearly something else
    if (/^(mrp|net|mfg|best|exp|batch|fssai|lic|made|product of|country|import|pack|manufact)/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (line.length >= 3 && line.length <= 80) {
      return makeDeclaration(field, label, line, 65 * confMul, 'needs_review');
    }
  }

  return notDetected(field, label);
}

function extractManufacturer(text, confMul) {
  const field = 'manufacturer';
  const label = 'Manufacturer';

  const patterns = [
    /(?:manufactur(?:ed|er|ing)\s*(?:by|&\s*(?:market|pack))?|mfg\.?\s*(?:by)?|mfd\.?\s*(?:by)?)\s*[:\-]?\s*(.{5,120})/i,
    /(?:marketed?\s*(?:by|&))\s*[:\-]?\s*(.{5,120})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let val = m[1].split(/\n/)[0].trim();
      // Clean trailing punctuation
      val = val.replace(/[,;.]+$/, '').trim();
      return makeDeclaration(field, label, val, 88 * confMul, 'detected');
    }
  }

  return notDetected(field, label);
}

function extractPacker(text, confMul) {
  const field = 'packer';
  const label = 'Packer';

  const m = text.match(
    /(?:pack(?:ed|er|ing|aged)\s*(?:by|&\s*\w+)?)\s*[:\-]?\s*(.{5,120})/i
  );
  if (m) {
    let val = m[1].split(/\n/)[0].trim().replace(/[,;.]+$/, '').trim();
    return makeDeclaration(field, label, val, 85 * confMul, 'detected');
  }

  return notDetected(field, label);
}

function extractImporter(text, confMul) {
  const field = 'importer';
  const label = 'Importer';

  const m = text.match(
    /(?:import(?:ed|er|ing)\s*(?:by|&\s*\w+)?)\s*[:\-]?\s*(.{5,120})/i
  );
  if (m) {
    let val = m[1].split(/\n/)[0].trim().replace(/[,;.]+$/, '').trim();
    return makeDeclaration(field, label, val, 85 * confMul, 'detected');
  }

  return notDetected(field, label);
}

function extractNetQuantity(text, confMul) {
  const field = 'netQuantity';
  const label = 'Net Quantity';

  const patterns = [
    /(?:net\s*(?:wt|weight|qty|quantity|content|vol|volume)\.?)\s*[:\-]?\s*([\d.,]+\s*(?:g|gm|gms|gram|grams|kg|kgs|kilogram|ml|mL|l|ltr|litre|liter|cm|mm|m|pieces?|pcs?|units?|nos?|n)\b)/i,
    /(?:contents?\s*[:\-]?)\s*([\d.,]+\s*(?:g|gm|kg|ml|l|ltr)\b)/i,
    /([\d.,]+\s*(?:g|kg|ml|l)\b)\s*(?:net|e\b)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      let val = normalizeQuantity(m[1].trim());
      return makeDeclaration(field, label, val, 92 * confMul, 'detected');
    }
  }

  return notDetected(field, label);
}

function normalizeQuantity(raw) {
  // Normalize common quantity representations
  let val = raw.replace(/,/g, '').trim();
  val = val.replace(/\bgm(s)?\b/gi, 'g');
  val = val.replace(/\bgram(s)?\b/gi, 'g');
  val = val.replace(/\bkilogram(s)?\b/gi, 'kg');
  val = val.replace(/\bkgs\b/gi, 'kg');
  val = val.replace(/\bltr\b/gi, 'L');
  val = val.replace(/\blitre(s)?\b/gi, 'L');
  val = val.replace(/\bliter(s)?\b/gi, 'L');
  val = val.replace(/\bml\b/gi, 'ml');
  val = val.replace(/\bpieces?\b/gi, 'pcs');
  val = val.replace(/\bnos?\b/gi, 'N');
  // Add space between number and unit if missing
  val = val.replace(/(\d)\s*([a-zA-Z])/g, '$1 $2');
  return val;
}

function extractMRP(text, confMul) {
  const field = 'mrp';
  const label = 'MRP (Maximum Retail Price)';

  const patterns = [
    /(?:m\.?\s*r\.?\s*p\.?|maximum\s*retail\s*price)\s*[:\-]?\s*(?:rs\.?|₹|inr|rp)?\s*[:\-]?\s*([\d,]+(?:\.\d{1,2})?)\s*\/?-?/i,
    /(?:rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\/\-|only|incl)/i,
    /(?:price|mrp)\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const numVal = m[1].replace(/,/g, '');
      const price = parseFloat(numVal);
      if (price > 0 && price < 100000) {
        const inclTax = /incl/i.test(text) ? ' (Incl. of all taxes)' : '';
        return makeDeclaration(field, label, `Rs. ${price.toFixed(2)}${inclTax}`, 95 * confMul, 'detected');
      }
    }
  }

  return notDetected(field, label);
}

function extractManufacturingDate(text, confMul) {
  const field = 'manufacturingDate';
  const label = 'Manufacturing / Packing Date';

  const patterns = [
    /(?:mfg\.?\s*(?:d(?:ate|t)?)?|mfd\.?\s*(?:d(?:ate|t)?)?|manufactur(?:ed?|ing)\s*(?:date|on)?|pkg\.?\s*(?:d(?:ate|t)?)?|pack(?:ed|ing)\s*(?:date|on)?|date\s*of\s*(?:mfg|manufacture|packing|packaging))\s*[:\-.]?\s*(\d{1,2}\s*[\/\-\.]\s*\d{1,2}\s*[\/\-\.]\s*\d{2,4}|\w{3,9}\s*[,']?\s*\d{2,4}|\d{1,2}\s*[\/\-]\s*\d{2,4})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      return makeDeclaration(field, label, m[1].trim(), 85 * confMul, 'detected');
    }
  }

  return notDetected(field, label);
}

function extractBestBefore(text, confMul) {
  const field = 'bestBefore';
  const label = 'Best Before / Expiry Date';

  const patterns = [
    /(?:best\s*before|best\s*by|exp(?:iry)?\s*(?:date)?|use\s*by|use\s*before|bb)\s*[:\-.]?\s*(\d{1,2}\s*[\/\-\.]\s*\d{1,2}\s*[\/\-\.]\s*\d{2,4}|\d+\s*months?\s*(?:from\s*(?:mfg|manufacture|packing|packaging))?|\w{3,9}\s*[,']?\s*\d{2,4}|\d{1,2}\s*[\/\-]\s*\d{2,4})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      return makeDeclaration(field, label, m[1].trim(), 85 * confMul, 'detected');
    }
  }

  return notDetected(field, label);
}

function extractCountryOfOrigin(text, confMul) {
  const field = 'countryOfOrigin';
  const label = 'Country of Origin';

  const patterns = [
    /(?:country\s*of\s*origin|origin\s*country)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
    /(?:made\s*in|product\s*of|produced\s*in|assembled\s*in)\s*[:\-]?\s*([A-Za-z\s]{3,30})/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const country = m[1].split(/\n/)[0].trim().replace(/[,;.]+$/, '');
      return makeDeclaration(field, label, country, 90 * confMul, 'detected');
    }
  }

  return notDetected(field, label);
}

function extractConsumerCare(text, confMul) {
  const field = 'consumerCare';
  const label = 'Consumer Care Details';

  // Look for consumer care section
  const sectionMatch = text.match(
    /(?:consumer\s*(?:care|helpline|grievance|complaint)|customer\s*(?:care|service|support|helpline)|grievance|toll\s*free|helpline)\s*[:\-]?\s*(.{5,200})/i
  );

  if (sectionMatch) {
    let val = sectionMatch[1].split(/\n/).slice(0, 2).join(', ').trim();
    val = val.replace(/[,;.]+$/, '');
    return makeDeclaration(field, label, val, 88 * confMul, 'detected');
  }

  // Look for phone numbers (Indian format)
  const phoneMatch = text.match(
    /(?:(?:tel|ph|phone|call|contact|mob|mobile)\s*[:\-.]?\s*)?((?:\+91[\s\-]?|0)?[1-9]\d{9,10}|1800[\s\-]?\d{3}[\s\-]?\d{3,4})/i
  );

  // Look for email
  const emailMatch = text.match(
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i
  );

  if (phoneMatch || emailMatch) {
    const parts = [];
    if (phoneMatch) parts.push(phoneMatch[1].trim());
    if (emailMatch) parts.push(emailMatch[0].trim());
    return makeDeclaration(field, label, parts.join(', '), 75 * confMul, 'needs_review');
  }

  return notDetected(field, label);
}

function extractUnitSalePrice(text, confMul) {
  const field = 'unitSalePrice';
  const label = 'Unit Sale Price';

  const m = text.match(
    /(?:unit\s*(?:sale)?\s*price|price\s*per\s*(?:unit|g|kg|ml|l|piece))\s*[:\-]?\s*(?:rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:per\s*)?(?:\/\s*)?(g|kg|ml|l|unit|piece|pc)?/i
  );

  if (m) {
    const price = m[1].replace(/,/g, '');
    const unit = m[2] || '';
    return makeDeclaration(field, label, `Rs. ${price}${unit ? ' per ' + unit : ''}`, 80 * confMul, 'detected');
  }

  return notDetected(field, label);
}

function extractFSSAILicense(text, confMul) {
  const field = 'fssaiLicense';
  const label = 'FSSAI License';

  const m = text.match(
    /(?:fssai|lic\.?\s*no\.?|license\s*(?:no\.?|number)?)\s*[:\-.]?\s*(\d{10,14})/i
  );

  if (m) {
    return makeDeclaration(field, label, m[1].trim(), 90 * confMul, 'detected');
  }

  return notDetected(field, label);
}

function extractBatchNumber(text, confMul) {
  const field = 'batchNumber';
  const label = 'Batch / Lot Number';

  const m = text.match(
    /(?:batch\s*(?:no\.?|number)?|lot\s*(?:no\.?|number)?|b\.?\s*no\.?)\s*[:\-.]?\s*([A-Za-z0-9\-\/]{3,20})/i
  );

  if (m) {
    return makeDeclaration(field, label, m[1].trim(), 85 * confMul, 'detected');
  }

  return notDetected(field, label);
}
