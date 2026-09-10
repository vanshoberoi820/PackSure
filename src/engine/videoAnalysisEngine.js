/* ─────────────────────────────────────────────
   Video Analysis Engine — Multi-Frame OCR & Information Fusion
   Combines declarations across 8-second video frames with consensus boosting and conflict detection
   ───────────────────────────────────────────── */
import { performFrameOCR } from './ocrEngine';
import { extractDeclarations } from './extractionEngine';
import { evaluateCompliance } from './complianceEngine';

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

  // 1. Run sequential OCR across frames
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const pct = Math.round(((i + 1) / frames.length) * 80);

    onProgress({
      step: 1,
      label: `Analyzing Frame ${frame.frameNumber}/${frames.length} (${frame.timestamp})…`,
      progress: pct,
      currentFrame: i + 1,
      totalFrames: frames.length,
    });

    const ocr = await performFrameOCR(frame.dataUrl);

    if (ocr.text && ocr.text.length > 5) {
      combinedOcrText += `\n--- [Frame ${frame.frameNumber} @ ${frame.timestamp}] ---\n${ocr.text}\n`;
      totalConfidence += ocr.confidence;
      validConfidenceCount++;
    }

    const frameDeclarations = extractDeclarations(ocr.text, ocr.confidence, {
      frameNumber: frame.frameNumber,
      timestamp: frame.timestamp,
      source: 'video_frame',
    });

    frameResults.push({
      frameNumber: frame.frameNumber,
      timestamp: frame.timestamp,
      dataUrl: frame.dataUrl,
      sharpness: frame.sharpness,
      ocrText: ocr.text,
      ocrConfidence: ocr.confidence,
      declarations: frameDeclarations,
    });
  }

  onProgress({
    step: 2,
    label: 'Fusing multi-frame declarations & resolving consensus…',
    progress: 90,
  });

  // 2. Perform Multi-Frame Information Fusion
  const fusedDeclarations = fuseFrameDeclarations(frameResults);

  const avgOcrConfidence = validConfidenceCount > 0
    ? Math.round(totalConfidence / validConfidenceCount)
    : 70;

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
    scanMetadata: {
      type: 'video',
      durationSeconds: 8,
      framesAnalyzed: frames.length,
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
  // Field templates
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
      // Find template label & rule from first frame
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
      // Unanimous consensus across all detecting frames!
      const group = valueGroups[groupKeys[0]];
      const count = group.instances.length;
      // Boost confidence if multiple frames confirm the same value
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
      // Conflicting values detected across different frames!
      // Sort groups by instance count and max confidence
      const sortedGroups = Object.values(valueGroups).sort(
        (a, b) => b.instances.length - a.instances.length || b.maxConf - a.maxConf
      );

      const topGroup = sortedGroups[0];
      const conflictValues = sortedGroups.map((g) => g.representativeValue).join(' vs ');

      fused.push({
        field,
        label: topGroup.label,
        value: topGroup.representativeValue,
        confidence: 65, // Lowered due to conflict
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

/**
 * Pick the best representative frame (highest detected declarations + sharpness).
 */
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
