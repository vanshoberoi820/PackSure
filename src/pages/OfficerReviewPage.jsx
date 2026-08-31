import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Shield, Send, Edit3 } from 'lucide-react';
import { getInspection, updateInspection } from '../utils/storage';
import StatusBadge from '../components/StatusBadge';
import ScoreCircle from '../components/ScoreCircle';

export default function OfficerReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [decisions, setDecisions] = useState({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (location.state?.inspection) {
          setInspection(location.state.inspection);
          initializeDecisions(location.state.inspection);
        } else if (id) {
          const data = await getInspection(id);
          setInspection(data);
          initializeDecisions(data);
        }
      } catch (err) {
        console.error('Error loading inspection:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, location.state]);

  const initializeDecisions = (data) => {
    if (!data?.declarations) return;
    
    // If already reviewed, load past decisions
    if (data.officerReview?.completed) {
      setDecisions(data.officerReview.decisions || {});
      setNotes(data.officerReview.notes || '');
      return;
    }
    
    // Pre-populate decisions based on AI status
    const initialDecisions = {};
    data.declarations.forEach(dec => {
      if (dec.status === 'detected') {
        initialDecisions[dec.field] = 'confirm';
      }
      // For not_detected / needs_review, leave undefined to force explicit officer review
    });
    setDecisions(initialDecisions);
  };

  const handleDecision = (field, decision) => {
    setDecisions(prev => ({ ...prev, [field]: decision }));
  };

  const handleComplete = async () => {
    if (!inspection) return;
    setIsSubmitting(true);
    try {
      const updatedData = {
        ...inspection,
        status: 'reviewed', // update top level status
        officerReview: {
          completed: true,
          completedAt: new Date().toISOString(),
          decisions,
          notes
        }
      };
      
      await updateInspection(inspection.id, updatedData);
      navigate(`/result/${inspection.id}`);
    } catch (err) {
      console.error('Failed to complete review:', err);
      alert('Failed to save review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading review data...</div>;
  if (!inspection) return <div className="p-4 text-center text-red-500">Inspection not found</div>;

  const itemsToReview = inspection.declarations?.filter(d => 
    d.status === 'not_detected' || d.status === 'needs_review' || decisions[d.field] !== 'confirm'
  ) || [];


  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="mr-3 p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Officer Review</h1>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-600 px-4 py-3 text-white flex items-start shadow-md">
        <Shield className="w-5 h-5 mr-3 mt-0.5 shrink-0 opacity-80" />
        <p className="text-sm font-medium leading-tight">
          AI-assisted findings require officer verification before legal finalization.
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Product Summary */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden mr-4 shrink-0 border border-slate-200">
             {inspection.productImage ? (
                <img src={inspection.productImage} alt="Product" className="w-full h-full object-cover" />
             ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">N/A</div>
             )}
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-bold text-slate-900 truncate mb-1">{inspection.productName}</h3>
            <StatusBadge status={inspection.compliance?.status} />
          </div>
          <div className="shrink-0">
             <ScoreCircle score={inspection.compliance?.overallScore || 0} size={50} strokeWidth={4} />
          </div>
        </div>

        {/* Review Items */}
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center">
            <Edit3 className="w-5 h-5 mr-2 text-indigo-500" />
            Items Requiring Verification
          </h2>
          
          {itemsToReview.length === 0 ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-center text-sm font-medium">
              All declarations appear compliant. You can add notes and complete the review.
            </div>
          ) : (
            <div className="space-y-4">
              {itemsToReview.map(dec => (
                <div key={dec.field} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800">{dec.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                      dec.status === 'not_detected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {dec.status === 'not_detected' ? 'Not Detected' : dec.status === 'needs_review' ? 'Needs Review' : 'Detected'}
                    </span>
                  </div>
                  
                  <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-sm font-medium text-slate-700 mb-1">Extracted Value:</div>
                    <div className="text-slate-900 font-mono text-sm break-words">
                      {dec.status === 'not_detected' ? <span className="italic text-slate-400">Not Detected</span> : dec.value}
                    </div>
                    {dec.status !== 'not_detected' && (
                      <div className="text-xs text-slate-500 mt-2">
                        AI Confidence: {dec.confidence > 1 ? Math.round(dec.confidence) : Math.round((dec.confidence || 0) * 100)}%
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDecision(dec.field, 'confirm')}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all border ${
                        decisions[dec.field] === 'confirm' 
                          ? 'bg-green-100 border-green-500 text-green-800 shadow-inner'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className={`w-5 h-5 mb-1 ${decisions[dec.field] === 'confirm' ? 'text-green-600' : 'text-slate-400'}`} />
                      Confirm Violation
                    </button>
                    
                    <button
                      onClick={() => handleDecision(dec.field, 'reject')}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all border ${
                        decisions[dec.field] === 'reject' 
                          ? 'bg-red-100 border-red-500 text-red-800 shadow-inner'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <XCircle className={`w-5 h-5 mb-1 ${decisions[dec.field] === 'reject' ? 'text-red-600' : 'text-slate-400'}`} />
                      Reject AI Finding
                    </button>

                    <button
                      onClick={() => handleDecision(dec.field, 'review')}
                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all border ${
                        decisions[dec.field] === 'review' 
                          ? 'bg-amber-100 border-amber-500 text-amber-800 shadow-inner'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <AlertTriangle className={`w-5 h-5 mb-1 ${decisions[dec.field] === 'review' ? 'text-amber-600' : 'text-slate-400'}`} />
                      Needs Lab Test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
           <h2 className="text-base font-bold text-slate-800 mb-3">Officer Notes</h2>
           <div className="relative">
             <textarea
               className="w-full h-32 p-3 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-slate-700 text-sm shadow-sm"
               placeholder="Add your observations, rationale for rejections, or instructions for next steps..."
               value={notes}
               onChange={(e) => setNotes(e.target.value)}
               maxLength={500}
             ></textarea>
             <div className="absolute bottom-3 right-3 text-xs text-slate-400 font-mono">
               {notes.length}/500
             </div>
           </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleComplete}
          disabled={isSubmitting}
          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all ${
            isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? (
            'Saving Review...'
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Complete Verification
            </>
          )}
        </button>
      </div>
    </div>
  );
}
