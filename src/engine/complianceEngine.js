/* ─────────────────────────────────────────────
   Compliance Engine — Legal Metrology (Packaged Commodities) Rules, 2011
   Rule 6 Statutory Compliance Assessment with weight/measure/number evaluation
   ───────────────────────────────────────────── */

export const LEGAL_METROLOGY_RULES = [
  {
    field: 'productName',
    rule: 'Rule 6(1)(b)',
    ruleName: 'Commodity Common / Generic Name',
    requirement: 'The generic or common name of the commodity contained in the package.',
    weight: 15,
    severity: 'high',
  },
  {
    field: 'manufacturer',
    rule: 'Rule 6(1)(a)',
    ruleName: 'Manufacturer / Packer Identity & Address',
    requirement: 'Name and complete address of the manufacturer, packer, or importer.',
    weight: 15,
    severity: 'high',
  },
  {
    field: 'netQuantity',
    rule: 'Rule 6(1)(c)',
    ruleName: 'Net Quantity Declaration',
    requirement: 'Net quantity in standard units of weight, measure/volume, or number/pages.',
    weight: 15,
    severity: 'high',
  },
  {
    field: 'mrp',
    rule: 'Rule 6(1)(e)',
    ruleName: 'Maximum Retail Price (MRP)',
    requirement: 'Maximum Retail Price inclusive of all taxes in Indian Rupees (Rs. or ₹).',
    weight: 15,
    severity: 'high',
  },
  {
    field: 'manufacturingDate',
    rule: 'Rule 6(1)(d)',
    ruleName: 'Month & Year of Manufacture / Packing',
    requirement: 'Month and year in which the commodity is manufactured, packed, or imported.',
    weight: 15,
    severity: 'high',
  },
  {
    field: 'consumerCare',
    rule: 'Rule 6(1)(n)',
    ruleName: 'Consumer Care Details',
    requirement: 'Name, address, telephone number, email, or website for consumer grievance redressal.',
    weight: 10,
    severity: 'medium',
  },
  {
    field: 'countryOfOrigin',
    rule: 'Rule 6(1)(g)',
    ruleName: 'Country of Origin',
    requirement: 'Country of origin or manufacture for pre-packaged commodities.',
    weight: 10,
    severity: 'medium',
  },
  {
    field: 'importer',
    rule: 'Rule 6(1)(a)',
    ruleName: 'Importer Details (for Imported Goods)',
    requirement: 'Name and address of importer if commodity is imported.',
    weight: 2,
    severity: 'low',
    conditional: true,
  },
  {
    field: 'bestBefore',
    rule: 'Rule 6(1)(d) proviso',
    ruleName: 'Best Before / Expiry Date',
    requirement: 'Mandatory best before or expiry date for commodities that become unfit over time.',
    weight: 10,
    severity: 'medium',
    conditional: true,
  },
];

export function identifyCommodityCategory(productName = '', rawText = '') {
  const text = `${productName} ${rawText}`.toLowerCase();

  const foodKeywords = [
    'rice', 'wheat', 'flour', 'atta', 'maida', 'besan', 'dal', 'pulse', 'grain', 'cereal',
    'biscuit', 'cookie', 'bread', 'cake', 'bakery', 'snack', 'chips', 'namkeen', 'noodle', 'pasta',
    'milk', 'dairy', 'butter', 'cheese', 'paneer', 'ghee', 'curd', 'yogurt', 'cream',
    'oil', 'edible', 'mustard', 'sunflower', 'olive', 'spice', 'masala', 'turmeric', 'chilli',
    'coriander', 'salt', 'sugar', 'jaggery', 'tea', 'coffee', 'juice', 'beverage', 'drink', 'water',
    'soda', 'syrup', 'squash', 'chocolate', 'candy', 'sweet', 'confectionery', 'honey', 'jam',
    'sauce', 'ketchup', 'pickle', 'meat', 'chicken', 'fish', 'egg', 'seafood', 'frozen', 'almond',
    'cashew', 'raisin', 'nut', 'ingredient', 'ingredients', 'nutrition', 'nutritional', 'fssai',
    'vegetarian', 'non-vegetarian', 'protein', 'fat', 'carbohydrate', 'flavor', 'flavour'
  ];

  const cosmeticPharmaKeywords = [
    'cream', 'lotion', 'serum', 'shampoo', 'conditioner', 'face wash', 'body wash', 'soap',
    'sunscreen', 'hair oil', 'perfume', 'deodorant', 'deo', 'toothpaste', 'mouthwash',
    'tablet', 'capsule', 'syrup', 'ointment', 'medicine', 'drug', 'pharmaceutical', 'antiseptic',
    'vitamin', 'supplement', 'ayurvedic', 'herbal', 'sanitizer', 'disinfectant', 'detergent',
    'pesticide', 'insecticide', 'chemical'
  ];

  const nonPerishableKeywords = [
    'notebook', 'stationery', 'paper', 'book', 'pages', 'diary', 'register', 'pen', 'pencil',
    'eraser', 'sharpener', 'ruler', 'scale', 'scissor', 'stapler', 'folder', 'envelope',
    'cable', 'charger', 'adapter', 'usb', 'headphone', 'earphone', 'earbuds', 'mouse', 'keyboard',
    'led', 'bulb', 'wire', 'phone', 'laptop', 'camera', 'electronic', 'appliance', 'hardware',
    'shirt', 't-shirt', 'tshirt', 'trousers', 'jeans', 'pant', 'socks', 'garment', 'apparel', 'textile',
    'fabric', 'cotton', 'silk', 'polyester', 'wool', 'shoe', 'shoes', 'footwear', 'sandal', 'slipper',
    'cookware', 'pan', 'pot', 'utensil', 'plate', 'spoon', 'fork', 'knife', 'steel', 'plastic container',
    'bucket', 'bottle', 'mug', 'cup', 'glassware', 'screw', 'tool', 'screwdriver', 'wrench',
    'bag', 'backpack', 'wallet', 'belt', 'luggage', 'suitcase', 'toy', 'board game', 'furniture'
  ];

  if (foodKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text))) {
    return {
      isExpiryApplicable: true,
      category: 'food_beverage',
      categoryName: 'Food & Beverage',
      reason: 'Food & edible commodities can become unfit for consumption and mandate Best Before / Expiry declaration under Rule 6(1)(d) proviso.',
    };
  }

  if (cosmeticPharmaKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text))) {
    return {
      isExpiryApplicable: true,
      category: 'pharma_cosmetic',
      categoryName: 'Cosmetics / Pharma / Consumable',
      reason: 'Cosmetics, health, and chemical products have active ingredient efficacy and mandate an Expiry / Use-by date under Rule 6(1)(d).',
    };
  }

  if (nonPerishableKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(text))) {
    return {
      isExpiryApplicable: false,
      category: 'non_perishable_durable',
      categoryName: 'Non-Perishable / Durable Commodity',
      reason: 'Durable & non-perishable commodities (e.g. stationery, notebooks, hardware) are exempt from Best Before / Expiry declaration under Legal Metrology Rule 6(1)(d) proviso.',
    };
  }

  if (/(?:ingredient|best\s*before|use\s*by|expiry|exp\.|nutrition|dietary)/i.test(text)) {
    return {
      isExpiryApplicable: true,
      category: 'consumable',
      categoryName: 'Consumable Commodity',
      reason: 'Packaging indicates consumable ingredients requiring date verification under Rule 6(1)(d).',
    };
  }

  return {
    isExpiryApplicable: false,
    category: 'general_manufactured',
    categoryName: 'General Manufactured Commodity',
    reason: 'Standard non-perishable manufactured commodity where Best Before / Expiry is not mandatory under Rule 6(1)(d).',
  };
}

const MONTH_NAMES = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export function parseDateString(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;

  let str = rawStr
    .replace(/(?:mfg\.?|mfd\.?|pkg\.?|best before|best by|exp\.?|date|on|of|pkd\.?|packed)\s*[:\-.]?\s*/gi, '')
    .trim();

  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1990 && year <= 2099) {
      return { year, month, day, hasDay: true, isValid: true, date: new Date(year, month, day) };
    }
  }

  const myMatch = str.match(/^(\d{1,2})[\/\-\.](\d{2,4})$/);
  if (myMatch) {
    const month = parseInt(myMatch[1], 10) - 1;
    let year = parseInt(myMatch[2], 10);
    if (year < 100) year += 2000;

    if (month >= 0 && month <= 11 && year >= 1990 && year <= 2099) {
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      return { year, month, day: lastDayOfMonth, hasDay: false, isValid: true, date: new Date(year, month, lastDayOfMonth) };
    }
  }

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

  return { isValid: false, raw: rawStr };
}

export function parseShelfLifeDuration(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;

  const mMatch = rawStr.match(/(\d+)\s*months?/i);
  if (mMatch) {
    const val = parseInt(mMatch[1], 10);
    return { type: 'months', value: val, totalMonths: val };
  }

  const yMatch = rawStr.match(/(\d+)\s*years?/i);
  if (yMatch) {
    const val = parseInt(yMatch[1], 10);
    return { type: 'years', value: val, totalMonths: val * 12 };
  }

  const dMatch = rawStr.match(/(\d+)\s*days?/i);
  if (dMatch) {
    const val = parseInt(dMatch[1], 10);
    return { type: 'days', value: val, totalMonths: Math.round(val / 30) };
  }

  return null;
}

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

export function evaluateDateCompliance(mfgDecl, expDecl, referenceDate = new Date(), commodityInfo = null) {
  const violations = [];
  let mfgParsed = null;
  let computedExpiry = null;
  let expiryStatus = 'unknown';
  let daysToExpiry = null;
  let shelfLifeText = null;

  const isApplicable = commodityInfo ? commodityInfo.isExpiryApplicable : true;

  if (mfgDecl && mfgDecl.value && mfgDecl.status !== 'not_detected') {
    mfgParsed = parseDateString(mfgDecl.value);

    if (mfgParsed && mfgParsed.isValid) {
      const bufferDate = new Date(referenceDate.getTime() + 3 * 24 * 60 * 60 * 1000);
      if (mfgParsed.date > bufferDate) {
        expiryStatus = 'future_dated';
        violations.push({
          field: 'manufacturingDate',
          rule: 'Rule 6(1)(d)',
          ruleName: 'Manufacturing Date Violation',
          label: 'Future Manufacturing Date Anomaly',
          severity: 'high',
          status: 'future_dated',
          requirement: 'Manufacturing date must represent the actual or past packing date.',
          message: `Manufacturing date (${mfgDecl.value}) is post-dated relative to audit date. Post-dating package labels is an offense under Legal Metrology Rule 6(1)(d).`,
          recommendation: 'Issue notice to manufacturer for post-dated packaging inquiry.',
          confidence: 94,
        });
      }
    }
  }

  const hasExpValue = expDecl && expDecl.value && expDecl.status !== 'not_detected' && expDecl.status !== 'not_applicable';

  if (!isApplicable && !hasExpValue) {
    expiryStatus = 'not_applicable';
  } else if (hasExpValue) {
    const shelfLife = parseShelfLifeDuration(expDecl.value);

    if (shelfLife && mfgParsed && mfgParsed.isValid) {
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

  if (computedExpiry && computedExpiry.date) {
    const diffTime = computedExpiry.date.getTime() - referenceDate.getTime();
    daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysToExpiry < 0) {
      expiryStatus = 'expired';
      violations.push({
        field: 'bestBefore',
        rule: 'Rule 6(1)(d) proviso',
        ruleName: 'Expired Product Prohibition',
        label: 'Product Expired Violation',
        severity: 'high',
        status: 'expired',
        requirement: 'Expired pre-packaged commodities cannot be offered for distribution or sale.',
        message: `Product is EXPIRED. Expiry date was ${computedExpiry.formatted} (${Math.abs(daysToExpiry)} days ago). Distribution violates packaging standards under Rule 6(1)(d).`,
        recommendation: 'Immediate confiscation and seizure of shelf stock required.',
        confidence: 96,
      });
    } else if (daysToExpiry <= 30) {
      expiryStatus = 'near_expiry';
      violations.push({
        field: 'bestBefore',
        rule: 'Rule 6(1)(d) proviso',
        ruleName: 'Near Expiry Advisory',
        label: 'Near Expiry Warning',
        severity: 'medium',
        status: 'near_expiry',
        requirement: 'Stock must be cleared before declared expiry threshold.',
        message: `Product is NEAR EXPIRY. Expires on ${computedExpiry.formatted} (${daysToExpiry} days remaining).`,
        recommendation: 'Verify shelf life clearance schedule with retailer.',
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
    isNotApplicable: expiryStatus === 'not_applicable',
    isExpiryApplicable: isApplicable,
    commodityCategory: commodityInfo?.categoryName || 'General Commodity',
    applicabilityReason: commodityInfo?.reason || '',
    violations,
  };
}

export function evaluateCompliance(declarations, ocrConfidence = 75, rawOcrText = '') {
  const declMap = {};
  declarations.forEach((d) => { declMap[d.field] = d; });

  const productName = declMap['productName']?.value || '';
  const commodityInfo = identifyCommodityCategory(productName, rawOcrText);

  const mfgDecl = declMap['manufacturingDate'];
  const expDecl = declMap['bestBefore'];
  const dateAssessment = evaluateDateCompliance(mfgDecl, expDecl, new Date(), commodityInfo);

  let mandatoryEarned = 0;
  let mandatoryTotal = 0;
  const violations = [];

  for (const rule of LEGAL_METROLOGY_RULES) {
    const decl = declMap[rule.field];

    mandatoryTotal += rule.weight;

    if (rule.field === 'importer') {
      const countryVal = (declMap['countryOfOrigin']?.value || '').toLowerCase();
      const isImported = countryVal && !/india|ind\b|bharat/i.test(countryVal);
      if (!isImported && (!decl || decl.status === 'not_detected')) {
        // Domestic product: Importer declaration is exempt, award full weight without penalty
        mandatoryEarned += rule.weight;
        continue;
      }
    }

    if (rule.field === 'bestBefore') {
      if (!commodityInfo.isExpiryApplicable) {
        mandatoryEarned += rule.weight;
        if (decl && (decl.status === 'not_detected' || !decl.value)) {
          decl.status = 'not_applicable';
          decl.value = 'Not Applicable (Durable / Exempt)';
        }
        continue;
      }

      if (!decl || decl.status === 'not_detected') {
        violations.push({
          field: 'bestBefore',
          rule: rule.rule,
          ruleName: rule.ruleName,
          label: 'Missing Best Before / Expiry Date',
          severity: rule.severity,
          status: 'missing',
          requirement: rule.requirement,
          message: `Best Before / Expiry Date was not detected on this ${commodityInfo.categoryName} product. Under Rule 6(1)(d) proviso, expiry declaration is mandatory.`,
          recommendation: 'Verify if expiry date is stamped on package crimp/base.',
          confidence: 88,
        });
        continue;
      }
    }

    if (!decl || decl.status === 'not_detected') {
      const isDurable = !commodityInfo.isExpiryApplicable;
      const isSecondaryOnDurable = isDurable && (rule.field === 'manufacturingDate' || rule.field === 'batchNumber');

      violations.push({
        field: rule.field,
        rule: rule.rule,
        ruleName: rule.ruleName,
        label: `${decl?.label || rule.field} Missing`,
        severity: isSecondaryOnDurable ? 'low' : rule.severity,
        status: 'missing',
        requirement: rule.requirement,
        message: `${decl?.label || rule.field} was not detected on package label. Mandatory under ${rule.rule}.`,
        recommendation: `Check physical label for ${decl?.label || rule.field} declaration.`,
        confidence: 90,
      });
    } else if (decl.status === 'needs_review' || decl.status === 'uncertain') {
      mandatoryEarned += rule.weight * 0.85;
      violations.push({
        field: rule.field,
        rule: rule.rule,
        ruleName: rule.ruleName,
        label: `${decl.label} Verification Needed`,
        severity: 'low',
        status: 'needs_review',
        requirement: rule.requirement,
        message: `${decl.label} was detected ("${decl.value}") with partial OCR clarity. Officer confirmation recommended.`,
        recommendation: 'Inspect physical package to confirm extracted text.',
        confidence: decl.confidence || 60,
      });
    } else if (decl.status === 'conflicting') {
      mandatoryEarned += rule.weight * 0.7;
      violations.push({
        field: rule.field,
        rule: rule.rule,
        ruleName: rule.ruleName,
        label: `${decl.label} Conflict across Video Frames`,
        severity: 'medium',
        status: 'conflicting',
        requirement: rule.requirement,
        message: `Differing values were detected across video frames for ${decl.label}.`,
        recommendation: 'Perform manual officer verification of actual printed label.',
        confidence: 70,
      });
    } else if (decl.status === 'not_applicable') {
      mandatoryEarned += rule.weight;
    } else {
      // Detected successfully — award full points for this Legal Metrology declaration!
      mandatoryEarned += rule.weight;
    }
  }

  if (dateAssessment.violations.length > 0) {
    for (const dateVio of dateAssessment.violations) {
      violations.push(dateVio);
      if (dateVio.severity === 'high') {
        mandatoryEarned = Math.max(0, mandatoryEarned - 20);
      }
    }
  }

  // Calculate Sub-Scores
  const mandatoryScore = Math.max(0, Math.min(100, Math.round((mandatoryEarned / mandatoryTotal) * 100)));
  const readabilityScore = Math.min(100, Math.round((ocrConfidence || 75) * 1.15));

  // Alignment / formatting scoring — user requested reduced penalty impact
  let formattingDeductions = 0;
  const missingCount = declarations.filter((d) => d.status === 'not_detected').length;
  if (missingCount > 4) formattingDeductions += 10;
  const formattingScore = Math.max(0, Math.min(100, 100 - formattingDeductions));

  // Rebalanced weights: Mandatory Rule 6 declarations (80%), Readability (15%), Alignment/Formatting (5%)
  const overallScore = Math.round(
    mandatoryScore * 0.80 + readabilityScore * 0.15 + formattingScore * 0.05
  );

  let status;
  if (dateAssessment.isExpired || dateAssessment.isFutureDated || overallScore < 55) {
    status = 'violation'; // Below 55 -> Red (violation)
  } else if (overallScore > 80) {
    status = 'compliant'; // Above 80 -> Green (compliant)
  } else {
    status = 'needs_review'; // 55 to 80 -> Yellow (needs_review)
  }

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    status,
    commodityInfo,
    categories: {
      mandatory: { score: mandatoryScore, label: 'Mandatory Rule 6 Declarations' },
      readability: { score: readabilityScore, label: 'Readability & OCR' },
      formatting: { score: formattingScore, label: 'Rule Formatting & Alignment' },
    },
    violations,
    dateAssessment,
  };
}

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
