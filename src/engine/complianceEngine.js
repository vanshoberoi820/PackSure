/* ─────────────────────────────────────────────
   Compliance Engine
   Rule-based checker for Legal Metrology
   (Packaged Commodities) Rules, 2011
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

/**
 * Evaluate compliance of extracted declarations.
 * @param {Array} declarations — from extractDeclarations()
 * @param {number} ocrConfidence — overall OCR confidence (0-100)
 * @returns {{ overallScore, status, categories, violations }}
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

  const mandatoryScore = Math.round((mandatoryEarned / mandatoryTotal) * 100);

  /* ── 2. Readability Score ── */
  const readabilityScore = Math.min(100, Math.round(ocrConfidence * 1.15));

  /* ── 3. Formatting Score ── */
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

  /* ── 4. Overall Score ── */
  const overallScore = Math.round(
    mandatoryScore * 0.60 + readabilityScore * 0.20 + formattingScore * 0.20
  );

  /* ── 5. Status Determination ── */
  let status;
  const highViolations = violations.filter((v) => v.severity === 'high');

  if (highViolations.length >= 2) {
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
  const comparisons = [];

  for (const pkgDecl of packageDeclarations) {
    if (pkgDecl.status === 'not_detected') continue;

    const ecomDecl = ecomDeclarations.find((d) => d.field === pkgDecl.field);
    if (!ecomDecl || ecomDecl.status === 'not_detected') {
      comparisons.push({
        field: pkgDecl.field,
        label: pkgDecl.label,
        packageValue: pkgDecl.value,
        ecomValue: null,
        match: 'missing',
      });
      continue;
    }

    const match = valuesMatch(pkgDecl, ecomDecl);
    comparisons.push({
      field: pkgDecl.field,
      label: pkgDecl.label,
      packageValue: pkgDecl.value,
      ecomValue: ecomDecl.value,
      match: match ? 'match' : 'mismatch',
    });

    if (!match) {
      mismatches.push({
        field: pkgDecl.field,
        label: pkgDecl.label,
        packageValue: pkgDecl.value,
        ecomValue: ecomDecl.value,
      });
    }
  }

  return { comparisons, mismatches, mismatchCount: mismatches.length };
}

function valuesMatch(decl1, decl2) {
  if (!decl1.value || !decl2.value) return false;

  const v1 = decl1.value.toLowerCase().replace(/[^a-z0-9.]/g, '');
  const v2 = decl2.value.toLowerCase().replace(/[^a-z0-9.]/g, '');

  return v1 === v2;
}
