/* ─────────────────────────────────────────────
   Compliance Engine
   Rule-based checker for Legal Metrology
   (Packaged Commodities) Rules, 2011
   Including Date & Expiry Engine
   ───────────────────────────────────────────── */

/** Required declarations under Legal Metrology Rules */
const MANDATORY_FIELDS = [
  { field: 'productName', weight: 15, severity: 'high' },
  { field: 'manufacturer', weight: 15, severity: 'high' },
  { field: 'netQuantity', weight: 15, severity: 'high' },
  { field: 'mrp', weight: 15, severity: 'high' },
  { field: 'manufacturingDate', weight: 10, severity: 'medium' },
  { field: 'consumerCare', weight: 10, severity: 'medium' },
  { field: 'countryOfOrigin', weight: 8, severity: 'medium' },
  { field: 'bestBefore', weight: 7, severity: 'low' },
  { field: 'fssaiLicense', weight: 5, severity: 'low' },
];

const MONTH_NAMES = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Parse a date string from packaging labels.
 * Handles MM/YYYY, DD/MM/YYYY, MM-YYYY, Month YYYY, etc.
 * @param {string} rawStr
 * @returns {{ year: number, month: number, day: number, hasDay: boolean, isValid: boolean, date: Date } | null}
 */
export function parseDateString(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;

  // Clean string
  let str = rawStr
    .replace(/(?:mfg\.?|mfd\.?|pkg\.?|best before|best by|exp\.?|date|on|of|pkd\.?|packed)\s*[:\-.]?\s*/gi, '')
    .trim();

  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1990 && year <= 2099) {
      return { year, month, day, hasDay: true, isValid: true, date: new Date(year, month, day) };
    }
  }

  // Pattern 2: MM/YYYY or MM-YYYY or MM.YYYY (standard Rule 6(1)(d) format)
  const myMatch = str.match(/^(\d{1,2})[\/\-\.](\d{2,4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1], 10) - 1;
    let year = parseInt(myMatch[2], 10);
    if (year < 100) year += 2000;

    if (month >= 0 && month <= 11 && year >= 1990 && year <= 2099) {
      // Use end of month for validity calculations
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      return { year, month, day: lastDayOfMonth, hasDay: false, isValid: true, date: new Date(year, month, lastDayOfMonth) };
    }
  }

  // Pattern 3: Month YYYY or Mon YYYY (e.g. "March 2026", "Mar 2026", "Jan '26")
  const namedMatch = str.match(/^([A-Za-z]{3,9})\s*[,']?\s*(\d{2,4})$/i);
  if (namedMatch) {
    const monKey = namedMatch[1].toLowerCase().substring(0, 3);
    if (monKey in MONTH_NAMES) {
      const month = MONTH_NAMES[monKey];
      let year = parseInt(namedMatch[2], 10);
      if (year < 100) year += 2000;

      if (year >= 1990 && year <= 2099) {
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        return { year, month, day: lastDayOfMonth, hasDay: false, isValid: true, date: new Date(year, month, lastDayOfMonth) };
      }
    }
  }

  // Pattern 4: DD Month YYYY (e.g. "15 March 2026" or "15-Mar-2026")
  const dNamedYMatch = str.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/,']+(\d{2,4})$/i);
  if (dNamedYMatch) {
    const day = parseInt(dNamedYMatch[1], 10);
    const monKey = dNamedYMatch[2].toLowerCase().substring(0, 3);
    if (monKey in MONTH_NAMES) {
      const month = MONTH_NAMES[monKey];
      let year = parseInt(dNamedYMatch[3], 10);
      if (year < 100) year += 2000;

      if (day >= 1 && day <= 31 && year >= 1990 && year <= 2099) {
        return { year, month, day, hasDay: true, isValid: true, date: new Date(year, month, day) };
      }
    }
  }

  return { isValid: false, raw: rawStr };
}

/**
 * Parse relative shelf-life durations like "12 months from packaging", "180 days", "2 years".
 * @param {string} rawStr
 * @returns {{ type: 'months'|'days'|'years', value: number, totalMonths: number } | null}
 */
export function parseShelfLifeDuration(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;

  // Check months: e.g. "12 months", "12 months from mfg"
  const mMatch = rawStr.match(/(\d+)\s*months?/i);
  if (mMatch) {
    const val = parseInt(mMatch[1], 10);
    return { type: 'months', value: val, totalMonths: val };
  }

  // Check years: e.g. "2 years", "1 year"
  const yMatch = rawStr.match(/(\d+)\s*years?/i);
  if (yMatch) {
    const val = parseInt(yMatch[1], 10);
    return { type: 'years', value: val, totalMonths: val * 12 };
  }

  // Check days: e.g. "180 days", "90 days"
  const dMatch = rawStr.match(/(\d+)\s*days?/i);
  if (dMatch) {
    const val = parseInt(dMatch[1], 10);
    return { type: 'days', value: val, totalMonths: Math.round(val / 30) };
  }

  return null;
}

/**
 * Format a Date object as DD/MM/YYYY or MM/YYYY.
 */
function formatDateDisplay(d, hasDay = false) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '—';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (hasDay) {
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }
  return `${month}/${year}`;
}

/**
 * Date & Expiry Engine: Evaluate manufacturing date, shelf life, expiration status, and format conformity.
 * @param {Object} mfgDecl - Manufacturing date declaration object
 * @param {Object} expDecl - Best before / Expiry date declaration object
 * @param {Date} referenceDate - Current audit date (default: new Date())
 * @returns {Object} Full date assessment results & violations
 */
export function evaluateDateCompliance(mfgDecl, expDecl, referenceDate = new Date()) {
  const violations = [];
  let mfgParsed = null;
  let computedExpiry = null;
  let expiryStatus = 'unknown'; // 'safe', 'near_expiry', 'expired', 'unknown', 'future_dated'
  let daysToExpiry = null;
  let shelfLifeText = null;

  // 1. Evaluate Manufacturing Date
  if (mfgDecl && mfgDecl.value && mfgDecl.status !== 'not_detected') {
    mfgParsed = parseDateString(mfgDecl.value);

    if (mfgParsed && mfgParsed.isValid) {
      // Check for Future Manufacturing Date (Post-dating Fraud)
      // Allow slight 3-day buffer for timezone / clock variations
      const bufferDate = new Date(referenceDate.getTime() + 3 * 24 * 60 * 60 * 1000);
      if (mfgParsed.date > bufferDate) {
        expiryStatus = 'future_dated';
        violations.push({
          field: 'manufacturingDate',
          label: 'Future Manufacturing Date Anomaly',
          severity: 'high',
          status: 'future_dated',
          message: `Manufacturing date (${mfgDecl.value}) is in the future relative to the inspection date (${formatDateDisplay(referenceDate, true)}). Post-dating package labels is a violation under Legal Metrology Rule 6(1)(d).`,
          confidence: 94,
        });
      }
    } else {
      // Format issue under Rule 6(1)(d)
      violations.push({
        field: 'manufacturingDate',
        label: 'Manufacturing Date Format Issue',
        severity: 'low',
        status: 'format_issue',
        message: `Manufacturing date "${mfgDecl.value}" does not clearly follow standard Month & Year format (e.g., MM/YYYY or Month YYYY) as required under Rule 6(1)(d).`,
        confidence: 85,
      });
    }
  }

  // 2. Evaluate Best Before / Expiry Date
  if (expDecl && expDecl.value && expDecl.status !== 'not_detected') {
    const shelfLife = parseShelfLifeDuration(expDecl.value);

    if (shelfLife && mfgParsed && mfgParsed.isValid) {
      // Calculate expiry date from Mfg Date + Shelf Life Duration
      shelfLifeText = expDecl.value;
      const expDate = new Date(mfgParsed.date.getTime());
      if (shelfLife.type === 'days') {
        expDate.setDate(expDate.getDate() + shelfLife.value);
      } else {
        expDate.setMonth(expDate.getMonth() + shelfLife.totalMonths);
      }
      computedExpiry = {
        date: expDate,
        formatted: formatDateDisplay(expDate, mfgParsed.hasDay),
        isComputed: true,
      };
    } else {
      // Check if expDecl is an explicit date string (e.g. "03/2027" or "15/09/2026")
      const directExpParsed = parseDateString(expDecl.value);
      if (directExpParsed && directExpParsed.isValid) {
        computedExpiry = {
          date: directExpParsed.date,
          formatted: formatDateDisplay(directExpParsed.date, directExpParsed.hasDay),
          isComputed: false,
        };
      }
    }
  }

  // 3. Expiration Risk Calculation
  if (computedExpiry && computedExpiry.date) {
    const diffTime = computedExpiry.date.getTime() - referenceDate.getTime();
    daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysToExpiry < 0) {
      expiryStatus = 'expired';
      violations.push({
        field: 'bestBefore',
        label: 'Product Expired Violation',
        severity: 'high',
        status: 'expired',
        message: `Product is EXPIRED. Expiry date was ${computedExpiry.formatted} (${Math.abs(daysToExpiry)} days ago). Selling or distributing expired pre-packaged commodities violates consumer protection and Legal Metrology standards.`,
        confidence: 96,
      });
    } else if (daysToExpiry <= 30) {
      expiryStatus = 'near_expiry';
      violations.push({
        field: 'bestBefore',
        label: 'Near Expiry Warning',
        severity: 'medium',
        status: 'near_expiry',
        message: `Product is NEAR EXPIRY. Expires on ${computedExpiry.formatted} (in ${daysToExpiry} days). Verification for shelf stock clearance recommended.`,
        confidence: 90,
      });
    } else {
      if (expiryStatus !== 'future_dated') {
        expiryStatus = 'safe';
      }
    }
  }

  return {
    mfgDate: mfgParsed && mfgParsed.isValid ? formatDateDisplay(mfgParsed.date, mfgParsed.hasDay) : mfgDecl?.value || null,
    expiryDate: computedExpiry ? computedExpiry.formatted : null,
    expiryDateObj: computedExpiry ? computedExpiry.date.toISOString() : null,
    isComputedExpiry: computedExpiry ? computedExpiry.isComputed : false,
    shelfLife: shelfLifeText,
    daysToExpiry,
    expiryStatus,
    isExpired: expiryStatus === 'expired',
    isNearExpiry: expiryStatus === 'near_expiry',
    isFutureDated: expiryStatus === 'future_dated',
    violations,
  };
}

/**
 * Evaluate compliance of extracted declarations.
 * @param {Array} declarations — from extractDeclarations()
 * @param {number} ocrConfidence — overall OCR confidence (0-100)
 * @returns {{ overallScore, status, categories, violations, dateAssessment }}
 */
export function evaluateCompliance(declarations, ocrConfidence = 70) {
  const declMap = {};
  declarations.forEach((d) => { declMap[d.field] = d; });

  /* ── 1. Mandatory Declarations Score ── */
  let mandatoryEarned = 0;
  let mandatoryTotal = 0;
  const violations = [];

  for (const rule of MANDATORY_FIELDS) {
    mandatoryTotal += rule.weight;
    const decl = declMap[rule.field];

    if (!decl || decl.status === 'not_detected') {
      // Violation: mandatory field missing
      violations.push({
        field: rule.field,
        label: decl?.label || rule.field,
        severity: rule.severity,
        status: 'not_detected',
        message: `${decl?.label || rule.field} was not detected on the package label. This is a mandatory declaration under Legal Metrology Rules.`,
        confidence: 91,
      });
    } else if (decl.status === 'needs_review') {
      mandatoryEarned += rule.weight * 0.5;
      violations.push({
        field: rule.field,
        label: decl.label,
        severity: 'low',
        status: 'needs_review',
        message: `${decl.label} was detected but could not be confidently verified. Officer review recommended.`,
        confidence: decl.confidence,
      });
    } else {
      mandatoryEarned += rule.weight;
      // Check for format issues on detected fields
      const formatIssue = checkFormatIssues(decl);
      if (formatIssue) {
        mandatoryEarned -= rule.weight * 0.15;
        violations.push(formatIssue);
      }
    }
  }

  /* ── 2. Date & Expiry Engine Evaluation ── */
  const mfgDecl = declMap['manufacturingDate'];
  const expDecl = declMap['bestBefore'];
  const dateAssessment = evaluateDateCompliance(mfgDecl, expDecl);

  // Add date-specific violations & apply score penalties
  if (dateAssessment.violations.length > 0) {
    for (const dateVio of dateAssessment.violations) {
      // Avoid duplicate field messages if already covered by format issue
      violations.push(dateVio);
      if (dateVio.severity === 'high') {
        mandatoryEarned = Math.max(0, mandatoryEarned - 25);
      } else if (dateVio.severity === 'medium') {
        mandatoryEarned = Math.max(0, mandatoryEarned - 10);
      }
    }
  }

  const mandatoryScore = Math.max(0, Math.round((mandatoryEarned / mandatoryTotal) * 100));

  /* ── 3. Readability Score ── */
  const readabilityScore = Math.min(100, Math.round(ocrConfidence * 1.15));

  /* ── 4. Formatting Score ── */
  let formattingDeductions = 0;
  const detectedCount = declarations.filter((d) => d.status === 'detected').length;
  const needsReviewCount = declarations.filter((d) => d.status === 'needs_review').length;

  if (needsReviewCount > 0) {
    formattingDeductions += needsReviewCount * 5;
  }
  if (detectedCount < 4) {
    formattingDeductions += 15;
  }
  const formattingScore = Math.max(0, Math.min(100, 100 - formattingDeductions));

  /* ── 5. Overall Score ── */
  const overallScore = Math.round(
    mandatoryScore * 0.60 + readabilityScore * 0.20 + formattingScore * 0.20
  );

  /* ── 6. Status Determination ── */
  let status;
  const highViolations = violations.filter((v) => v.severity === 'high');

  if (highViolations.length >= 2 || dateAssessment.isExpired || dateAssessment.isFutureDated) {
    status = 'violation';
  } else if (overallScore >= 85 && highViolations.length === 0) {
    status = 'compliant';
  } else {
    status = 'needs_review';
  }

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    status,
    categories: {
      mandatory: { score: mandatoryScore, label: 'Mandatory Declarations' },
      readability: { score: readabilityScore, label: 'Readability' },
      formatting: { score: formattingScore, label: 'Formatting' },
    },
    violations,
    dateAssessment,
  };
}

/**
 * Check for format issues on a detected declaration.
 */
function checkFormatIssues(decl) {
  if (decl.field === 'mrp') {
    // MRP should mention "Incl. of all taxes"
    if (decl.value && !/(incl|tax)/i.test(decl.value)) {
      return {
        field: decl.field,
        label: decl.label,
        severity: 'low',
        status: 'format_issue',
        message: 'MRP declaration should state "Inclusive of all taxes" as per Legal Metrology Rules.',
        confidence: decl.confidence,
      };
    }
  }

  if (decl.field === 'netQuantity') {
    // Net quantity should be in standard metric units
    if (decl.value && /oz|ounce|pound|lb/i.test(decl.value)) {
      return {
        field: decl.field,
        label: decl.label,
        severity: 'medium',
        status: 'format_issue',
        message: 'Net quantity must be declared in standard metric units (g, kg, ml, L) as per Legal Metrology Rules.',
        confidence: decl.confidence,
      };
    }
  }

  return null;
}

/**
 * Compare package declarations with e-commerce listing.
 */
export function compareDeclarations(packageDeclarations, ecomDeclarations) {
  const mismatches = [];
  const matches = [];
  const missingInEcommerce = [];
  const comparisons = [];

  for (const pkgDecl of packageDeclarations) {
    if (pkgDecl.status === 'not_detected') continue;

    const ecomDecl = ecomDeclarations.find((d) => d.field === pkgDecl.field);
    if (!ecomDecl || ecomDecl.status === 'not_detected') {
      const item = {
        field: pkgDecl.field,
        label: pkgDecl.label,
        packageValue: pkgDecl.value,
        ecomValue: null,
        match: 'missing',
      };
      comparisons.push(item);
      missingInEcommerce.push(item);
      continue;
    }

    const isMatch = valuesMatch(pkgDecl, ecomDecl);
    const item = {
      field: pkgDecl.field,
      label: pkgDecl.label,
      packageValue: pkgDecl.value,
      ecomValue: ecomDecl.value,
      match: isMatch ? 'match' : 'mismatch',
    };
    comparisons.push(item);

    if (isMatch) {
      matches.push({
        field: pkgDecl.field,
        label: pkgDecl.label,
        packageValue: pkgDecl.value,
        ecommerceValue: ecomDecl.value,
      });
    } else {
      mismatches.push({
        field: pkgDecl.field,
        label: pkgDecl.label,
        packageValue: pkgDecl.value,
        ecommerceValue: ecomDecl.value,
      });
    }
  }

  return {
    comparisons,
    mismatches,
    matches,
    missingInEcommerce,
    mismatchCount: mismatches.length,
  };
}

function valuesMatch(decl1, decl2) {
  if (!decl1.value || !decl2.value) return false;

  const v1 = decl1.value.toLowerCase().replace(/[^a-z0-9.]/g, '');
  const v2 = decl2.value.toLowerCase().replace(/[^a-z0-9.]/g, '');

  return v1 === v2;
}

