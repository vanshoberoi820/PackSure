import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Video,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  Check,
  ArrowLeft,
  ShieldAlert,
  Volume2,
  VolumeX,
  Square,
  ArrowRight,
  Tag,
  Calendar,
  CalendarClock,
  Scale,
  Building2,
  Bot,
  Barcode,
  QrCode,
  CheckCircle2,
  Plus,
  Trash2,
  Layers,
  FileCheck,
} from 'lucide-react';
import { performOCR, assessImageQuality } from '../engine/ocrEngine';
import { extractDeclarations } from '../engine/extractionEngine';
import { evaluateCompliance } from '../engine/complianceEngine';
import { analyzeVideoFrames } from '../engine/videoAnalysisEngine';
import { detectBarcodes } from '../engine/barcodeEngine';
import { analyzePackageWithAI, isAIVisionConfigured } from '../engine/aiVisionEngine';
import {
  saveInspection,
  generateInspectionId,
  getVoiceAssistantEnabled,
  setVoiceAssistantEnabled,
} from '../utils/storage';
import { imageToBase64, resizeImage } from '../utils/imageUtils';
import {
  getCameraStream,
  stopMediaStream,
  recordProductVideo,
  extractFramesFromVideo,
  isVideoRecordingSupported,
} from '../utils/videoUtils';
import { getDemoInspection } from '../demo/demoData';
import {
  buildKeyDeclarationsData,
  runVoiceAssistantSequence,
  stopSpeech,
  setVoiceMuted,
} from '../utils/voiceAssistant';
import { uploadImageToS3 } from '../utils/s3Upload';

function getIconForField(fieldId) {
  switch (fieldId) {
    case 'mrp':
      return Tag;
    case 'mfgDate':
      return Calendar;
    case 'useBy':
    case 'bestBefore':
      return CalendarClock;
    case 'netWeight':
      return Scale;
    case 'manufactureOrigin':
      return Building2;
    default:
      return Bot;
  }
}

export default function ScanPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const secondFileInputRef = useRef(null);
  const secondCameraInputRef = useRef(null);
  const liveVideoRef = useRef(null);

  // Multi-image state (up to 2 images for front + back panels)
  const [images, setImages] = useState([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  const [isDemo, setIsDemo] = useState(false);
  const [scanType, setScanType] = useState('image'); // 'image' | 'video' | 'demo'
  const [step, setStep] = useState('select'); // 'select', 'recording_video', 'preview', 'analyzing'
  const [analysisProgress, setAnalysisProgress] = useState({ step: 0, label: '', progress: 0 });
  const [error, setError] = useState(null);

  // Video recording states
  const [recordingStream, setRecordingStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState({ elapsedMs: 0, remainingSec: 15, progressPct: 0 });
  const [videoBlob, setVideoBlob] = useState(null);
  const [liveBarcodes, setLiveBarcodes] = useState([]);
  const recorderControlRef = useRef(null);

  // Voice Assistant states
  const [voiceAssistantPref, setVoiceAssistantPref] = useState(() => getVoiceAssistantEnabled());
  const skipVoiceRequestedRef = useRef(false);
  const [keyDeclarations, setKeyDeclarations] = useState([]);
  const [activeVoiceIndex, setActiveVoiceIndex] = useState(-1);
  const [completedIndices, setCompletedIndices] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [currentInspectionId, setCurrentInspectionId] = useState(null);
  const [voiceStatusText, setVoiceStatusText] = useState('Analyzing package label…');

  // Stop speech & release camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopSpeech();
      if (recorderControlRef.current) {
        try { recorderControlRef.current.stop(); } catch (_) {}
      }
      if (recordingStream) {
        stopMediaStream(recordingStream);
      }
    };
  }, [recordingStream]);

  // Real-time Barcode scanning loop during live video
  useEffect(() => {
    let intervalId;
    if (step === 'recording_video' && liveVideoRef.current) {
      intervalId = setInterval(async () => {
        if (liveVideoRef.current && liveVideoRef.current.readyState >= 2) {
          try {
            const barcodes = await detectBarcodes(liveVideoRef.current);
            if (barcodes && barcodes.length > 0) {
              setLiveBarcodes(barcodes);
            }
          } catch (_) {}
        }
      }, 600);
    }
    return () => clearInterval(intervalId);
  }, [step]);

  // Scan preview images for barcodes upon upload
  useEffect(() => {
    if (step === 'preview' && images.length > 0) {
      const allFound = [];
      const seen = new Set();

      Promise.all(
        images.map(async (img) => {
          try {
            const bcs = await detectBarcodes(img);
            if (bcs && bcs.length > 0) {
              for (const b of bcs) {
                if (!seen.has(b.rawValue)) {
                  seen.add(b.rawValue);
                  allFound.push(b);
                }
              }
            }
          } catch (_) {}
        })
      ).then(() => {
        if (allFound.length > 0) setLiveBarcodes(allFound);
      });
    }
  }, [step, images]);

  // Handle Photo / File Source
  const handleSelectSource = (mode) => {
    setError(null);
    setScanType('image');
    setLiveBarcodes([]);
    if (mode === 'camera') {
      fileInputRef.current?.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current?.removeAttribute('capture');
    }
    fileInputRef.current?.click();
  };

  // Handle primary image file selection (allows 1 or 2 images)
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 2);
    if (!files || files.length === 0) return;

    try {
      setError(null);
      setIsDemo(false);
      setScanType('image');

      const loadedImages = [];
      for (const file of files) {
        const base64 = await imageToBase64(file);
        const highRes = await resizeImage(base64, 1800, 1800, 0.95);
        loadedImages.push(highRes);
      }

      setImages(loadedImages);
      setActivePreviewIndex(0);
      setStep('preview');
    } catch (err) {
      console.error(err);
      setError('Failed to load image. Please try again.');
      setStep('select');
    }
  };

  // Handle adding a 2nd image (Back panel or additional details)
  const handleSecondFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const base64 = await imageToBase64(file);
      const highRes = await resizeImage(base64, 1800, 1800, 0.95);

      setImages((prev) => {
        const next = [...prev];
        if (next.length >= 2) {
          next[1] = highRes;
        } else {
          next.push(highRes);
        }
        return next;
      });
      setActivePreviewIndex(1);
    } catch (err) {
      console.error('Failed to add 2nd image:', err);
      setError('Failed to load 2nd image. Please try again.');
    }
  };

  // Remove the 2nd image
  const handleRemoveSecondImage = () => {
    setImages((prev) => prev.slice(0, 1));
    setActivePreviewIndex(0);
  };

  // Step 1: Open Camera Viewfinder for 15-Second Video Flow
  const handleOpenVideoCamera = async () => {
    setError(null);
    setLiveBarcodes([]);
    if (!isVideoRecordingSupported()) {
      setError('Video recording is not supported in this browser. Please use Photo or Upload.');
      return;
    }

    try {
      setScanType('video');
      setStep('recording_video');
      setIsRecording(false);
      setRecordingProgress({ elapsedMs: 0, remainingSec: 15, progressPct: 0 });

      const stream = await getCameraStream();
      setRecordingStream(stream);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();
      }
    } catch (err) {
      console.error('Camera open failed:', err);
      if (recordingStream) stopMediaStream(recordingStream);
      setRecordingStream(null);
      setError(err.message || 'Camera permission denied or unavailable.');
      setStep('select');
    }
  };

  // Step 2: Start 15-Second Recording with Live Progress
  const handleStartRecording = async () => {
    if (!recordingStream) return;
    try {
      setIsRecording(true);
      setRecordingProgress({ elapsedMs: 0, remainingSec: 15, progressPct: 0 });

      const recorder = recordProductVideo(recordingStream, {
        durationMs: 15000,
        onProgress: (p) => {
          setRecordingProgress(p);
        },
      });

      recorderControlRef.current = recorder;

      const { videoBlob: recordedBlob } = await recorder.promise;

      stopMediaStream(recordingStream);
      setRecordingStream(null);
      setIsRecording(false);
      setVideoBlob(recordedBlob);

      // Transition straight to multi-frame analysis
      handleAnalyzeVideo(recordedBlob);
    } catch (err) {
      console.error('Recording error:', err);
      setIsRecording(false);
      if (recordingStream) stopMediaStream(recordingStream);
      setRecordingStream(null);
      setError(err.message || 'Video recording was interrupted.');
      setStep('select');
    }
  };

  // Step 3: Stop Recording Early and Proceed to Analysis
  const handleStopVideoEarly = () => {
    if (recorderControlRef.current) {
      recorderControlRef.current.stop();
    }
  };

  // Cancel video recording
  const handleCancelVideo = () => {
    if (recorderControlRef.current) {
      try { recorderControlRef.current.stop(); } catch (_) {}
    }
    if (recordingStream) {
      stopMediaStream(recordingStream);
      setRecordingStream(null);
    }
    setIsRecording(false);
    setStep('select');
    setError(null);
  };

  // Load demo product
  const handleUseDemo = () => {
    setError(null);
    setIsDemo(true);
    setScanType('demo');
    setLiveBarcodes([
      { rawValue: '8904389809211', format: 'EAN_13', type: 'barcode', country: 'India', countryFlag: '🇮🇳', isValidChecksum: true }
    ]);
    setStep('preview');
    const demoInspection = getDemoInspection('TEMP');
    setImages([demoInspection.productImage]);
    setActivePreviewIndex(0);
  };

  // Retake image/video
  const handleRetake = () => {
    stopSpeech();
    if (recordingStream) stopMediaStream(recordingStream);
    setRecordingStream(null);
    setImages([]);
    setActivePreviewIndex(0);
    setVideoBlob(null);
    setIsDemo(false);
    setStep('select');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);
    setLiveBarcodes([]);
  };

  // Exit Voice Assistant & Go Directly to Report Immediately
  const handleExitVoiceAndGoToReport = (targetInspectionId) => {
    stopSpeech();
    setActiveVoiceIndex(99);
    setVoiceStatusText('Loading full compliance report…');
    const targetId = targetInspectionId || currentInspectionId;
    if (targetId) {
      navigate(`/result/${targetId}`);
    } else {
      // Analysis is still finishing OCR, flag it to skip narration as soon as analysis resolves
      skipVoiceRequestedRef.current = true;
    }
  };

  // Legacy alias
  const handleStopAndProceed = () => handleExitVoiceAndGoToReport();

  // Toggle Voice Assistant Preference (Global / Sticky)
  const handleToggleVoicePref = (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    const nextVal = !voiceAssistantPref;
    setVoiceAssistantPref(nextVal);
    setVoiceAssistantEnabled(nextVal);
  };

  // Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    setVoiceMuted(nextMuted);
  };

  // Analyze 15-Second Video
  const handleAnalyzeVideo = async (blob) => {
    setStep('analyzing');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);
    skipVoiceRequestedRef.current = false;

    const inspectionId = generateInspectionId();
    setCurrentInspectionId(inspectionId);
    const voiceEnabled = voiceAssistantPref && getVoiceAssistantEnabled();

    try {
      setAnalysisProgress({ step: 1, label: 'Extracting 5 sharp package angles…', progress: 15 });
      setVoiceStatusText('Extracting sharp angle frames…');

      const frames = await extractFramesFromVideo(blob, { targetFrameCount: 5, durationMs: 15000 });
      if (!frames || frames.length === 0) {
        throw new Error('No clear frames could be extracted from video.');
      }

      const finalBarcodes = [...liveBarcodes];

      let declarations = null;
      let combinedOcrText = '';
      let ocrConfidence = 95;
      let compliance = null;
      let videoResult = null;

      // 1. Try AI Vision Model first on sharp keyframes
      if (isAIVisionConfigured()) {
        try {
          setVoiceStatusText('AI Vision Model auditing video frames…');
          const aiResult = await analyzePackageWithAI(
            frames.map((f) => f.dataUrl),
            setAnalysisProgress,
            finalBarcodes
          );
          declarations = aiResult.declarations;
          combinedOcrText = aiResult.rawOcrText;
          ocrConfidence = aiResult.ocrConfidence;
          compliance = evaluateCompliance(declarations, ocrConfidence, combinedOcrText);
        } catch (aiErr) {
          console.warn('AI Vision on video failed, falling back to local multi-frame engine:', aiErr);
        }
      }

      // 2. Fallback to local multi-frame video analysis
      if (!declarations) {
        setVoiceStatusText(`Analyzing ${frames.length} angles for declarations…`);
        videoResult = await analyzeVideoFrames(frames, (p) => {
          setAnalysisProgress({
            step: p.step,
            label: p.label,
            progress: p.progress,
          });
          setVoiceStatusText(p.label);
        });
        declarations = videoResult.declarations;
        combinedOcrText = videoResult.ocrText;
        ocrConfidence = videoResult.ocrConfidence;
        compliance = videoResult.compliance;
        if (videoResult.detectedBarcodes?.length > 0) {
          for (const b of videoResult.detectedBarcodes) {
            if (!finalBarcodes.some((x) => x.rawValue === b.rawValue)) {
              finalBarcodes.push(b);
            }
          }
        }
      }

      let videoImageUrl = videoResult?.productImage || frames[0]?.dataUrl || null;
      if (videoImageUrl) {
        try {
          const s3Url = await uploadImageToS3(videoImageUrl, `${inspectionId}-video`);
          if (s3Url) videoImageUrl = s3Url;
        } catch (_) {}
      }

      const newInspection = {
        id: inspectionId,
        productImage: videoImageUrl,
        productName: declarations.find((d) => d.field === 'productName')?.value || 'Unknown Product',
        ocrText: combinedOcrText,
        ocrConfidence: ocrConfidence,
        declarations,
        compliance,
        detectedBarcodes: finalBarcodes,
        scanMetadata: {
          type: 'video',
          durationSeconds: 15,
          framesAnalyzed: frames.length,
          engine: isAIVisionConfigured() ? 'ai_vision_model' : 'local_ocr',
        },
        frameResults: videoResult?.frameResults || [],
        officerReview: {
          notes: '',
          decisions: {},
          completed: false,
          completedAt: null,
        },
        comparison: null,
        createdAt: new Date().toISOString(),
        status: compliance.status,
      };

      saveInspection(newInspection);

      if (skipVoiceRequestedRef.current || !voiceAssistantPref) {
        navigate(`/result/${inspectionId}`);
        return;
      }

      const items = buildKeyDeclarationsData(
        declarations,
        compliance,
        compliance?.dateAssessment
      );
      setKeyDeclarations(items);
      setAnalysisProgress({ step: 4, label: 'Voice Assistant Active', progress: 100 });

      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
        introText: '15-second video captured. AI Inspection Model fusing multi-angle declarations.',
        onItemStart: (idx, item) => {
          setActiveVoiceIndex(idx);
          if (idx >= 0) {
            setVoiceStatusText(`Announcing ${item.title}…`);
          } else {
            setVoiceStatusText('AI Voice Assistant Starting…');
          }
        },
        onItemEnd: (idx) => {
          setCompletedIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
        },
        onComplete: () => {
          setActiveVoiceIndex(99);
          setVoiceStatusText('Verification Complete. Loading report…');
          setTimeout(() => {
            navigate(`/result/${inspectionId}`);
          }, 600);
        },
      });
    } catch (err) {
      console.error('Video analysis failed:', err);
      setError(err.message || 'Video analysis failed. Please try capturing closer to the label.');
      setStep('select');
    }
  };

  // Analyze Single or Dual Image / Demo
  const handleAnalyze = async () => {
    if (!images || images.length === 0) return;

    setStep('analyzing');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);
    skipVoiceRequestedRef.current = false;

    const inspectionId = generateInspectionId();
    setCurrentInspectionId(inspectionId);
    const voiceEnabled = voiceAssistantPref && getVoiceAssistantEnabled();

    if (isDemo) {
      setAnalysisProgress({ step: 1, label: 'Reading demo label…', progress: 100 });
      await new Promise((r) => setTimeout(r, 600));

      const demoInspection = getDemoInspection(inspectionId);
      demoInspection.detectedBarcodes = liveBarcodes;
      saveInspection(demoInspection);

      if (skipVoiceRequestedRef.current || !voiceAssistantPref) {
        navigate(`/result/${inspectionId}`);
        return;
      }

      const items = buildKeyDeclarationsData(
        demoInspection.declarations,
        demoInspection.compliance,
        demoInspection.compliance?.dateAssessment
      );
      setKeyDeclarations(items);
      setAnalysisProgress({ step: 4, label: 'Voice Assistant Active', progress: 100 });

      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
        introText: 'Demo product loaded. Analyzing key declarations.',
        onItemStart: (idx, item) => {
          setActiveVoiceIndex(idx);
          if (idx >= 0) {
            setVoiceStatusText(`Announcing ${item.title}…`);
          } else {
            setVoiceStatusText('AI Voice Assistant Starting…');
          }
        },
        onItemEnd: (idx) => {
          setCompletedIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
        },
        onComplete: () => {
          setActiveVoiceIndex(99);
          setVoiceStatusText('Verification Complete. Loading report…');
          setTimeout(() => {
            navigate(`/result/${inspectionId}`);
          }, 600);
        },
      });
      return;
    }

    try {
      const allBarcodes = [...liveBarcodes];
      const seenBarcodes = new Set(allBarcodes.map((b) => b.rawValue));

      let declarations = null;
      let combinedOcrText = '';
      let avgConfidence = 95;

      // 1. Try AI Vision Model first (high-precision extraction)
      if (isAIVisionConfigured()) {
        try {
          setVoiceStatusText(images.length > 1 ? 'AI Vision Model fusing dual panels…' : 'AI Vision Model auditing declarations…');
          const aiResult = await analyzePackageWithAI(images, setAnalysisProgress, allBarcodes);
          declarations = aiResult.declarations;
          combinedOcrText = aiResult.rawOcrText;
          avgConfidence = aiResult.ocrConfidence;
        } catch (aiErr) {
          console.warn('AI Vision request failed, falling back to local OCR engine:', aiErr);
        }
      }

      // 2. Fallback to Local OCR engine if AI Vision is not available or failed
      if (!declarations) {
        if (images.length === 1) {
          setAnalysisProgress({ step: 0, label: 'Optimizing label readability…', progress: 10 });
          setVoiceStatusText('Enhancing resolution & contrast…');

          const ocrResult = await performOCR(images[0], (p) => {
            setAnalysisProgress({ step: p.step, label: p.label, progress: p.progress });
            setVoiceStatusText(p.label);
          });

          combinedOcrText = ocrResult.text;
          avgConfidence = ocrResult.confidence;

          if (ocrResult.detectedBarcodes) {
            for (const b of ocrResult.detectedBarcodes) {
              if (!seenBarcodes.has(b.rawValue)) {
                seenBarcodes.add(b.rawValue);
                allBarcodes.push(b);
              }
            }
          }
        } else {
          setAnalysisProgress({ step: 1, label: 'Scanning Panel 1 (Front / Table)…', progress: 20 });
          setVoiceStatusText('Reading Panel 1 declarations…');

          const ocr1 = await performOCR(images[0], (p) => {
            setAnalysisProgress({ step: 1, label: `Panel 1: ${p.label}`, progress: Math.round(p.progress * 0.45) });
            setVoiceStatusText(`Reading Panel 1: ${p.label}`);
          });

          setAnalysisProgress({ step: 2, label: 'Scanning Panel 2 (Back / Legal Details)…', progress: 50 });
          setVoiceStatusText('Reading Panel 2 declarations…');

          const ocr2 = await performOCR(images[1], (p) => {
            setAnalysisProgress({ step: 2, label: `Panel 2: ${p.label}`, progress: 50 + Math.round(p.progress * 0.45) });
            setVoiceStatusText(`Reading Panel 2: ${p.label}`);
          });

          combinedOcrText = `--- [Panel 1 / Front / Table] ---\n${ocr1.text}\n\n--- [Panel 2 / Back / Legal Details] ---\n${ocr2.text}`;
          avgConfidence = Math.round(((ocr1.confidence || 75) + (ocr2.confidence || 75)) / 2);

          [...(ocr1.detectedBarcodes || []), ...(ocr2.detectedBarcodes || [])].forEach((b) => {
            if (!seenBarcodes.has(b.rawValue)) {
              seenBarcodes.add(b.rawValue);
              allBarcodes.push(b);
            }
          });
        }

        setAnalysisProgress({ step: 3, label: 'Fusing Legal Metrology declarations…', progress: 85 });
        setVoiceStatusText('Parsing Rule 6 declarations…');

        declarations = extractDeclarations(combinedOcrText, avgConfidence, {
          source: images.length > 1 ? 'dual_panel_image' : 'single_image',
          detectedBarcodes: allBarcodes,
        });
      }

      setAnalysisProgress({ step: 4, label: 'Legal Metrology compliance check…', progress: 95 });
      const compliance = evaluateCompliance(declarations, avgConfidence, combinedOcrText);

      // S3 Cloud Upload
      let primaryUrl = images[0];
      let secondaryUrl = images[1] || null;

      try {
        if (images[0]) {
          const s3_1 = await uploadImageToS3(images[0], `${inspectionId}-panel1`);
          if (s3_1) primaryUrl = s3_1;
        }
        if (images[1]) {
          const s3_2 = await uploadImageToS3(images[1], `${inspectionId}-panel2`);
          if (s3_2) secondaryUrl = s3_2;
        }
      } catch (_) {}

      const newInspection = {
        id: inspectionId,
        productImage: primaryUrl,
        secondaryImage: secondaryUrl,
        extraImages: [primaryUrl, ...(secondaryUrl ? [secondaryUrl] : [])],
        productName: declarations.find((d) => d.field === 'productName')?.value || 'Unknown Product',
        ocrText: combinedOcrText,
        ocrConfidence: avgConfidence,
        declarations,
        compliance,
        detectedBarcodes: allBarcodes,
        scanMetadata: {
          type: images.length > 1 ? 'dual_panel' : 'single_image',
          panelCount: images.length,
          engine: isAIVisionConfigured() ? 'ai_vision_model' : 'local_ocr',
        },
        frameResults: [],
        officerReview: {
          notes: '',
          decisions: {},
          completed: false,
          completedAt: null,
        },
        comparison: null,
        createdAt: new Date().toISOString(),
        status: compliance.status,
      };

      saveInspection(newInspection);

      if (skipVoiceRequestedRef.current || !voiceAssistantPref) {
        navigate(`/result/${inspectionId}`);
        return;
      }

      const items = buildKeyDeclarationsData(declarations, compliance, compliance.dateAssessment);
      setKeyDeclarations(items);
      setAnalysisProgress({ step: 4, label: 'Voice Assistant Active', progress: 100 });

      const introMsg = images.length > 1
        ? 'Dual product panels scanned. AI Inspection Model announcing declarations.'
        : 'Product scanned. AI Inspection Model announcing declarations.';

      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
        introText: introMsg,
        onItemStart: (idx, item) => {
          setActiveVoiceIndex(idx);
          if (idx >= 0) {
            setVoiceStatusText(`Announcing ${item.title}…`);
          } else {
            setVoiceStatusText('AI Voice Assistant Starting…');
          }
        },
        onItemEnd: (idx) => {
          setCompletedIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
        },
        onComplete: () => {
          setActiveVoiceIndex(99);
          setVoiceStatusText('Verification Complete. Loading report…');
          setTimeout(() => {
            navigate(`/result/${inspectionId}`);
          }, 600);
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Analysis service failed. Please capture a clearer image.');
      setStep('preview');
    }
  };

  const primaryImage = images[0] || null;
  const currentPreviewImage = images[activePreviewIndex] || primaryImage;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-6">
      {/* Hidden file input for primary capture/upload (supports multiple) */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Hidden file input for 2nd image gallery upload */}
      <input
        type="file"
        ref={secondFileInputRef}
        onChange={handleSecondFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Hidden file input for 2nd image camera capture */}
      <input
        type="file"
        ref={secondCameraInputRef}
        onChange={handleSecondFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Header (Hidden during active camera recording for full-screen view) */}
      {step !== 'recording_video' && (
        <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                stopSpeech();
                if (recordingStream) stopMediaStream(recordingStream);
                navigate('/');
              }}
              className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">
              {step === 'analyzing'
                ? 'Live Verification'
                : 'Scan Product'}
            </h1>
          </div>

          {step === 'analyzing' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMute}
                className={`p-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all ${
                  isMuted
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'bg-primary-50 border-primary-200 text-primary-700 shadow-xs'
                }`}
                title={isMuted ? 'Unmute Voice Assistant' : 'Mute Voice Assistant'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Voice ON'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Select Scan Source */}
      {step === 'select' && (
        <div className="flex-1 flex flex-col justify-center px-6 py-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-primary-100 shadow-sm">
              <Camera className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Smart Product Inspection</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Scan pre-packaged commodities to verify MRP, Net Quantity, Mfg/Expiry dates, and Legal Metrology Rule 6 declarations.
            </p>
          </div>

          <div className="space-y-3.5">
            {/* 15-Sec Video Scan (Featured) */}
            <button
              onClick={handleOpenVideoCamera}
              className="w-full p-4 bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-between text-left relative overflow-hidden group"
            >
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">Record 15-Sec 360° Video</span>
                    <span className="bg-amber-400 text-amber-950 font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-primary-100 mt-0.5">
                    Multi-frame OCR + Barcode detection with Start / Stop control
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform relative z-10" />
            </button>

            {/* Photo Capture */}
            <button
              onClick={() => handleSelectSource('camera')}
              className="btn-outline flex items-center justify-center gap-3 py-3.5 w-full bg-white shadow-xs font-semibold"
            >
              <Camera className="w-5 h-5 text-gray-700" />
              Take Photo (Front Panel)
            </button>

            {/* Image Upload (Supports selecting up to 2 images) */}
            <button
              onClick={() => handleSelectSource('upload')}
              className="btn-outline flex items-center justify-center gap-3 py-3.5 w-full bg-white shadow-xs font-semibold"
            >
              <ImageIcon className="w-5 h-5 text-gray-700" />
              Upload Images (Select 1 or 2 Panels)
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <hr className="w-full border-gray-200" />
              <span className="absolute bg-gray-50 px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                OR
              </span>
            </div>

            {/* Demo Product */}
            <button
              onClick={handleUseDemo}
              className="w-full py-3.5 bg-amber-50 text-amber-900 border-2 border-dashed border-amber-300 rounded-xl hover:bg-amber-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 font-bold text-sm shadow-xs"
            >
              <Sparkles className="w-5 h-5 text-amber-600" />
              Use Demo Product (SIH Hackathon)
            </button>
          </div>

          {error && (
            <div className="mt-5 p-4 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-700 text-xs">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* STEP 1.5: Video Live Recording Viewfinder (Fullscreen Fixed for Mobile Phones) */}
      {step === 'recording_video' && (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between p-4 h-[100dvh] max-w-md mx-auto overflow-hidden">
          {/* Top Status & Timer Bar */}
          <div className="relative z-20 bg-black/80 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/20 flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  isRecording ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isRecording ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {isRecording ? 'Recording 360° Video…' : 'Camera Ready'}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono font-bold text-sm bg-white/15 px-3 py-1 rounded-lg">
              <span className={isRecording ? 'text-rose-300' : 'text-white'}>
                00:{String(recordingProgress.remainingSec).padStart(2, '0')}
              </span>
              <span className="text-gray-400 text-xs">/ 00:15</span>
            </div>
          </div>

          {/* Progress Bar (Visible when recording) */}
          {isRecording && (
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden my-1 relative z-20 shrink-0">
              <div
                className="bg-gradient-to-r from-emerald-400 to-primary-400 h-full transition-all duration-150"
                style={{ width: `${recordingProgress.progressPct}%` }}
              />
            </div>
          )}

          {/* Live Camera Viewport */}
          <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-white/10 shadow-inner my-2">
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Live Detected Barcode Pill Overlay */}
            {liveBarcodes.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-30 flex flex-col items-center gap-1.5 pointer-events-auto animate-fade-in">
                {liveBarcodes.map((bc, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/90 backdrop-blur-md border border-white/25 text-white px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs max-w-sm w-full"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                      {bc.type === 'qr' ? <QrCode className="w-3.5 h-3.5" /> : <Barcode className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">
                          {bc.type === 'qr' ? 'QR Code Detected' : 'Barcode Detected'}
                        </span>
                        {bc.country && (
                          <span className="bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                            {bc.countryFlag} {bc.country}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-gray-300 truncate mt-0.5">
                        {bc.rawValue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start & Stop Controls (Pinned & Always Visible at Screen Bottom) */}
          <div className="relative z-30 pt-1 pb-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelVideo}
                className="px-4 py-3.5 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white font-semibold rounded-2xl text-xs border border-white/20 transition-all shrink-0"
              >
                Cancel
              </button>

              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="flex-1 py-4 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl shadow-emerald-950/80 active:scale-[0.98] transition-all"
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white animate-ping" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={handleStopVideoEarly}
                  className="flex-1 py-4 bg-gradient-to-r from-rose-600 via-rose-700 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-2xl shadow-rose-950/80 active:scale-[0.98] transition-all animate-pulse"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop Recording & Analyze
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview before analyzing (Supports 1 or 2 images) */}
      {step === 'preview' && images.length > 0 && (
        <div className="flex-1 flex flex-col p-5 space-y-4">
          {/* Header with Panel Selector Tabs if 2 images */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary-600" />
                {images.length > 1 ? 'Dual Panel Inspection' : 'Label Preview'}
              </h2>
              <p className="text-[11px] text-gray-500">
                {images.length > 1
                  ? 'Both panels will be fused for 100% Rule 6 compliance'
                  : 'Front or primary declaration panel ready'}
              </p>
            </div>

            {images.length > 1 && (
              <span className="bg-primary-50 text-primary-700 border border-primary-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                <Layers className="w-3 h-3 text-primary-600" /> 2 Images Loaded
              </span>
            )}
          </div>

          {/* Panel Selector Tabs (When 2 images are loaded) */}
          {images.length > 1 && (
            <div className="flex rounded-xl bg-gray-200/80 p-1 gap-1">
              <button
                onClick={() => setActivePreviewIndex(0)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activePreviewIndex === 0
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Panel 1 (Front / Table)</span>
              </button>
              <button
                onClick={() => setActivePreviewIndex(1)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activePreviewIndex === 1
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Panel 2 (Back / Legal)</span>
              </button>
            </div>
          )}

          {/* Main Active Image Viewport */}
          <div className="flex-1 min-h-[260px] max-h-[380px] bg-slate-900 rounded-2xl overflow-hidden shadow-md flex items-center justify-center relative border border-slate-800">
            <img
              src={currentPreviewImage}
              alt={`Product Label Panel ${activePreviewIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Panel Badge */}
            <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg border border-white/20">
              {activePreviewIndex === 0 ? 'Panel 1: Front / Table' : 'Panel 2: Back / Declarations'}
            </span>

            {isDemo && (
              <span className="absolute top-3 right-3 bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">
                DEMO MODE
              </span>
            )}

            {/* Live Detected Barcode Pill Overlay on Preview */}
            {liveBarcodes.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col items-center gap-1.5">
                {liveBarcodes.map((bc, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/90 backdrop-blur-md border border-white/25 text-white px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2.5 text-xs max-w-sm w-full"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center text-white shrink-0">
                      {bc.type === 'qr' ? <QrCode className="w-3.5 h-3.5" /> : <Barcode className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-white text-[11px]">
                        <span>{bc.type === 'qr' ? 'QR Code' : 'Barcode'}</span>
                        {bc.country && (
                          <span className="bg-emerald-500/20 text-emerald-300 text-[9px] px-1.5 py-0.2 rounded border border-emerald-500/30">
                            {bc.countryFlag} {bc.country}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-gray-300 truncate">{bc.rawValue}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add 2nd Image / Dual Panel Management Card */}
          {images.length === 1 ? (
            <div className="card p-3.5 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary-600" />
                  Add 2nd Image (Back Panel)
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                  Capture back label for 100% manufacturer, FSSAI & consumer care details.
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => secondCameraInputRef.current?.click()}
                  className="px-2.5 py-2 bg-white border border-gray-200 hover:border-primary-400 text-gray-700 text-[11px] font-bold rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                  title="Take photo of back panel"
                >
                  <Camera className="w-3.5 h-3.5 text-primary-600" />
                  Camera
                </button>
                <button
                  onClick={() => secondFileInputRef.current?.click()}
                  className="px-2.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                  title="Upload back panel from gallery"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-3 bg-gray-50/80 border border-gray-200 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-gray-800 text-[11px] block">
                    Dual Panel Joint Analysis Ready
                  </span>
                  <p className="text-[10px] text-gray-500 truncate">
                    Panel 1 (Front) + Panel 2 (Back)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => secondFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg hover:bg-gray-50 active:scale-95 transition-all"
                >
                  Replace 2nd
                </button>
                <button
                  onClick={handleRemoveSecondImage}
                  className="p-1.5 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 rounded-lg active:scale-95 transition-all"
                  title="Remove 2nd Image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-700 text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Voice Assistant Preference Toggle in Preview Setup */}
          <div
            onClick={handleToggleVoicePref}
            className="p-3 bg-white rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-all select-none"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  voiceAssistantPref ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 leading-tight">AI Voice Assistant Narration</p>
                <p className="text-[10px] text-gray-500">
                  {voiceAssistantPref
                    ? 'Spoken summary of key declarations after scan'
                    : 'Disabled • Opens report immediately after scan'}
                </p>
              </div>
            </div>
            <div
              className={`w-10 h-5.5 rounded-full relative transition-colors ${
                voiceAssistantPref ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <div
                className={`absolute top-0.5 bg-white w-4.5 h-4.5 rounded-full shadow-xs transition-all ${
                  voiceAssistantPref ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-3.5">
            <button
              onClick={handleRetake}
              className="btn-secondary py-3.5 flex items-center justify-center gap-2 text-xs font-bold"
            >
              <RefreshCw className="w-4 h-4" />
              Retake / Clear
            </button>
            <button
              onClick={handleAnalyze}
              className="btn-primary py-3.5 flex items-center justify-center gap-2 text-xs font-bold shadow-lg shadow-primary-500/25"
            >
              <Check className="w-4 h-4" />
              {images.length > 1 ? 'Analyze Both Panels' : 'Analyze Product'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Voice Assistant & Multi-Metric Processing HUD */}
      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col justify-between p-5 space-y-4">
          <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute left-1/3 -top-10 w-20 h-20 bg-indigo-400/20 rounded-full blur-lg pointer-events-none" />

            <div className="flex items-center justify-between relative z-10 mb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
                  <Bot className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    AI Voice Compliance Assistant
                  </h2>
                  <p className="text-[11px] text-primary-200 font-medium leading-none">
                    {scanType === 'video'
                      ? 'Multi-Frame Legal Metrology Consensus'
                      : images.length > 1
                      ? 'Dual Panel Front & Back Declaration Fusion'
                      : 'Auditing Legal Metrology Rule 6 Declarations'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isMuted && activeVoiceIndex >= 0 && activeVoiceIndex < keyDeclarations.length && (
                  <div className="flex items-end gap-1 h-5 px-2 py-1 bg-white/15 rounded-lg border border-white/20">
                    <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-3" />
                    <span className="w-1 bg-emerald-300 rounded-full animate-[bounce_0.8s_infinite_300ms] h-4" />
                    <span className="w-1 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms] h-2" />
                    <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-5" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 bg-black/20 rounded-xl px-3 py-2 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/90 font-medium truncate flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {voiceStatusText}
              </span>
              <span className="text-[10px] text-primary-200 font-mono font-semibold ml-2 shrink-0">
                {activeVoiceIndex >= 0 && activeVoiceIndex < keyDeclarations.length
                  ? `${activeVoiceIndex + 1} / ${keyDeclarations.length}`
                  : activeVoiceIndex === 99
                  ? `${keyDeclarations.length} / ${keyDeclarations.length}`
                  : 'Processing'}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 flex-1 flex flex-col justify-center">
            {keyDeclarations.length > 0 ? (
              keyDeclarations.map((item, idx) => {
                const isActive = activeVoiceIndex === idx;
                const isDone = completedIndices.includes(idx) || activeVoiceIndex > idx;
                const IconComponent = getIconForField(item.id);

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-3.5 border transition-all duration-300 relative overflow-hidden ${
                      isActive
                        ? 'bg-blue-50/90 border-primary-500 shadow-md ring-2 ring-primary-400/30 scale-[1.01]'
                        : isDone
                        ? 'bg-white border-emerald-200 shadow-xs'
                        : 'bg-white/60 border-gray-200 opacity-60'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary-600" />
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-primary-600 text-white shadow-sm'
                              : isDone
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-gray-900 leading-tight">
                              {item.title}
                            </h3>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {item.subtitle}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-gray-800 mt-1 truncate">
                            {item.value || 'Not Detected'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Verified
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 bg-primary-100 text-primary-800 border border-primary-200 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            Speaking…
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium px-2 py-0.5 rounded-full bg-gray-100">
                            Queued
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-3 py-6 text-center">
                <div className="w-12 h-12 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">{analysisProgress.label || 'Detecting declarations…'}</p>
                <p className="text-xs text-gray-400">
                  {images.length > 1
                    ? 'Dual-panel OCR fusion running concurrently in browser'
                    : 'Tesseract OCR + Barcode engine running in browser'}
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              onClick={() => handleExitVoiceAndGoToReport()}
              className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-900 font-bold rounded-2xl shadow-sm border border-gray-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <span>Skip Voice</span>
            </button>

            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <button
                type="button"
                onClick={handleToggleVoicePref}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors text-left cursor-pointer"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                    !voiceAssistantPref ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white'
                  }`}
                >
                  {!voiceAssistantPref && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
                <span className="text-[11px] font-medium">Turn off voice assistant for future scans</span>
              </button>

              <button
                onClick={handleRetake}
                className="text-gray-400 hover:text-rose-600 font-medium text-[11px] cursor-pointer"
              >
                Cancel Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
