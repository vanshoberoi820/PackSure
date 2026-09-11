/* ─────────────────────────────────────────────
   Report Engine — PDF generation with jsPDF
   Includes Legal Metrology Rule 6 Declarations & Barcode Verification
   ───────────────────────────────────────────── */
import { jsPDF } from 'jspdf';

/**
 * Generate a professional PDF compliance report.
 * @param {Object} inspection — full inspection object from storage
 */
export async function generateReport(inspection) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  /* ── Header ── */
  doc.setFillColor(37, 99, 235); // primary-600
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PackSure', 14, y + 5);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Smart Packaging Compliance Report', 14, y + 12);

  doc.setFontSize(8);
  doc.text(`Inspection ID: ${inspection.id}`, 14, y + 19);
  doc.text(`Date: ${new Date(inspection.createdAt).toLocaleString('en-IN')}`, 14, y + 24);

  y = 48;

  /* ── Status Banner ── */
  const statusColors = {
    compliant: [22, 163, 74],
    needs_review: [245, 158, 11],
    violation: [239, 68, 68],
  };
  const statusLabels = {
    compliant: 'COMPLIANT',
    needs_review: 'NEEDS REVIEW',
    violation: 'POTENTIAL VIOLATION',
  };

  const sc = statusColors[inspection.status] || statusColors.needs_review;
  doc.setFillColor(sc[0], sc[1], sc[2]);
  doc.roundedRect(14, y, pageW - 28, 18, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const statusText = `${inspection.compliance?.overallScore || 0}/100 — ${statusLabels[inspection.status] || 'UNKNOWN'}`;
  doc.text(statusText, pageW / 2, y + 11.5, { align: 'center' });

  y += 26;

  /* ── Product Information ── */
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Product Information', 14, y);
  y += 2;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(14, y, 60, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);

  const barcodeStr = (inspection.detectedBarcodes || [])
    .map(b => `${b.rawValue}${b.country ? ` (${b.country})` : ''}`)
    .join(', ') || 'None Detected';

  const productInfo = [
    ['Product', inspection.productName || 'Unknown Product'],
    ['Inspection ID', inspection.id],
    ['Date', new Date(inspection.createdAt).toLocaleString('en-IN')],
    ['Barcode / GTIN', barcodeStr],
    ['OCR Confidence', `${Math.round(inspection.ocrConfidence || 0)}%`],
    ['Status', statusLabels[inspection.status] || 'Unknown'],
  ];

  for (const [label, value] of productInfo) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value).substring(0, 60), 55, y);
    y += 6;
  }

  y += 4;

  /* ── Category Scores ── */
  if (inspection.compliance?.categories) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Compliance Scores', 14, y);
    y += 2;
    doc.line(14, y, 60, y);
    y += 6;

    doc.setFontSize(10);
    const cats = inspection.compliance.categories;
    for (const key of Object.keys(cats)) {
      const cat = cats[key];
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`${cat.label}:`, 14, y);

      // Score bar
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(80, y - 3, 60, 4, 1, 1, 'F');
      const barColor = cat.score >= 80 ? [22, 163, 74] : cat.score >= 50 ? [245, 158, 11] : [239, 68, 68];
      doc.setFillColor(barColor[0], barColor[1], barColor[2]);
      doc.roundedRect(80, y - 3, (cat.score / 100) * 60, 4, 1, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.text(`${cat.score}%`, 145, y);
      y += 7;
    }
    y += 4;
  }

  /* ── Declarations Table ── */
  const reportDeclarations = (inspection.declarations || []).filter(
    (decl) => decl.field !== 'fssaiLicense'
  );

  if (reportDeclarations.length > 0) {
    if (y > 230) { doc.addPage(); y = 15; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Extracted Declarations (Legal Metrology Rule 6)', 14, y);
    y += 2;
    doc.line(14, y, 90, y);
    y += 6;

    doc.setFontSize(9);
    // Table header
    doc.setFillColor(243, 244, 246);
    doc.rect(14, y - 3, pageW - 28, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Declaration', 16, y + 1);
    doc.text('Value', 80, y + 1);
    doc.text('Status', 155, y + 1);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);

    for (const decl of reportDeclarations) {
      if (y > 275) { doc.addPage(); y = 15; }

      const statusIcon = decl.status === 'detected' ? '[OK]' : decl.status === 'not_applicable' ? '[N/A]' : decl.status === 'needs_review' ? '[?]' : '[X]';
      const statusColor = decl.status === 'detected' ? [22, 163, 74] : decl.status === 'not_applicable' ? [100, 116, 139] : decl.status === 'needs_review' ? [245, 158, 11] : [239, 68, 68];

      doc.setTextColor(51, 65, 85);
      doc.text(decl.label, 16, y, { maxWidth: 60 });
      doc.text(decl.value ? String(decl.value).substring(0, 45) : '—', 80, y, { maxWidth: 70 });

      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(statusIcon, 155, y);
      doc.setFont('helvetica', 'normal');

      y += 6;
    }
    y += 4;
  }

  /* ── Violations ── */
  const reportViolations = (inspection.compliance?.violations || []).filter(
    (v) => v.field !== 'fssaiLicense'
  );

  if (reportViolations.length > 0) {
    if (y > 230) { doc.addPage(); y = 15; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(239, 68, 68);
    doc.text(`Potential Issues (${reportViolations.length})`, 14, y);
    y += 2;
    doc.setDrawColor(239, 68, 68);
    doc.line(14, y, 60, y);
    y += 6;

    doc.setFontSize(9);
    for (const v of reportViolations) {
      if (y > 270) { doc.addPage(); y = 15; }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`${v.label} — ${v.severity.toUpperCase()}`, 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const lines = doc.splitTextToSize(v.message, pageW - 36);
      doc.text(lines, 16, y);
      y += lines.length * 4 + 4;
    }
    y += 4;
  }

  /* ── Officer Notes ── */
  if (inspection.officerReview?.notes) {
    if (y > 250) { doc.addPage(); y = 15; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Officer Notes', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const noteLines = doc.splitTextToSize(inspection.officerReview.notes, pageW - 28);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 5 + 4;
  }

  /* ── Product Image ── */
  if (inspection.productImage) {
    if (y > 170) { doc.addPage(); y = 15; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Product Image', 14, y);
    y += 8;

    try {
      doc.addImage(inspection.productImage, 'JPEG', 14, y, 80, 80);
      y += 85;
    } catch (e) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(156, 163, 175);
      doc.text('[Image could not be embedded]', 14, y);
      y += 6;
    }
  }

  /* ── Footer ── */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(
      'Generated by PackSure — Smart Packaging Compliance | Legal Metrology (Packaged Commodities) Rules, 2011',
      pageW / 2,
      290,
      { align: 'center' }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageW - 20, 290, { align: 'right' });
  }

  doc.save(`PackSure-Report-${inspection.id}.pdf`);
}
