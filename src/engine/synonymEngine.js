/* ─────────────────────────────────────────────
   Statutory Synonym Matching & Scoring Engine
   Legal Metrology (Packaged Commodities) Rules, 2011 — Rule 6 Declarations
   Supports:
   - Local Exact, Prefix, Abbreviation, Token-set & Levenshtein Fuzzy Matching
   - Multi-synonym Scoring (e.g. "mf by", "mfg by", "manufacturer by", "mfd & pkd by")
   - AI Semantic Synonym Comparison API via OpenRouter with local offline fallback
   ───────────────────────────────────────────── */

const OPENROUTER_API_KEY = import.meta.env?.VITE_OPENROUTER_API_KEY || '';

/**
 * Statutory declarations and comprehensive synonym database under Rule 6.
 */
export const STATUTORY_SYNONYMS = {
  manufacturer: {
    field: 'manufacturer',
    rule: 'Rule 6(1)(a)',
    canonical: 'Manufacturer Identity & Address',
    severity: 'high',
    weight: 15,
    synonyms: [
      'manufactured by',
      'manufacturer by',
      'manufactured at',
      'manufacturer & packed by',
      'manufactured and packed by',
      'manufactured & marketed by',
      'mfg & pkd by',
      'mfd & pkd by',
      'mfg and pkd by',
      'mfd and pkd by',
      'mkt & mfg by',
      'mfg by',
      'mfd by',
      'mf by',
      'mfg. by',
      'mfd. by',
      'mf. by',
      'mfg',
      'mfd',
      'mf',
      'brand owned and marketed by',
      'marketed by',
      'marketed & manufactured by',
      'mkt by',
      'mktd by',
      'mktg by',
      'marketed and packed by',
      'produced by',
      'producer',
      'processed by',
      'bottled by',
      'canned by',
      'formulated by',
      'blended by',
      'brewed by',
      'distilled by',
      'packed and manufactured by',
      'originator',
      'registered trademark of',
      'trademark of',
      'manufaturer', // Common OCR typo
      'manufacured', // Common OCR typo
    ],
    patterns: [
      /(?:brand\s*owned\s*(?:and|&)\s*marketed\s*by|marketed\s*(?:and|&)\s*manufactured\s*(?:by)?|manufactured\s*(?:and|&)\s*(?:marketed|packed)\s*(?:by|at)?|mkt\s*&\s*mfg\s*(?:by)?|mfg\s*(?:and|&)\s*pkd\s*(?:by|at)?|mfd\s*(?:and|&)\s*pkd\s*(?:by|at)?)/i,
      /(?:manufactured\s*by|manufacturer\s*by|marketed\s*by|mfg\.?\s*by|mfd\.?\s*by|mf\.?\s*by|produced\s*by|processed\s*by|bottled\s*by)/i,
    ],
  },

  packer: {
    field: 'packer',
    rule: 'Rule 6(1)(a)',
    canonical: 'Packer Identity & Address',
    severity: 'high',
    weight: 15,
    synonyms: [
      'packed by',
      'packer',
      'packer by',
      'pkd by',
      'pkg by',
      'pkd. by',
      'pkg. by',
      'packed at',
      'packaging by',
      'packaging address',
      'repacked by',
      're-packed by',
      're-packer',
      'unit packed by',
      'bottled by',
      'canned by',
      'packed and marketed by',
      'mfd & pkd by',
      'mfg & pkd by',
      'packd by',
    ],
    patterns: [
      /(?:packed\s*by|packer\s*by|pkd\.?\s*by|pkg\.?\s*by|re-?packed\s*by|unit\s*packed\s*by|packed\s*at)/i,
    ],
  },

  importer: {
    field: 'importer',
    rule: 'Rule 6(1)(a)',
    canonical: 'Importer Details',
    severity: 'low',
    weight: 2,
    synonyms: [
      'imported by',
      'importer',
      'importer address',
      'imported and distributed by',
      'imported & distributed by',
      'imp by',
      'imp. by',
      'imported in india by',
      'sole importer',
      'customs clearance by',
      'marketed and imported by',
      'importation by',
    ],
    patterns: [
      /(?:imported\s*(?:and|&)\s*distributed\s*by|imported\s*in\s*india\s*by|imported\s*by|importer(?:\s*name|\s*address)?|imp\.?\s*by)/i,
    ],
  },

  netQuantity: {
    field: 'netQuantity',
    rule: 'Rule 6(1)(c)',
    canonical: 'Net Quantity Declaration',
    severity: 'high',
    weight: 15,
    synonyms: [
      'net quantity',
      'net qty',
      'net wt',
      'net weight',
      'net contents',
      'net volume',
      'net vol',
      'net mass',
      'net amount',
      'quantity',
      'qty',
      'contents',
      'net count',
      'units',
      'total pages',
      'pages',
      'n:',
      'net content',
      'wt',
      'weight',
      'vol',
    ],
    patterns: [
      /(?:net\s*(?:quantity|qty|wt\.?|weight|contents?|volume|vol\.?|mass|amount)|quantity|qty\.?|total\s*pages|pages\s*\(with\s*cover\))\s*[:\-]?/i,
    ],
  },

  mrp: {
    field: 'mrp',
    rule: 'Rule 6(1)(e)',
    canonical: 'Maximum Retail Price (MRP)',
    severity: 'high',
    weight: 15,
    synonyms: [
      'mrp',
      'm.r.p.',
      'maximum retail price',
      'max retail price',
      'max. retail price',
      'retail price',
      'mrp rs',
      'mrp ₹',
      'r.p.',
      'price',
      'inclusive of all taxes',
      'incl. of all taxes',
      'incl of taxes',
      'incl taxes',
      'maximum price',
      'm.r.p',
    ],
    patterns: [
      /(?:maximum\s*retail\s*price|max\.?\s*retail\s*price|m\.?r\.?p\.?|retail\s*price|price)\s*[:\-]?/i,
    ],
  },

  manufacturingDate: {
    field: 'manufacturingDate',
    rule: 'Rule 6(1)(d)',
    canonical: 'Manufacturing / Packing Date',
    severity: 'high',
    weight: 15,
    synonyms: [
      'mfg date',
      'mfd date',
      'mfg dt',
      'mfd dt',
      'mfg.',
      'mfd.',
      'date of mfg',
      'date of manufacture',
      'date of manufacturing',
      'date of packing',
      'pkd date',
      'pkg date',
      'pkd dt',
      'packed on',
      'mfd on',
      'mfg on',
      'mfd:',
      'mfg:',
      'pkd:',
      'pkg:',
      'dom',
      'd.o.m.',
      'manufacturing date',
      'packing date',
      'packed date',
      'date of pkg',
    ],
    patterns: [
      /(?:date\s*of\s*(?:mfg|manufacture|manufacturing|packing|pkg)|(?:mfg|mfd|pkd|pkg)\.?\s*(?:date|dt|on)?)\s*[:\-]?/i,
    ],
  },

  bestBefore: {
    field: 'bestBefore',
    rule: 'Rule 6(1)(d) proviso',
    canonical: 'Best Before / Expiry Date',
    severity: 'medium',
    weight: 10,
    synonyms: [
      'best before',
      'best before date',
      'use by',
      'use by date',
      'expiry date',
      'exp date',
      'exp dt',
      'expiry',
      'exp.',
      'expiry on',
      'best by',
      'bb date',
      'shelf life',
      'consume within',
      'valid until',
      'expiration date',
      'best before within',
      'use before',
    ],
    patterns: [
      /(?:best\s*before(?:\s*date)?|use\s*(?:by|before)(?:\s*date)?|exp(?:iry)?\.?\s*(?:date|dt|on)?|shelf\s*life|consume\s*within)\s*[:\-]?/i,
    ],
  },

  countryOfOrigin: {
    field: 'countryOfOrigin',
    rule: 'Rule 6(1)(g)',
    canonical: 'Country of Origin',
    severity: 'medium',
    weight: 10,
    synonyms: [
      'country of origin',
      'made in',
      'product of',
      'origin',
      'manufactured in',
      'country of manufacture',
      'produced in',
      'origin country',
      'country',
    ],
    patterns: [
      /(?:country\s*of\s*(?:origin|manufacture)|made\s*in|product\s*of|manufactured\s*in|produced\s*in)\s*[:\-]?/i,
    ],
  },

  consumerCare: {
    field: 'consumerCare',
    rule: 'Rule 6(1)(n)',
    canonical: 'Consumer Care Details',
    severity: 'medium',
    weight: 10,
    synonyms: [
      'consumer care',
      'customer care',
      'customer service',
      'consumer cell',
      'feedback',
      'queries',
      'complaints',
      'grievance',
      'helpline',
      'toll free',
      'care cell',
      'contact us',
      'write to us',
      'consumer helpline',
      'help desk',
      'consumer redressal',
      'toll-free',
      'care@',
      'customercare',
    ],
    patterns: [
      /(?:consumer\s*(?:care|cell|helpline|redressal)|customer\s*(?:care|service|support)|feedback|for\s*(?:queries|feedback|complaints)|contact\s*us|helpline|toll\s*free)\s*[:\-]?/i,
    ],
  },

  unitSalePrice: {
    field: 'unitSalePrice',
    rule: 'Rule 6(1)(h)',
    canonical: 'Unit Sale Price',
    severity: 'low',
    weight: 5,
    synonyms: [
      'unit sale price',
      'unit price',
      'usp',
      'u.s.p.',
      'rate per unit',
      'price per unit',
      'price per g',
      'price per ml',
      'price per kg',
      'per g',
      'per ml',
      'per piece',
      'per unit',
      'u.s.p',
    ],
    patterns: [
      /(?:unit\s*sale\s*price|unit\s*price|u\.?s\.?p\.?|rate\s*per\s*unit|price\s*per\s*(?:g|kg|ml|l|unit|piece))\s*[:\-]?/i,
    ],
  },

  fssaiLicense: {
    field: 'fssaiLicense',
    rule: 'FSSAI Rule 9',
    canonical: 'FSSAI License',
    severity: 'medium',
    weight: 5,
    synonyms: [
      'fssai lic no',
      'fssai lic. no.',
      'fssai no',
      'fssai license',
      'lic no',
      'lic. no.',
      'fssai registration',
      'fssai',
      'licence no',
    ],
    patterns: [
      /(?:fssai\s*(?:lic\.?\s*no\.?|license|no\.?)?|lic\.?\s*no\.?)\s*[:\-]?/i,
    ],
  },

  batchNumber: {
    field: 'batchNumber',
    rule: 'Rule 6(1)(q)',
    canonical: 'Batch / Lot Number',
    severity: 'medium',
    weight: 5,
    synonyms: [
      'batch no',
      'batch number',
      'lot no',
      'lot number',
      'b. no.',
      'b.no',
      'batch / lot',
      'b no',
      'batch code',
      'lot:',
      'batch:',
      'lot code',
    ],
    patterns: [
      /(?:batch\s*(?:no\.?|number|code)?|lot\s*(?:no\.?|number|code)?|b\.?\s*no\.?)\s*[:\-]?/i,
    ],
  },

  productName: {
    field: 'productName',
    rule: 'Rule 6(1)(b)',
    canonical: 'Commodity Generic / Common Name',
    severity: 'high',
    weight: 15,
    synonyms: [
      'product name',
      'commodity name',
      'generic name',
      'common name',
      'name of commodity',
      'name of product',
      'item name',
      'commodity',
      'product',
    ],
    patterns: [
      /(?:product\s*(?:name)?|commodity(?:\s*name)?|name\s*of\s*(?:the\s*)?(?:product|commodity|item))\s*[:\-]?/i,
    ],
  },
};

/* ─────────────────────────────────────────────
   String Similarity & Fuzzy Matching Utilities
   ───────────────────────────────────────────── */

/**
 * Clean and normalize a string for synonym matching.
 */
export function normalizePhrase(str = '') {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[.:,;\-_/\\()[\]{}#"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute Levenshtein distance between two strings.
 */
export function levenshteinDistance(s1 = '', s2 = '') {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Compute normalized fuzzy similarity score between 0.0 and 1.0.
 */
export function calculateStringSimilarity(s1 = '', s2 = '') {
  const norm1 = normalizePhrase(s1);
  const norm2 = normalizePhrase(s2);
  if (norm1 === norm2) return 1.0;
  if (!norm1.length || !norm2.length) return 0.0;

  const maxLen = Math.max(norm1.length, norm2.length);
  const dist = levenshteinDistance(norm1, norm2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/* ─────────────────────────────────────────────
   Core Synonym Matching API & Scoring
   ───────────────────────────────────────────── */

/**
 * Compare an input word/phrase against the synonyms of a specific target field.
 * @param {string} inputWord — e.g. "mf by", "manufacturer by", "mfd & pkd by", "net wt"
 * @param {string} targetField — e.g. "manufacturer", "netQuantity", "mrp"
 * @returns {Object} — { isMatch, score, field, canonical, matchedSynonym, matchType, confidence }
 */
export function matchSynonymScore(inputWord = '', targetField = 'manufacturer') {
  const normInput = normalizePhrase(inputWord);
  if (!normInput) {
    return {
      isMatch: false,
      score: 0,
      field: targetField,
      canonical: STATUTORY_SYNONYMS[targetField]?.canonical || targetField,
      matchedSynonym: null,
      matchType: 'none',
      confidence: 0,
    };
  }

  const fieldConfig = STATUTORY_SYNONYMS[targetField];
  if (!fieldConfig) {
    return {
      isMatch: false,
      score: 0,
      field: targetField,
      canonical: targetField,
      matchedSynonym: null,
      matchType: 'unknown_field',
      confidence: 0,
    };
  }

  let bestMatch = {
    isMatch: false,
    score: 0,
    field: targetField,
    canonical: fieldConfig.canonical,
    matchedSynonym: null,
    matchType: 'none',
    confidence: 0,
  };

  // 1. Exact Regex Pattern Match (Score: 98-100)
  if (fieldConfig.patterns) {
    for (const pat of fieldConfig.patterns) {
      if (pat.test(inputWord) || pat.test(normInput)) {
        return {
          isMatch: true,
          score: 100,
          field: targetField,
          canonical: fieldConfig.canonical,
          matchedSynonym: inputWord.trim(),
          matchType: 'pattern_exact',
          confidence: 99,
        };
      }
    }
  }

  // 2. Exact or Substring Synonym Match (Score: 95-100)
  for (const syn of fieldConfig.synonyms) {
    const normSyn = normalizePhrase(syn);

    // Exact equal
    if (normInput === normSyn) {
      return {
        isMatch: true,
        score: 100,
        field: targetField,
        canonical: fieldConfig.canonical,
        matchedSynonym: syn,
        matchType: 'exact_synonym',
        confidence: 98,
      };
    }

    // Input starts with synonym (e.g. "mf by ABC Foods" starts with "mf by")
    if (normInput.startsWith(normSyn + ' ') || normInput === normSyn) {
      const score = 96;
      if (score > bestMatch.score) {
        bestMatch = {
          isMatch: true,
          score,
          field: targetField,
          canonical: fieldConfig.canonical,
          matchedSynonym: syn,
          matchType: 'prefix_match',
          confidence: 95,
        };
      }
    }

    // Synonym contains input or input contains synonym
    if (normInput.includes(normSyn) && normSyn.length >= 3) {
      const score = 92;
      if (score > bestMatch.score) {
        bestMatch = {
          isMatch: true,
          score,
          field: targetField,
          canonical: fieldConfig.canonical,
          matchedSynonym: syn,
          matchType: 'contains_match',
          confidence: 90,
        };
      }
    }

    // 3. Fuzzy Levenshtein Match (Score: 70-90)
    const sim = calculateStringSimilarity(normInput, normSyn);
    if (sim >= 0.75) {
      const fuzzyScore = Math.round(sim * 90);
      if (fuzzyScore > bestMatch.score) {
        bestMatch = {
          isMatch: true,
          score: fuzzyScore,
          field: targetField,
          canonical: fieldConfig.canonical,
          matchedSynonym: syn,
          matchType: 'fuzzy_levenshtein',
          confidence: Math.round(sim * 88),
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Automatically inspect a word/phrase and find which Legal Metrology statutory field it matches best.
 * @param {string} inputWord — Any word or phrase, e.g. "mf by", "pkd at", "rs 99", "net wt 500g"
 * @returns {Object} — Best matching field and full scoring breakdown
 */
export function findBestFieldForPhrase(inputWord = '') {
  let highestMatch = {
    isMatch: false,
    score: 0,
    field: null,
    canonical: null,
    rule: null,
    matchedSynonym: null,
    matchType: 'none',
    confidence: 0,
  };

  for (const [fieldName, config] of Object.entries(STATUTORY_SYNONYMS)) {
    const result = matchSynonymScore(inputWord, fieldName);
    if (result.score > highestMatch.score) {
      highestMatch = {
        ...result,
        rule: config.rule,
      };
    }
  }

  return highestMatch;
}

/**
 * Retrieve all registered statutory synonyms for a given field.
 * @param {string} field — e.g. "manufacturer", "mrp"
 * @returns {Array<string>}
 */
export function getSynonymsForField(field = '') {
  return STATUTORY_SYNONYMS[field]?.synonyms || [];
}

/**
 * Scan an entire block of text and find all statutory declaration matches with scores.
 * @param {string} rawText
 * @returns {Object} — Map of field -> match details
 */
export function auditTextWithSynonyms(rawText = '') {
  const results = {};

  for (const [fieldName, config] of Object.entries(STATUTORY_SYNONYMS)) {
    let bestForField = {
      isMatch: false,
      score: 0,
      field: fieldName,
      canonical: config.canonical,
      rule: config.rule,
      evidence: '',
    };

    // Check patterns
    for (const pat of config.patterns) {
      const m = rawText.match(pat);
      if (m) {
        bestForField = {
          isMatch: true,
          score: 100,
          field: fieldName,
          canonical: config.canonical,
          rule: config.rule,
          evidence: m[0],
          matchType: 'regex_pattern',
        };
        break;
      }
    }

    // If not matched by pattern, check synonyms
    if (!bestForField.isMatch) {
      for (const syn of config.synonyms) {
        const regex = new RegExp(`\\b${syn.replace(/[.]/g, '\\.')}\\b`, 'i');
        const m = rawText.match(regex);
        if (m) {
          bestForField = {
            isMatch: true,
            score: 95,
            field: fieldName,
            canonical: config.canonical,
            rule: config.rule,
            evidence: m[0],
            matchType: 'synonym_keyword',
          };
          break;
        }
      }
    }

    results[fieldName] = bestForField;
  }

  return results;
}

/* ─────────────────────────────────────────────
   AI Semantic Synonym Comparison API
   (OpenRouter GPT-4o-mini with automatic local fallback)
   ───────────────────────────────────────────── */

/**
 * Use AI Vision / LLM API to evaluate semantic similarity of a word/phrase with statutory declarations.
 * @param {string} wordOrPhrase — The text from packaging e.g. "mf by", "mfd & pkd by", "mrp"
 * @param {string} targetField — Optional target field name to test against (e.g. "manufacturer")
 * @returns {Promise<Object>} — { isMatch, score, field, canonical, explanation, source }
 */
export async function compareWithSynonymsAI(wordOrPhrase = '', targetField = 'manufacturer') {
  if (!wordOrPhrase || !wordOrPhrase.trim()) {
    return {
      isMatch: false,
      score: 0,
      field: targetField,
      canonical: STATUTORY_SYNONYMS[targetField]?.canonical || targetField,
      explanation: 'No phrase provided.',
      source: 'local_validation',
    };
  }

  // Fast local evaluation first
  const localMatch = targetField
    ? matchSynonymScore(wordOrPhrase, targetField)
    : findBestFieldForPhrase(wordOrPhrase);

  // If local match is very confident (score >= 90) or API is unavailable, return local result
  if (localMatch.score >= 90 || !OPENROUTER_API_KEY || !OPENROUTER_API_KEY.startsWith('sk-')) {
    return {
      isMatch: localMatch.isMatch,
      score: localMatch.score,
      field: localMatch.field,
      canonical: localMatch.canonical,
      matchedSynonym: localMatch.matchedSynonym,
      matchType: localMatch.matchType,
      explanation: `Matched locally via statutory synonym database (${localMatch.matchType}).`,
      source: 'local_synonym_engine',
    };
  }

  // Call OpenRouter API for deep semantic comparison
  try {
    const payload = {
      model: 'openai/gpt-4o-mini',
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are a Legal Metrology (Packaged Commodities) Rules, 2011 expert.
Analyze the user's packaging phrase/abbreviation (e.g. "mf by", "mfd & pkd by", "mrp", "net wt", "use by") and determine if it represents a statutory declaration field under Rule 6.

Target Field to compare: "${targetField}" (${STATUTORY_SYNONYMS[targetField]?.canonical || ''})

Respond ONLY in valid JSON:
{
  "isMatch": true/false,
  "score": 0 to 100,
  "matchedField": "${targetField}",
  "canonicalName": "Name of declaration",
  "explanation": "Brief explanation of why it matches or does not match"
}`,
        },
        {
          role: 'user',
          content: `Compare this phrase with statutory synonyms: "${wordOrPhrase}"`,
        },
      ],
      response_format: { type: 'json_object' },
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://packsure.gov.in',
        'X-Title': 'PackSure Synonym Matcher',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return {
      isMatch: !!parsed.isMatch,
      score: Number(parsed.score) || localMatch.score,
      field: parsed.matchedField || targetField,
      canonical: parsed.canonicalName || localMatch.canonical,
      explanation: parsed.explanation || 'Semantic match determined by AI.',
      source: 'openrouter_ai',
    };
  } catch (err) {
    // Graceful fallback to local synonym engine
    return {
      isMatch: localMatch.isMatch,
      score: localMatch.score,
      field: localMatch.field,
      canonical: localMatch.canonical,
      matchedSynonym: localMatch.matchedSynonym,
      matchType: localMatch.matchType,
      explanation: `Local fallback match (${localMatch.matchType}) due to API connectivity.`,
      source: 'local_fallback',
    };
  }
}
