import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Eye, Shield, Barcode, QrCode } from 'lucide-react';
import { getInspection } from '../utils/storage';
import StatusBadge from '../components/StatusBadge';

export default function EvidencePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [inspection, setInspection] = useState(null);
  const [focusField, setFocusField] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (location.state?.inspection) {
          setInspection(location.state.inspection);
          setFocusField(location.state.focusField || null);
        } else if (id) {
          const data = await getInspection(id);
          setInspection(data);
        }
      } catch (err) {
        console.error('Error loading evidence:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, location.state]);

  if (loading) return <div className="p-4 flex justify-center text-slate-500">Loading evidence...</div>;
  if (!inspection) return <div className="p-4 flex justify-center text-red-500">Inspection not found</div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="mr-3 p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Evidence Review</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Original Product Image */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
            <Eye className="w-4 h-4 mr-1.5 text-blue-500" />
            Analyzed Image
          </h2>
          <div className="relative rounded-lg overflow-hidden bg-slate-100 aspect-square">
            {inspection.productImage ? (
              <img src={inspection.productImage} alt="Product evidence" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">No image available</div>
            )}
          </div>
        </div>

        {/* Barcode Evidence */}
        {inspection.detectedBarcodes && inspection.detectedBarcodes.length > 0 && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center">
              <Barcode className="w-4 h-4 mr-1.5 text-indigo-500" />
              Scanned Barcode & QR Evidence
            </h2>
            <div className="space-y-2">
              {inspection.detectedBarcodes.map((bc, idx) => (
                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {bc.type === 'qr' ? <QrCode className="w-4 h-4 text-indigo-600" /> : <Barcode className="w-4 h-4 text-indigo-600" />}
                    <div>
                      <span className="font-bold text-slate-800 font-mono">{bc.rawValue}</span>
                      <span className="text-[10px] text-slate-400 block">{bc.format || 'Barcode'}</span>
                    </div>
                  </div>
                  {bc.country && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {bc.countryFlag} {bc.country}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Declarations Evidence */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center">
            <Shield className="w-4 h-4 mr-1.5 text-indigo-500" />
            Extracted Declarations
          </h2>

          {inspection.declarations?.map((dec, idx) => {
            const isFocused = focusField === dec.field;
            const isDetected = dec.status !== 'not_detected';

            return (
              <div 
                key={idx} 
                className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${
                  isFocused ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-slate-800 text-sm">{dec.label}</span>
                  {dec.status === 'not_applicable' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                      Not Applicable
                    </span>
                  ) : isDetected ? (
                    <StatusBadge status="compliant" />
                  ) : (
                    <StatusBadge status="violation" />
                  )}
                </div>

                {isDetected ? (
                  <>
                    <div className="bg-slate-50 p-2.5 rounded text-sm text-slate-800 font-medium mb-3 border border-slate-100 break-words">
                      {dec.value}
                    </div>
                    {dec.evidence && dec.evidence !== dec.value && (
                      <p className="text-[11px] text-slate-500 italic mb-2">
                        OCR Snippet: &quot;{dec.evidence}&quot;
                      </p>
                    )}
                    {(() => {
                      const confVal = dec.confidence > 1 ? Math.round(dec.confidence) : Math.round((dec.confidence || 0) * 100);
                      return (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="text-slate-500 w-24">AI Confidence:</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${confVal >= 80 ? 'bg-green-500' : confVal >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${confVal}%` }}
                            />
                          </div>
                          <span className="text-slate-600 font-medium w-9 text-right">{confVal}%</span>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 mr-2 shrink-0" />
                    <div>
                      <p className="text-xs text-amber-800 mb-1 leading-relaxed">
                        No matching declaration was confidently detected in the uploaded image.
                      </p>
                      <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Officer Verification Required
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate(-1)}
          className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
        >
          Back to Results
        </button>
      </div>
    </div>
  );
}
