import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Image as ImageIcon, Sparkles, RefreshCw, Check, ArrowLeft, ShieldAlert } from 'lucide-react';
import { performOCR, assessImageQuality } from '../engine/ocrEngine';
import { extractDeclarations } from '../engine/extractionEngine';
import { evaluateCompliance } from '../engine/complianceEngine';
import { saveInspection, generateInspectionId } from '../utils/storage';
import { imageToBase64, resizeImage } from '../utils/imageUtils';
import { getDemoInspection } from '../demo/demoData';

export default function ScanPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // State variables
  const [image, setImage] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [step, setStep] = useState('select'); // 'select', 'preview', 'analyzing'
  const [analysisProgress, setAnalysisProgress] = useState({ step: 0, label: '', progress: 0 });
  const [error, setError] = useState(null);

  // Trigger file input
  const handleSelectSource = (mode) => {
    setError(null);
    if (mode === 'camera') {
      fileInputRef.current.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current.removeAttribute('capture');
    }
    fileInputRef.current.click();
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
    // Generate the demo canvas image
    const demoInspection = getDemoInspection('TEMP');
    setImage(demoInspection.productImage);
  };

  // Retake image
  const handleRetake = () => {
    setImage(null);
    setIsDemo(false);
    setStep('select');
    setError(null);
  };

  // Run analysis
  const handleAnalyze = async () => {
    setStep('analyzing');
    setError(null);
    const inspectionId = generateInspectionId();

    if (isDemo) {
      // Demo Flow
      const mockSteps = [
        { step: 0, label: 'Image quality check…', progress: 100 },
        { step: 1, label: 'Text detection…', progress: 100 },
        { step: 2, label: 'Declaration extraction…', progress: 100 },
        { step: 3, label: 'Compliance validation…', progress: 100 },
        { step: 4, label: 'Risk assessment…', progress: 100 }
      ];

      for (let i = 0; i < mockSteps.length; i++) {
        setAnalysisProgress(mockSteps[i]);
        await new Promise((r) => setTimeout(r, 800));
      }

      const demoInspection = getDemoInspection(inspectionId);
      saveInspection(demoInspection);
      navigate(`/result/${inspectionId}`);
      return;
    }

    // Real OCR Flow
    try {
      setAnalysisProgress({ step: 0, label: 'Quality check…', progress: 0 });
      await new Promise((r) => setTimeout(r, 600));

      const ocrResult = await performOCR(image, (p) => {
        setAnalysisProgress({
          step: p.step,
          label: p.label,
          progress: p.progress
        });
      });

      // Assess quality
      const qualityAssess = assessImageQuality(ocrResult);
      if (!qualityAssess.usable) {
        setError(qualityAssess.message);
        setStep('preview');
        return;
      }

      setAnalysisProgress({ step: 3, label: 'Validating declarations…', progress: 50 });
      const declarations = extractDeclarations(ocrResult.text, ocrResult.confidence);
      
      setAnalysisProgress({ step: 4, label: 'Risk assessment…', progress: 90 });
      const compliance = evaluateCompliance(declarations, ocrResult.confidence, ocrResult.text);
      
      await new Promise((r) => setTimeout(r, 800));

      const newInspection = {
        id: inspectionId,
        productImage: image,
        productName: declarations.find(d => d.field === 'productName')?.value || 'Unknown Product',
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        declarations,
        compliance,
        officerReview: {
          notes: '',
          decisions: {},
          completed: false,
          completedAt: null
        },
        comparison: null,
        createdAt: new Date().toISOString(),
        status: compliance.status
      };

      saveInspection(newInspection);
      navigate(`/result/${inspectionId}`);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Analysis service failed. Try using Demo Mode or a clearer image.');
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
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Scan Product</h1>
      </div>

      {step === 'select' && (
        <div className="flex-1 flex flex-col justify-center px-6">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-100">
              <Camera className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Add Product Image</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              Capture or upload the package label showing MRP, Net Qty, and other declarations.
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

      {step === 'preview' && image && (
        <div className="flex-1 flex flex-col p-6">
          <h2 className="text-base font-bold text-gray-900 mb-3">Label Preview</h2>
          <div className="flex-1 min-h-[300px] max-h-[450px] bg-black rounded-2xl overflow-hidden shadow-md flex items-center justify-center relative">
            <img src={image} alt="Package Label" className="max-w-full max-h-full object-contain" />
            {isDemo && (
              <span className="absolute top-3 right-3 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
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
            <button onClick={handleAnalyze} className="btn-primary py-3 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              Analyze Product
            </button>
          </div>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col justify-center px-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-100 animate-spin">
              <RefreshCw className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Analyzing Product…</h2>
            <p className="text-sm text-gray-500 mt-1">Extracting text and verifying legal compliance</p>
          </div>

          <div className="space-y-4 max-w-xs mx-auto w-full">
            {[
              { idx: 0, label: 'Image quality check' },
              { idx: 1, label: 'Text detection (OCR)' },
              { idx: 2, label: 'Declaration extraction' },
              { idx: 3, label: 'Compliance validation' },
              { idx: 4, label: 'Risk assessment' }
            ].map((s) => {
              const isActive = s.idx === analysisProgress.step;
              const isDone = s.idx < analysisProgress.step;

              return (
                <div key={s.idx} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : isActive
                        ? 'bg-primary-50 border-primary-500 text-primary-600 step-active'
                        : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    {isDone ? '✓' : s.idx + 1}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isDone
                        ? 'text-emerald-700 font-semibold'
                        : isActive
                        ? 'text-primary-700 font-semibold'
                        : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                    {isActive && analysisProgress.progress > 0 && ` (${analysisProgress.progress}%)`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
