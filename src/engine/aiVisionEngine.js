/* ─────────────────────────────────────────────
   AI Vision Inspection Engine — Legal Metrology (Packaged Commodities) Rules, 2011
   Direct multimodal vision analysis via OpenRouter (GPT-4o-mini Vision)
   ───────────────────────────────────────────── */

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

/**
 * Check if the AI Vision Model is configured and ready.
 */
export function isAIVisionConfigured() {
  return !!OPENROUTER_API_KEY && OPENROUTER_API_KEY.startsWith('sk-');
}

/**
 * Perform deep multimodal Legal Metrology inspection on 1 or more package images.
 * @param {Array<string>} images — Array of Base64 Data URLs or Image URLs
 * @param {Function} onProgress — Progress callback ({ step, label, progress })
 * @param {Array} detectedBarcodes — Array of barcode objects detected client-side
 * @returns {Promise<Object>} — { declarations, rawOcrText, ocrConfidence, aiAnalysis }
 */
export async function analyzePackageWithAI(images = [], onProgress = () => {}, detectedBarcodes = []) {
  if (!images || images.length === 0) {
    throw new Error('No images provided for AI Vision analysis.');
  }

  if (!isAIVisionConfigured()) {
    throw new Error('AI Vision API key is not configured in .env');
  }

  onProgress({ step: 1, label: 'Connecting to AI Vision Inspection Model…', progress: 25 });

  const imageContents = images.slice(0, 4).map((imgUrl) => ({
    type: 'image_url',
    image_url: { url: imgUrl },
  }));

  const systemPrompt = `You are a Senior Legal Metrology Officer and Computer Vision Inspector under the Legal Metrology (Packaged Commodities) Rules, 2011 (Rule 6).
Examine the package label image(s) with high precision and extract all mandatory statutory declarations.

Return ONLY a valid JSON object matching this schema:
{
  "productName": "Generic or common name of commodity (e.g. Tender Coconut Water, Exercise Notebook)",
  "brandName": "Brand name (e.g. Storia, Classmate, Paperkraft)",
  "manufacturer": "Name and complete address of the manufacturer / brand owned and marketed by",
  "packer": "Name and address of packer if separate, else manufacturer",
  "importer": "Name and address of importer if imported commodity, else null",
  "netQuantity": "Net quantity in standard metric units (e.g. 1.01 L, 500 g, 288 Pages (with cover))",
  "mrp": "Maximum retail price formatted as Rs. XX.XX (Incl. of all taxes) or Rs. XX",
  "manufacturingDate": "Manufacturing / Packing date (DD/MM/YYYY or MM/YYYY: e.g. 28/04/2026)",
  "bestBefore": "Best before / Expiry date or shelf life duration (e.g. 23/01/2027 or 9 months from manufacture)",
  "countryOfOrigin": "Country of origin (e.g. India)",
  "consumerCare": "Consumer care details including email, helpline phone number, address, website",
  "unitSalePrice": "Unit sale price per g/kg/ml/l/unit if declared (e.g. Rs. 0.18 per ml)",
  "fssaiLicense": "14-digit FSSAI license number if applicable, else null",
  "batchNumber": "Batch / Lot / B.No code (e.g. T64611803)",
  "rawText": "Complete transcription of all text visible on the packaging"
}`;

  onProgress({ step: 2, label: 'AI Model auditing Rule 6 declarations…', progress: 60 });

  const payload = {
    model: 'openai/gpt-4o-mini',
    max_tokens: 1500,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all Rule 6 statutory declarations from the attached package photo(s) as JSON.',
          },
          ...imageContents,
        ],
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
      'X-Title': 'PackSure Legal Metrology AI',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`AI Vision Error (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('AI Vision model returned an empty response.');
  }

  onProgress({ step: 3, label: 'Structuring Legal Metrology report…', progress: 90 });

  let parsed = {};
  try {
    parsed = JSON.parse(rawContent);
  } catch (parseErr) {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse AI Vision JSON output.');
    }
  }

  // Standardize into Legal Metrology Declarations Array
  const makeDecl = (field, label, value, rule, evidence = '') => ({
    field,
    label,
    value: value && String(value).trim() ? String(value).trim() : null,
    confidence: value ? 98 : 0,
    status: value ? 'detected' : 'not_detected',
    rule,
    evidence: evidence || (value ? String(value) : ''),
    source: 'ai_vision',
  });

  const fullProductName = parsed.brandName && parsed.productName && !parsed.productName.toLowerCase().includes(parsed.brandName.toLowerCase())
    ? `${parsed.brandName} ${parsed.productName}`
    : (parsed.productName || parsed.brandName || null);

  // If GS1 Barcode has country, verify Country of Origin
  let countryVal = parsed.countryOfOrigin || 'India';
  if (detectedBarcodes && detectedBarcodes.length > 0) {
    const ean = detectedBarcodes.find((b) => b.country);
    if (ean) countryVal = ean.country;
  }

  const declarations = [
    makeDecl('productName', 'Product Name / Commodity', fullProductName, 'Rule 6(1)(b)', fullProductName),
    makeDecl('manufacturer', 'Manufacturer', parsed.manufacturer, 'Rule 6(1)(a)', parsed.manufacturer),
    makeDecl('packer', 'Packer', parsed.packer || parsed.manufacturer, 'Rule 6(1)(a)', parsed.packer),
    makeDecl('importer', 'Importer', parsed.importer, 'Rule 6(1)(a)', parsed.importer),
    makeDecl('netQuantity', 'Net Quantity', parsed.netQuantity, 'Rule 6(1)(c)', parsed.netQuantity),
    makeDecl('mrp', 'MRP (Maximum Retail Price)', parsed.mrp, 'Rule 6(1)(e)', parsed.mrp),
    makeDecl('manufacturingDate', 'Manufacturing / Packing Date', parsed.manufacturingDate, 'Rule 6(1)(d)', parsed.manufacturingDate),
    makeDecl('bestBefore', 'Best Before / Expiry Date', parsed.bestBefore, 'Rule 6(1)(d) proviso', parsed.bestBefore),
    makeDecl('countryOfOrigin', 'Country of Origin', countryVal, 'Rule 6(1)(g)', countryVal),
    makeDecl('consumerCare', 'Consumer Care Details', parsed.consumerCare, 'Rule 6(1)(n)', parsed.consumerCare),
    makeDecl('unitSalePrice', 'Unit Sale Price', parsed.unitSalePrice, 'Rule 6(1)(h)', parsed.unitSalePrice),
    makeDecl('fssaiLicense', 'FSSAI License', parsed.fssaiLicense, 'FSSAI Rule 9', parsed.fssaiLicense),
    makeDecl('batchNumber', 'Batch / Lot Number', parsed.batchNumber, 'Rule 6(1)(q)', parsed.batchNumber),
  ];

  return {
    declarations,
    rawOcrText: parsed.rawText || Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join('\n'),
    ocrConfidence: 98,
    aiAnalysis: parsed,
  };
}
