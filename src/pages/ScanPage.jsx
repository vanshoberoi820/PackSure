import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
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
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { performOCR, assessImageQuality } from '../engine/ocrEngine';
import { extractDeclarations } from '../engine/extractionEngine';
import { evaluateCompliance } from '../engine/complianceEngine';
import {
  saveInspection,
  generateInspectionId,
  getVoiceAssistantEnabled,
} from '../utils/storage';
import { imageToBase64, resizeImage } from '../utils/imageUtils';
import { getDemoInspection } from '../demo/demoData';
import {
  buildKeyDeclarationsData,
  runVoiceAssistantSequence,
  stopSpeech,
  setVoiceMuted,
} from '../utils/voiceAssistant';

export default function ScanPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // State variables
  const [image, setImage] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [step, setStep] = useState('select'); // 'select', 'preview', 'analyzing'
  const [analysisProgress, setAnalysisProgress] = useState({ step: 0, label: '', progress: 0 });
  const [error, setError] = useState(null);

  // Voice Assistant states
  const [keyDeclarations, setKeyDeclarations] = useState([]);
  const [activeVoiceIndex, setActiveVoiceIndex] = useState(-1);
  const [completedIndices, setCompletedIndices] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [currentInspectionId, setCurrentInspectionId] = useState(null);
  const [voiceStatusText, setVoiceStatusText] = useState('Analyzing package label…');

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  // Trigger file input
  const handleSelectSource = (mode) => {
    setError(null);
    if (mode === 'camera') {
      fileInputRef.current?.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current?.removeAttribute('capture');
    }
    fileInputRef.current?.click();
  };

  // Handle file selection
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setStep('preview');
      setIsDemo(false);
      const base64 = await imageToBase64(file);
      const resized = await resizeImage(base64, 800, 800);
      setImage(resized);
    } catch (err) {
      console.error(err);
      setError('Failed to load image. Please try again.');
      setStep('select');
    }
  };

  // Load demo product
  const handleUseDemo = () => {
    setError(null);
    setIsDemo(true);
    setStep('preview');
    const demoInspection = getDemoInspection('TEMP');
    setImage(demoInspection.productImage);
  };

  // Retake image
  const handleRetake = () => {
    stopSpeech();
    setImage(null);
    setIsDemo(false);
    setStep('select');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);
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

  // Run analysis and trigger Voice Assistant
  const handleAnalyze = async () => {
    setStep('analyzing');
    setError(null);
    setActiveVoiceIndex(-1);
    setCompletedIndices([]);

    const inspectionId = generateInspectionId();
    setCurrentInspectionId(inspectionId);

    const voiceEnabled = getVoiceAssistantEnabled();

    if (isDemo) {
      // Demo Flow
      setAnalysisProgress({ step: 1, label: 'Reading demo label…', progress: 100 });
      await new Promise((r) => setTimeout(r, 600));

      const demoInspection = getDemoInspection(inspectionId);
      saveInspection(demoInspection);

      const items = buildKeyDeclarationsData(
        demoInspection.declarations,
        demoInspection.compliance,
        demoInspection.compliance?.dateAssessment
      );
      setKeyDeclarations(items);
      setAnalysisProgress({ step: 4, label: 'Voice Assistant Active', progress: 100 });

      // Run voice assistant sequence
      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
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

    // Real OCR Flow
    try {
      setAnalysisProgress({ step: 0, label: 'Quality check…', progress: 0 });
      setVoiceStatusText('Checking image readability…');
      await new Promise((r) => setTimeout(r, 500));

      const ocrResult = await performOCR(image, (p) => {
        setAnalysisProgress({
          step: p.step,
          label: p.label,
          progress: p.progress,
        });
        setVoiceStatusText(`Extracting text (${p.progress}%)…`);
      });

      // Assess quality
      const qualityAssess = assessImageQuality(ocrResult);
      if (!qualityAssess.usable) {
        setError(qualityAssess.message);
        setStep('preview');
        return;
      }

      setAnalysisProgress({ step: 3, label: 'Validating declarations…', progress: 50 });
      setVoiceStatusText('Evaluating Legal Metrology rules…');
      const declarations = extractDeclarations(ocrResult.text, ocrResult.confidence);

      setAnalysisProgress({ step: 4, label: 'Risk assessment…', progress: 90 });
      const compliance = evaluateCompliance(declarations, ocrResult.confidence, ocrResult.text);

      const newInspection = {
        id: inspectionId,
        productImage: image,
        productName: declarations.find((d) => d.field === 'productName')?.value || 'Unknown Product',
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        declarations,
        compliance,
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

      // Run voice assistant sequence
      runVoiceAssistantSequence({
        items,
        enabled: voiceEnabled && !isMuted,
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
      setError(err.message || 'Analysis service failed. Try using Demo Mode or a clearer image.');
      setStep('preview');
    }
  };

  // Helper icons for the 4 key declarations
  const getIconForField = (id) => {
    switch (id) {
      case 'mrp':
        return Tag;
      case 'useBy':
        return CalendarClock;
      case 'netWeight':
        return Scale;
      case 'manufactureOrigin':
        return Building2;
      default:
        return Radio;
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
              navigate('/');
            }}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {step === 'analyzing' ? 'Live Verification' : 'Scan Product'}
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

      {/* STEP 1: Select image source */}
      {step === 'select' && (
        <div className="flex-1 flex flex-col justify-center px-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-100">
              <Camera className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Add Product Image</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              Capture or upload the package label showing MRP, Net Qty, Use By date, and Manufacturer details.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleSelectSource('camera')}
              className="btn-primary flex items-center justify-center gap-3 py-4"
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>

            <button
              onClick={() => handleSelectSource('upload')}
              className="btn-outline flex items-center justify-center gap-3 py-4"
            >
              <ImageIcon className="w-5 h-5" />
              Upload Image
            </button>

            <div className="relative my-6 flex items-center justify-center">
              <hr className="w-full border-gray-200" />
              <span className="absolute bg-gray-50 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                OR
              </span>
            </div>

            <button
              onClick={handleUseDemo}
              className="w-full py-4 bg-amber-50 text-amber-800 border-2 border-dashed border-amber-300 rounded-xl hover:bg-amber-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-semibold"
            >
              <Sparkles className="w-5 h-5 text-amber-600" />
              Use Demo Product
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 text-rose-700 text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Preview before analyzing */}
      {step === 'preview' && image && (
        <div className="flex-1 flex flex-col p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Label Preview</h2>
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

      {/* STEP 3: Voice Assistant & Real-time 4-Item Processing HUD */}
      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col justify-between p-5 space-y-4">
          {/* Top Voice Assistant Banner */}
          <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
            {/* Background glowing shapes */}
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
                    Auditing 4 Critical Legal Metrology Metrics
                  </p>
                </div>
              </div>

              {/* Animated Equalizer Bars */}
              {!isMuted && activeVoiceIndex >= 0 && activeVoiceIndex < 4 && (
                <div className="flex items-end gap-1 h-5 px-2 py-1 bg-white/15 rounded-lg border border-white/20">
                  <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-3" />
                  <span className="w-1 bg-emerald-300 rounded-full animate-[bounce_0.8s_infinite_300ms] h-4" />
                  <span className="w-1 bg-white rounded-full animate-[bounce_0.8s_infinite_200ms] h-2" />
                  <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-5" />
                </div>
              )}
            </div>

            {/* Live status caption */}
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

          {/* 4 Core Declarations Interactive Grid */}
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
                    {/* Active highlight glow bar */}
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

                      {/* Status indicator */}
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
              // Initial Loading skeleton before OCR finishes
              <div className="space-y-3 py-6 text-center">
                <div className="w-12 h-12 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Detecting text & extracting declarations…</p>
                <p className="text-xs text-gray-400">Tesseract.js OCR engine running in browser worker</p>
              </div>
            )}
          </div>

          {/* Bottom Action Controls — includes explicit "Stop in between" button */}
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
