import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, ShieldAlert, ArrowRight, ShieldCheck, ShoppingCart, Calendar, Clock } from 'lucide-react';
import { getInspection } from '../utils/storage';
import { generateReport } from '../engine/reportEngine';
import { evaluateDateCompliance } from '../engine/complianceEngine';
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

        {/* Date & Expiry Assessment */}
        {(() => {
          const dateAssessment = compliance.dateAssessment || evaluateDateCompliance(
            declarations.find(d => d.field === 'manufacturingDate'),
            declarations.find(d => d.field === 'bestBefore')
          );

          if (!dateAssessment || (!dateAssessment.mfgDate && !dateAssessment.expiryDate)) return null;

          return (
            <div className="card p-4 border border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/40 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shadow-xs">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">Date & Expiry Engine</h3>
                    <p className="text-[10px] text-gray-500 font-medium">Legal Metrology Rule 6(1)(d)</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-xs ${
                    dateAssessment.isExpired
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : dateAssessment.isNearExpiry
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : dateAssessment.isFutureDated
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : dateAssessment.expiryStatus === 'safe'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {dateAssessment.isExpired
                    ? '⚠️ EXPIRED'
                    : dateAssessment.isNearExpiry
                    ? '⏳ NEAR EXPIRY'
                    : dateAssessment.isFutureDated
                    ? '🚫 POST-DATED'
                    : dateAssessment.expiryStatus === 'safe'
                    ? '✓ ACTIVE & SAFE'
                    : 'DATE UNVERIFIED'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-100 text-xs">
                <div className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100/80">
                  <span className="text-[10px] text-gray-400 font-semibold block uppercase tracking-wider">Mfg / Pkg Date</span>
                  <span className="text-sm font-bold text-gray-800 mt-0.5 block truncate">
                    {dateAssessment.mfgDate || 'Not Detected'}
                  </span>
                </div>

                <div className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100/80">
                  <span className="text-[10px] text-gray-400 font-semibold block uppercase tracking-wider">
                    {dateAssessment.isComputedExpiry ? 'Computed Expiry' : 'Best Before / Exp'}
                  </span>
                  <span className="text-sm font-bold text-gray-800 mt-0.5 block truncate">
                    {dateAssessment.expiryDate || 'Not Detected'}
                  </span>
                </div>
              </div>

              {dateAssessment.shelfLife && (
                <div className="text-[11px] text-gray-500 flex items-center gap-1.5 pt-0.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  <span className="truncate">
                    Shelf Life: <strong className="text-gray-700 font-semibold">{dateAssessment.shelfLife}</strong>
                    {dateAssessment.daysToExpiry !== null && (
                      <span className="ml-1.5 text-gray-400">
                        ({dateAssessment.daysToExpiry > 0 ? `${dateAssessment.daysToExpiry} days remaining` : `${Math.abs(dateAssessment.daysToExpiry)} days expired`})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

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
