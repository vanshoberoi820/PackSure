/* ─────────────────────────────────────────────
   Demo Data — Reliable demonstration fallback
   Provides pre-computed inspection data for SIH demo
   ───────────────────────────────────────────── */

/** Pre-built OCR text simulating a real product label scan */
export const DEMO_OCR_TEXT = `NATURE'S BEST
Premium Basmati Rice

Net Weight: 1 kg

MRP Rs. 299/- (Incl. of all taxes)

Manufactured by: ABC Foods Pvt. Ltd.
Plot No. 42, Industrial Area Phase-II
Mohali, Punjab - 160055

Packed by: ABC Foods Pvt. Ltd.
Plot No. 42, Industrial Area Phase-II
Mohali, Punjab - 160055

Mfg Date: 03/2026
Best Before: 12 months from packaging

Batch No: NB-BR-2026-0342

FSSAI Lic. No: 10120034000567

Country of Origin: India

Ingredients: 100% Basmati Rice

Storage: Store in cool, dry place away from direct sunlight.

Allergen Info: Processed in a facility that also handles wheat and soy.`;

/** Pre-built declarations matching the demo OCR text */
export const DEMO_DECLARATIONS = [
  {
    field: 'productName',
    label: 'Product Name',
    value: "NATURE'S BEST Premium Basmati Rice",
    confidence: 94,
    status: 'detected',
  },
  {
    field: 'manufacturer',
    label: 'Manufacturer',
    value: 'ABC Foods Pvt. Ltd., Plot No. 42, Industrial Area Phase-II, Mohali, Punjab - 160055',
    confidence: 92,
    status: 'detected',
  },
  {
    field: 'packer',
    label: 'Packer',
    value: 'ABC Foods Pvt. Ltd., Plot No. 42, Industrial Area Phase-II, Mohali, Punjab - 160055',
    confidence: 90,
    status: 'detected',
  },
  {
    field: 'importer',
    label: 'Importer',
    value: null,
    confidence: 0,
    status: 'not_detected',
  },
  {
    field: 'netQuantity',
    label: 'Net Quantity',
    value: '1 kg',
    confidence: 96,
    status: 'detected',
  },
  {
    field: 'mrp',
    label: 'MRP (Maximum Retail Price)',
    value: 'Rs. 299.00 (Incl. of all taxes)',
    confidence: 97,
    status: 'detected',
  },
  {
    field: 'manufacturingDate',
    label: 'Manufacturing / Packing Date',
    value: '03/2026',
    confidence: 91,
    status: 'detected',
  },
  {
    field: 'bestBefore',
    label: 'Best Before / Expiry Date',
    value: '12 months from packaging',
    confidence: 89,
    status: 'detected',
  },
  {
    field: 'countryOfOrigin',
    label: 'Country of Origin',
    value: 'India',
    confidence: 95,
    status: 'detected',
  },
  {
    field: 'consumerCare',
    label: 'Consumer Care Details',
    value: null,
    confidence: 0,
    status: 'not_detected',
  },
  {
    field: 'unitSalePrice',
    label: 'Unit Sale Price',
    value: null,
    confidence: 0,
    status: 'not_detected',
  },
  {
    field: 'fssaiLicense',
    label: 'FSSAI License',
    value: '10120034000567',
    confidence: 93,
    status: 'detected',
  },
  {
    field: 'batchNumber',
    label: 'Batch / Lot Number',
    value: 'NB-BR-2026-0342',
    confidence: 88,
    status: 'detected',
  },
];

/** Pre-built compliance result for the demo */
export const DEMO_COMPLIANCE = {
  overallScore: 67,
  status: 'needs_review',
  categories: {
    mandatory: { score: 68, label: 'Mandatory Declarations' },
    readability: { score: 80, label: 'Readability' },
    formatting: { score: 85, label: 'Formatting' },
  },
  violations: [
    {
      field: 'consumerCare',
      label: 'Consumer Care Details',
      severity: 'medium',
      status: 'not_detected',
      message:
        'Consumer care / grievance redressal details were not detected on the package label. This is a mandatory declaration under Rule 6 of the Legal Metrology (Packaged Commodities) Rules, 2011.',
      confidence: 91,
    },
    {
      field: 'unitSalePrice',
      label: 'Unit Sale Price',
      severity: 'medium',
      status: 'not_detected',
      message:
        'Unit sale price was not detected. As per Rule 6(11), the unit sale price per standard unit of measurement must be declared on pre-packaged commodities.',
      confidence: 88,
    },
    {
      field: 'importer',
      label: 'Importer',
      severity: 'low',
      status: 'not_detected',
      message:
        'Importer information was not detected. This is required only for imported products. If this is a domestic product, this can be disregarded.',
      confidence: 85,
    },
  ],
};

/** Demo e-commerce listing for comparison */
export const DEMO_ECOMMERCE_DECLARATIONS = [
  {
    field: 'productName',
    label: 'Product Name',
    value: "Nature's Best Premium Basmati Rice",
    confidence: 95,
    status: 'detected',
  },
  {
    field: 'manufacturer',
    label: 'Manufacturer',
    value: 'ABC Foods Pvt. Ltd.',
    confidence: 90,
    status: 'detected',
  },
  {
    field: 'netQuantity',
    label: 'Net Quantity',
    value: '1 kg',
    confidence: 95,
    status: 'detected',
  },
  {
    field: 'mrp',
    label: 'MRP (Maximum Retail Price)',
    value: 'Rs. 349.00',
    confidence: 95,
    status: 'detected',
  },
  {
    field: 'countryOfOrigin',
    label: 'Country of Origin',
    value: 'India',
    confidence: 90,
    status: 'detected',
  },
];

/**
 * Generate a demo product label image using canvas.
 */
export function generateDemoImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#fefce8';
  ctx.fillRect(0, 0, 600, 800);

  // Border
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 3;
  ctx.strokeRect(15, 15, 570, 770);
  ctx.strokeRect(20, 20, 560, 760);

  // Brand header
  ctx.fillStyle = '#92400e';
  ctx.fillRect(30, 30, 540, 80);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("NATURE'S BEST", 300, 65);
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText('Premium Quality Since 1985', 300, 90);

  // Product name
  ctx.fillStyle = '#451a03';
  ctx.font = 'bold 32px Inter, Arial, sans-serif';
  ctx.fillText('Premium Basmati Rice', 300, 150);

  // Decorative line
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, 165); ctx.lineTo(500, 165); ctx.stroke();

  // Net Weight
  ctx.fillStyle = '#1e3a5f';
  ctx.font = 'bold 22px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Net Weight: 1 kg', 50, 210);

  // MRP
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 22px Inter, Arial, sans-serif';
  ctx.fillText('MRP Rs. 299/- (Incl. of all taxes)', 50, 250);

  // Manufacturer
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Inter, Arial, sans-serif';
  ctx.fillText('Manufactured & Packed by:', 50, 300);
  ctx.font = '13px Inter, Arial, sans-serif';
  ctx.fillText('ABC Foods Pvt. Ltd.', 50, 320);
  ctx.fillText('Plot No. 42, Industrial Area Phase-II', 50, 338);
  ctx.fillText('Mohali, Punjab - 160055', 50, 356);

  // Dates
  ctx.font = 'bold 14px Inter, Arial, sans-serif';
  ctx.fillText('Mfg Date: 03/2026', 50, 400);
  ctx.fillText('Best Before: 12 months from packaging', 50, 420);

  // Batch
  ctx.fillText('Batch No: NB-BR-2026-0342', 50, 460);

  // FSSAI
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 14px Inter, Arial, sans-serif';
  ctx.fillText('FSSAI Lic. No: 10120034000567', 50, 500);

  // FSSAI logo placeholder
  ctx.fillStyle = '#059669';
  ctx.fillRect(450, 480, 100, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FSSAI', 500, 500);
  ctx.textAlign = 'left';

  // Country of Origin
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 14px Inter, Arial, sans-serif';
  ctx.fillText('Country of Origin: India', 50, 550);

  // Ingredients
  ctx.fillText('Ingredients: 100% Basmati Rice', 50, 590);

  // Storage
  ctx.font = '12px Inter, Arial, sans-serif';
  ctx.fillText('Storage: Store in cool, dry place away from', 50, 630);
  ctx.fillText('direct sunlight.', 50, 648);

  // Allergen
  ctx.font = 'italic 11px Inter, Arial, sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('Allergen Info: Processed in a facility that also', 50, 690);
  ctx.fillText('handles wheat and soy.', 50, 706);

  // Veg symbol
  ctx.strokeStyle = '#16a34a';
  ctx.lineWidth = 2;
  ctx.strokeRect(520, 130, 30, 30);
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.arc(535, 145, 8, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * Get a complete demo inspection object ready for display.
 */
export function getDemoInspection(id) {
  return {
    id: id || 'PS-2026-00124',
    productImage: generateDemoImage(),
    productName: "NATURE'S BEST Premium Basmati Rice",
    ocrText: DEMO_OCR_TEXT,
    ocrConfidence: 82,
    declarations: DEMO_DECLARATIONS,
    compliance: DEMO_COMPLIANCE,
    officerReview: {
      notes: '',
      decisions: {},
      completed: false,
      completedAt: null,
    },
    comparison: null,
    createdAt: new Date().toISOString(),
    status: 'needs_review',
  };
}
