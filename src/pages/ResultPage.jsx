import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, ShieldAlert, ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import { getInspection } from '../utils/storage';
import { generateReport } from '../engine/reportEngine';
import ScoreCircle from '../components/ScoreCircle';
import DeclarationCard from '../components/DeclarationCard';
import StatusBadge from '../components/StatusBadge';

export default function ResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const data = getInspection(id);
    if (data) {
      setInspection(data);
    } else {
      navigate('/');
    }
  }, [id, navigate]);

  if (!inspection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-500 font-medium">Loading inspection results…</p>
        </div>
      </div>
    );
  }

  const { compliance, declarations, status } = inspection;

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateReport(inspection);
    } catch (err) {
      console.error(err);
      alert('Error generating PDF report. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleFieldClick = (decl) => {
    navigate(`/evidence/${id}`, { state: { focusField: decl.field } });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Compliance Assessment</h1>
            <p className="text-[10px] text-gray-400 font-medium">{id}</p>
          </div>
        </div>
        <StatusBadge status={status} size="sm" />
      </div>

      {/* Main Content */}
      <div className="p-5 space-y-6">
        {/* Score & Status Summary */}
        <div className="card flex flex-col items-center py-6">
          <ScoreCircle score={compliance.overallScore} status={status} size={150} />
          
          <div className="w-full grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-gray-100">
            {Object.entries(compliance.categories).map(([key, value]) => (
              <div key={key} className="text-center">
                <span className="text-xs font-semibold text-gray-400 block truncate">
                  {value.label}
                </span>
                <span className="text-base font-bold text-gray-800 block mt-1">
                  {value.score}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Potential Issues / Violations */}
        {compliance.violations && compliance.violations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Potential Issues ({compliance.violations.length})
            </h2>
            <div className="space-y-3">
              {compliance.violations.map((v, i) => (
                <div key={i} className="card border-rose-100 bg-rose-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">{v.label}</span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase">
                      {v.severity} Severity
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{v.message}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-rose-100/50 text-[10px] font-semibold text-gray-500">
                    <span>Confidence: {v.confidence}%</span>
                    <button
                      onClick={() => navigate(`/evidence/${id}`, { state: { focusField: v.field } })}
                      className="text-primary-600 hover:text-primary-700 flex items-center gap-1 font-bold"
                    >
                      VIEW EVIDENCE
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detected Declarations */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-gray-900">Detected Declarations</h2>
          <div className="space-y-3">
            {declarations.map((decl) => (
              <DeclarationCard
                key={decl.field}
                declaration={decl}
                onClick={handleFieldClick}
              />
            ))}
          </div>
        </div>

        {/* E-commerce Comparison Promo */}
        <div className="card bg-gradient-to-r from-primary-50 to-blue-50/50 border-primary-100 p-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-primary-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Package vs Online Listing
            </h3>
            <p className="text-xs text-primary-700 leading-normal">
              Compare package labels side-by-side with e-commerce listings to detect catalog errors.
            </p>
          </div>
          <button
            onClick={() => navigate(`/compare/${id}`)}
            className="flex-shrink-0 p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-md active:scale-95 transition-all"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Action Panel */}
        <div className="space-y-3 pt-4">
          <button
            onClick={() => navigate(`/review/${id}`)}
            className="w-full btn-outline py-3.5 flex items-center justify-center gap-2 font-bold"
          >
            <ShieldCheck className="w-5 h-5" />
            Officer Review / Sign-off
          </button>

          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 font-bold"
          >
            {generatingPdf ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Report PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
