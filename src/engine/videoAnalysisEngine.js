/* ─────────────────────────────────────────────
   Video Analysis Engine — Multi-Frame OCR & Information Fusion
   Combines declarations and barcodes across 8-second video frames
   ───────────────────────────────────────────── */
import { performFrameOCR } from './ocrEngine.js';
import { extractDeclarations } from './extractionEngine.js';
import { evaluateCompliance } from './complianceEngine.js';

/**
 * Run full multi-frame analysis on extracted video frames.
 * @param {Array} frames — Array of { frameNumber, timestamp, dataUrl, sharpness }
 * @param {function} onProgress — callback({ step, label, progress, currentFrame, totalFrames })
 * @returns {Promise<Object>}
 */
export async function analyzeVideoFrames(frames = [], onProgress = () => {}) {
  if (!frames || frames.length === 0) {
    throw new Error('No video frames available for analysis.');
  }

  const frameResults = [];
  let combinedOcrText = '';
  let totalConfidence = 0;
  let validConfidenceCount = 0;
  const allDetectedBarcodes = [];
  const seenBarcodes = new Set();

  const panelNames = ['Front Panel', 'Angle 2', 'Back Panel', 'Angle 4', 'Angle 5', 'Angle 6'];

  // 1. Run sequential OCR across extracted key frames
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const panelLabel = panelNames[i] || `Angle ${i + 1}`;
    const pct = Math.round(((i + 1) / frames.length) * 85);

    onProgress({
      step: 1,
      label: `Reading ${panelLabel} (${frame.frameNumber}/${frames.length})…`,
      progress: pct,
      currentFrame: i + 1,
      totalFrames: frames.length,
    });

    const ocr = await performFrameOCR(frame.dataUrl);

    if (ocr.text && ocr.text.length > 5) {
      combinedOcrText += `\n--- [Frame ${frame.frameNumber} (${panelLabel}) @ ${frame.timestamp}] ---\n${ocr.text}\n`;
      totalConfidence += (ocr.confidence || 70);
      validConfidenceCount++;
    }

    if (ocr.detectedBarcodes && ocr.detectedBarcodes.length > 0) {
      for (const bc of ocr.detectedBarcodes) {
        if (!seenBarcodes.has(bc.rawValue)) {
          seenBarcodes.add(bc.rawValue);
          allDetectedBarcodes.push(bc);
        }
      }
    }

    const frameDeclarations = extractDeclarations(ocr.text, ocr.confidence || 75, {
      frameNumber: frame.frameNumber,
      timestamp: frame.timestamp,
      source: 'video_frame',
      detectedBarcodes: allDetectedBarcodes,
    });

    frameResults.push({
      frameNumber: frame.frameNumber,
      timestamp: frame.timestamp,
      dataUrl: frame.dataUrl,
      sharpness: frame.sharpness,
      ocrText: ocr.text,
      ocrConfidence: ocr.confidence,
      declarations: frameDeclarations,
      detectedBarcodes: ocr.detectedBarcodes || [],
    });
  }

  onProgress({
    step: 2,
    label: 'Resolving multi-angle Legal Metrology consensus…',
    progress: 95,
  });

  // 2. Perform Multi-Frame Information Fusion
  const fusedDeclarations = fuseFrameDeclarations(frameResults);

  // If we have GS1 barcodes with country, ensure Country of Origin is set if missing
  if (allDetectedBarcodes.length > 0) {
    const gs1 = allDetectedBarcodes.find(b => b.country);
    if (gs1) {
      const coo = fusedDeclarations.find(d => d.field === 'countryOfOrigin');
      if (coo && coo.status === 'not_detected') {
        coo.value = gs1.country;
        coo.status = 'detected';
        coo.confidence = 94;
        coo.evidence = `Verified via GS1 Barcode ${gs1.rawValue} (${gs1.country})`;
      }
    }
  }

  const avgOcrConfidence = validConfidenceCount > 0
    ? Math.round(totalConfidence / validConfidenceCount)
    : 75;

  // 3. Evaluate Legal Metrology Compliance
  const compliance = evaluateCompliance(fusedDeclarations, avgOcrConfidence, combinedOcrText);

  // 4. Select best representative product image
  const bestFrame = selectBestRepresentativeFrame(frameResults);

  return {
    productImage: bestFrame ? bestFrame.dataUrl : (frames[0]?.dataUrl || null),
    productName: fusedDeclarations.find((d) => d.field === 'productName')?.value || 'Unknown Product',
    ocrText: combinedOcrText.trim(),
    ocrConfidence: avgOcrConfidence,
    declarations: fusedDeclarations,
    compliance,
    detectedBarcodes: allDetectedBarcodes,
    scanMetadata: {
      type: 'video',
      durationSeconds: 15,
      framesAnalyzed: frameResults.length,
      bestFrameNumber: bestFrame?.frameNumber || 1,
    },
    frameResults,
  };
}

/**
 * Multi-frame Information Fusion:
 * Combines declarations from all frames, aggregates consensus, flags conflicts, and attaches frame evidence.
 */
export function fuseFrameDeclarations(frameResults) {
  const allFields = [
    'productName',
    'manufacturer',
    'packer',
    'importer',
    'netQuantity',
    'mrp',
    'manufacturingDate',
    'bestBefore',
    'countryOfOrigin',
    'consumerCare',
    'unitSalePrice',
    'fssaiLicense',
    'batchNumber',
  ];

  const fused = [];

  for (const field of allFields) {
    const candidateEntries = [];

    // Collect all detected instances of this field across frames
    for (const fr of frameResults) {
      const decl = fr.declarations.find((d) => d.field === field);
      if (decl && decl.status !== 'not_detected' && decl.value) {
        candidateEntries.push({
          value: decl.value,
          confidence: decl.confidence,
          status: decl.status,
          label: decl.label,
          rule: decl.rule,
          evidence: decl.evidence,
          frameNumber: fr.frameNumber,
          timestamp: fr.timestamp,
        });
      }
    }

    if (candidateEntries.length === 0) {
      const sample = frameResults[0]?.declarations.find((d) => d.field === field);
      fused.push({
        field,
        label: sample?.label || field,
        value: null,
        confidence: 0,
        status: 'not_detected',
        rule: sample?.rule || 'Legal Metrology Rules',
        evidence: '',
        source: 'video_fusion',
        frameEvidence: [],
      });
      continue;
    }

    // Group values by normalized string to find consensus
    const valueGroups = {};
    for (const entry of candidateEntries) {
      const normKey = entry.value.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!valueGroups[normKey]) {
        valueGroups[normKey] = {
          representativeValue: entry.value,
          label: entry.label,
          rule: entry.rule,
          instances: [],
          maxConf: 0,
        };
      }
      valueGroups[normKey].instances.push(entry);
      valueGroups[normKey].maxConf = Math.max(valueGroups[normKey].maxConf, entry.confidence);
    }

    const groupKeys = Object.keys(valueGroups);

    if (groupKeys.length === 1) {
      const group = valueGroups[groupKeys[0]];
      const count = group.instances.length;
      const boostedConfidence = Math.min(99, group.maxConf + Math.min(15, (count - 1) * 5));
      const frameEvidenceList = group.instances.map((i) => ({
        frameNumber: i.frameNumber,
        timestamp: i.timestamp,
      }));

      const primaryInstance = group.instances[0];

      fused.push({
        field,
        label: group.label,
        value: group.representativeValue,
        confidence: boostedConfidence,
        status: primaryInstance.status === 'needs_review' && count > 1 ? 'detected' : primaryInstance.status,
        rule: group.rule,
        evidence: `Verified across ${count} video frame(s) (${frameEvidenceList.map((f) => f.timestamp).join(', ')})`,
        source: 'video_consensus',
        frameNumber: primaryInstance.frameNumber,
        timestamp: primaryInstance.timestamp,
        frameEvidence: frameEvidenceList,
      });
    } else {
      const sortedGroups = Object.values(valueGroups).sort(
        (a, b) => b.instances.length - a.instances.length || b.maxConf - a.maxConf
      );

      const topGroup = sortedGroups[0];
      const conflictValues = sortedGroups.map((g) => g.representativeValue).join(' vs ');

      fused.push({
        field,
        label: topGroup.label,
        value: topGroup.representativeValue,
        confidence: 65,
        status: 'conflicting',
        rule: topGroup.rule,
        evidence: `Conflicting frames: ${conflictValues}`,
        source: 'video_conflict',
        candidates: sortedGroups.map((g) => g.representativeValue),
        frameNumber: topGroup.instances[0]?.frameNumber,
        timestamp: topGroup.instances[0]?.timestamp,
        frameEvidence: topGroup.instances.map((i) => ({
          frameNumber: i.frameNumber,
          timestamp: i.timestamp,
        })),
      });
    }
  }

  return fused;
}

function selectBestRepresentativeFrame(frameResults) {
  if (!frameResults || frameResults.length === 0) return null;

  let bestFrame = frameResults[0];
  let maxDetected = -1;
  let maxSharpness = -1;

  for (const fr of frameResults) {
    const detectedCount = fr.declarations.filter((d) => d.status === 'detected').length;
    if (detectedCount > maxDetected || (detectedCount === maxDetected && fr.sharpness > maxSharpness)) {
      maxDetected = detectedCount;
      maxSharpness = fr.sharpness;
      bestFrame = fr;
    }
  }

  return bestFrame;
}
