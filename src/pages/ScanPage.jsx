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
  CalendarClock,
  Scale,
  Building2,
  Bot,
  Barcode,
  QrCode,
  CheckCircle2,
} from 'lucide-react';
import { performOCR, assessImageQuality } from '../engine/ocrEngine';
import { extractDeclarations } from '../engine/extractionEngine';
import { evaluateCompliance } from '../engine/complianceEngine';
import { analyzeVideoFrames } from '../engine/videoAnalysisEngine';
import { detectBarcodes } from '../engine/barcodeEngine';
import {
  saveInspection,
  generateInspectionId,
  getVoiceAssistantEnabled,
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
    case 'useBy':
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
  const liveVideoRef = useRef(null);

  // State variables
  const [image, setImage] = useState(null);
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

  // Scan preview image for barcodes immediately upon upload
  useEffect(() => {
    if (step === 'preview' && image) {
      detectBarcodes(image).then((bc) => {
        if (bc && bc.length > 0) {
          setLiveBarcodes(bc);
        }
      }).catch(() => {});
    }
  }, [step, image]);

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

  // Handle image file selection
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStep('preview');
      setIsDemo(false);
      setScanType('image');
      const base64 = await imageToBase64(file);
      const highRes = await resizeImage(base64, 1800, 1800, 0.95);
      setImage(highRes);

      // Trigger instant background barcode scan
      detectBarcodes(highRes).then((bcs) => {
        if (bcs && bcs.length > 0) setLiveBarcodes(bcs);
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load image. Please try again.');
      setStep('select');
    }
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
    setImage(demoInspection.productImage);
  };

  // Retake image/video
  const handleRetake = () => {
    stopSpeech();
    if (recordingStream) stopMediaStream(recordingStream);
    setRecordingStream(null);
    setImage(null);
    setVideoBlob(null);
    setIsDemo(false);
    setStep('select');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);
    setLiveBarcodes([]);
  };

  // Stop Voice & Go Directly to Report
  const handleStopAndProceed = () => {
    stopSpeech();
    if (currentInspectionId) {
      navigate(`/result/${currentInspectionId}`);
    }
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

    const inspectionId = generateInspectionId();
    setCurrentInspectionId(inspectionId);
    const voiceEnabled = getVoiceAssistantEnabled();

    try {
      setAnalysisProgress({ step: 1, label: 'Extracting 5 sharp package angles…', progress: 15 });
      setVoiceStatusText('Extracting sharp angle frames…');

      const frames = await extractFramesFromVideo(blob, { targetFrameCount: 5, durationMs: 15000 });
      if (!frames || frames.length === 0) {
        throw new Error('No clear frames could be extracted from video.');
      }

      setVoiceStatusText(`Analyzing ${frames.length} angles for declarations…`);

      const videoResult = await analyzeVideoFrames(frames, (p) => {
        setAnalysisProgress({
          step: p.step,
          label: p.label,
          progress: p.progress,
        });
        setVoiceStatusText(p.label);
      });

      const finalBarcodes = videoResult.detectedBarcodes?.length > 0
        ? videoResult.detectedBarcodes
        : liveBarcodes;

      let videoImageUrl = videoResult.productImage;
      if (videoImageUrl) {
        try {
          const s3Url = await uploadImageToS3(videoImageUrl, `${inspectionId}-video`);
          if (s3Url) videoImageUrl = s3Url;
        } catch (_) {}
      }

      const newInspection = {
        id: inspectionId,
        productImage: videoImageUrl,
        productName: videoResult.productName,
        ocrText: videoResult.ocrText,
        ocrConfidence: videoResult.ocrConfidence,
        declarations: videoResult.declarations,
        compliance: videoResult.compliance,
        detectedBarcodes: finalBarcodes,
        scanMetadata: videoResult.scanMetadata,
        frameResults: videoResult.frameResults,
        officerReview: {
          notes: '',
          decisions: {},
          completed: false,
          completedAt: null,
        },
        comparison: null,
        createdAt: new Date().toISOString(),
        status: videoResult.compliance.status,
      };

      saveInspection(newInspection);

      const items = buildKeyDeclarationsData(
        videoResult.declarations,
        videoResult.compliance,
        videoResult.compliance?.dateAssessment
      );
      setKeyDeclarations(items);
      setAnalysisProgress({ step: 4, label: 'Voice Assistant Active', progress: 100 });

      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
        introText: '15-second video captured. Fusing multi-angle packaging declarations.',
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

  // Analyze Single Image / Demo
  const handleAnalyze = async () => {
    setStep('analyzing');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);

    const inspectionId = generateInspectionId();
    setCurrentInspectionId(inspectionId);
    const voiceEnabled = getVoiceAssistantEnabled();

    if (isDemo) {
      setAnalysisProgress({ step: 1, label: 'Reading demo label…', progress: 100 });
      await new Promise((r) => setTimeout(r, 600));

      const demoInspection = getDemoInspection(inspectionId);
      demoInspection.detectedBarcodes = liveBarcodes;
      saveInspection(demoInspection);

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
      setAnalysisProgress({ step: 0, label: 'Optimizing label readability…', progress: 10 });
      setVoiceStatusText('Enhancing resolution & contrast…');
      await new Promise((r) => setTimeout(r, 300));

      const ocrResult = await performOCR(image, (p) => {
        setAnalysisProgress({
          step: p.step,
          label: p.label,
          progress: p.progress,
        });
        setVoiceStatusText(p.label);
      });

      const finalBarcodes = ocrResult.detectedBarcodes?.length > 0
        ? ocrResult.detectedBarcodes
        : liveBarcodes;

      const qualityAssess = assessImageQuality(ocrResult);
      if (!qualityAssess.usable) {
        setError(qualityAssess.message);
        setStep('preview');
        return;
      }

      setAnalysisProgress({ step: 3, label: 'Extracting legal declarations…', progress: 65 });
      setVoiceStatusText('Parsing Legal Metrology declarations…');
      const declarations = extractDeclarations(ocrResult.text, ocrResult.confidence, {
        source: 'single_image',
        detectedBarcodes: finalBarcodes,
      });

      setAnalysisProgress({ step: 4, label: 'Legal Metrology compliance check…', progress: 90 });
      const compliance = evaluateCompliance(declarations, ocrResult.confidence, ocrResult.text);

      let finalImageUrl = image;
      if (image) {
        try {
          const s3Url = await uploadImageToS3(image, inspectionId);
          if (s3Url) finalImageUrl = s3Url;
        } catch (_) {}
      }

      const newInspection = {
        id: inspectionId,
        productImage: finalImageUrl,
        productName: declarations.find((d) => d.field === 'productName')?.value || 'Unknown Product',
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        declarations,
        compliance,
        detectedBarcodes: finalBarcodes,
        scanMetadata: {
          type: 'single_image',
          quality: qualityAssess.quality,
          sharpness: qualityAssess.sharpness,
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

      const items = buildKeyDeclarationsData(declarations, compliance, compliance.dateAssessment);
      setKeyDeclarations(items);
      setAnalysisProgress({ step: 4, label: 'Voice Assistant Active', progress: 100 });

      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
        introText: 'Label scanned. AI Voice Assistant announcing key declarations.',
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
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
              : step === 'recording_video'
              ? (isRecording ? 'Recording 360° Video' : '360° Video Camera')
              : 'Scan Product'}
          </h1>
        </div>

        {step === 'analyzing' && (
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
        )}
      </div>

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
              Take Single Photo
            </button>

            {/* Image Upload */}
            <button
              onClick={() => handleSelectSource('upload')}
              className="btn-outline flex items-center justify-center gap-3 py-3.5 w-full bg-white shadow-xs font-semibold"
            >
              <ImageIcon className="w-5 h-5 text-gray-700" />
              Upload Image from Gallery
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

      {/* STEP 1.5: 15-Second Video Live Recording Viewfinder */}
      {step === 'recording_video' && (
        <div className="flex-1 flex flex-col justify-between p-4 bg-black text-white relative overflow-hidden">
          {/* Top Timer Bar */}
          <div className="relative z-10 bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  isRecording ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isRecording ? 'text-rose-400' : 'text-emerald-300'
                }`}
              >
                {isRecording ? 'Recording 360° Label' : 'Camera Ready'}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono font-bold text-sm bg-white/10 px-3 py-1 rounded-lg">
              <span>00:{String(recordingProgress.remainingSec).padStart(2, '0')}</span>
              <span className="text-gray-400 text-xs">/ 00:15</span>
            </div>
          </div>

          {/* Progress Bar (Visible when recording) */}
          {isRecording && (
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden my-2 relative z-10">
              <div
                className="bg-gradient-to-r from-emerald-400 to-primary-400 h-full transition-all duration-150"
                style={{ width: `${recordingProgress.progressPct}%` }}
              />
            </div>
          )}

          {/* Live Camera Viewport */}
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border border-white/10 shadow-inner mt-2">
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Overlay Guide Box */}
            <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
              <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded self-start">
                Align Package Inside Frame
              </span>
              <span className="text-[10px] bg-black/60 text-emerald-300 px-2 py-0.5 rounded self-end">
                {isRecording ? 'Rotate Slowly 360°' : 'Ready to Start'}
              </span>
            </div>

            {/* Live Detected Barcode Pill Overlay (Google Lens style) */}
            {liveBarcodes.length > 0 && (
              <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col items-center gap-2 pointer-events-auto animate-fade-in">
                {liveBarcodes.map((bc, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/90 backdrop-blur-md border border-white/25 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs max-w-sm w-full"
                  >
                    <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                      {bc.type === 'qr' ? <QrCode className="w-4 h-4" /> : <Barcode className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-xs">
                          {bc.type === 'qr' ? 'QR Code Detected' : 'Barcode Detected'}
                        </span>
                        {bc.country && (
                          <span className="bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30">
                            {bc.countryFlag} {bc.country}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-gray-300 truncate mt-0.5">
                        {bc.rawValue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Guidance & Controls */}
          <div className="relative z-10 space-y-3 pt-3">
            <p className="text-xs text-center text-gray-300">
              {isRecording
                ? '🔄 Slowly rotate package to capture MRP, Use By, Net Qty & Barcode.'
                : '📸 Hold steady and click Start Recording when ready.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCancelVideo}
                className="py-3 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-xl text-xs border border-white/20 transition-all"
              >
                Cancel
              </button>

              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  className="py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-[0.98] transition-all"
                >
                  <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                  Start 15s Recording
                </button>
              ) : (
                <button
                  onClick={handleStopVideoEarly}
                  className="py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-900/40 active:scale-[0.98] transition-all"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop & Analyze Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview before analyzing */}
      {step === 'preview' && image && (
        <div className="flex-1 flex flex-col p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">High-Resolution Preview</h2>
            <span className="text-xs text-primary-600 font-medium flex items-center gap-1">
              <Bot className="w-3.5 h-3.5" /> Voice Assistant Ready
            </span>
          </div>

          <div className="flex-1 min-h-[300px] max-h-[440px] bg-slate-900 rounded-2xl overflow-hidden shadow-md flex items-center justify-center relative border border-slate-800">
            <img src={image} alt="Package Label" className="max-w-full max-h-full object-contain" />
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

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-700 text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <button onClick={handleRetake} className="btn-secondary py-3 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Retake
            </button>
            <button onClick={handleAnalyze} className="btn-primary py-3 flex items-center justify-center gap-2 shadow-md shadow-primary-500/20">
              <Check className="w-4 h-4" />
              Analyze Product
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
                <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Bot className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    AI Voice Compliance Assistant
                  </h2>
                  <p className="text-[11px] text-primary-200 font-medium leading-none">
                    {scanType === 'video' ? 'Multi-Frame Legal Metrology Consensus' : 'Auditing Legal Metrology Rule 6 Declarations'}
                  </p>
                </div>
              </div>

              {!isMuted && activeVoiceIndex >= 0 && activeVoiceIndex < 4 && (
                <div className="flex items-end gap-1 h-5 px-2 py-1 bg-white/15 rounded-lg border border-white/20">
                  <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-3" />
                  <span className="w-1 bg-emerald-300 rounded-full animate-[bounce_0.8s_infinite_300ms] h-4" />
                  <span className="w-1 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms] h-2" />
                  <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-5" />
                </div>
              )}
            </div>

            <div className="mt-3 bg-black/20 rounded-xl px-3 py-2 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/90 font-medium truncate flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {voiceStatusText}
              </span>
              <span className="text-[10px] text-primary-200 font-mono font-semibold ml-2 shrink-0">
                {activeVoiceIndex >= 0 && activeVoiceIndex < 4
                  ? `${activeVoiceIndex + 1} / 4`
                  : activeVoiceIndex === 99
                  ? '4 / 4'
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
                  {scanType === 'video' ? '8-second multi-frame consensus engine' : 'Tesseract OCR + Barcode engine running in browser'}
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              onClick={handleStopAndProceed}
              className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Square className="w-4 h-4 fill-white text-white" />
              <span>Stop Voice & View Report</span>
              <ArrowRight className="w-4 h-4 ml-1 text-gray-400" />
            </button>

            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>Legal Metrology (Packaged Commodities) Rules, 2011</span>
              <button
                onClick={handleRetake}
                className="text-gray-500 hover:text-rose-600 font-semibold underline"
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
