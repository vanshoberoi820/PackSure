import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, CheckCircle2, XCircle, AlertTriangle, Upload, ShoppingCart, Package } from 'lucide-react';
import { getInspection, updateInspection } from '../utils/storage';
import { compareDeclarations } from '../engine/complianceEngine';
import { DEMO_ECOMMERCE_DECLARATIONS } from '../demo/demoData';
import { extractDeclarations } from '../engine/extractionEngine';
import { performOCR } from '../engine/ocrEngine';
import { imageToBase64, resizeImage } from '../utils/imageUtils';

export default function ComparisonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [tab, setTab] = useState('demo'); // 'demo' or 'upload'
  const [ecommerceDecls, setEcommerceDecls] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        let currentInsp = null;
        if (location.state?.inspection) {
          currentInsp = location.state.inspection;
          setInspection(currentInsp);
        } else if (id) {
          currentInsp = await getInspection(id);
          setInspection(currentInsp);
        }
        
        // Load demo comparison by default if inspection exists
        if (currentInsp) {
          runComparison(currentInsp.declarations, DEMO_ECOMMERCE_DECLARATIONS);
        }
      } catch (err) {
        console.error('Error loading inspection:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, location.state]);

  const runComparison = (pkgDecls, ecomDecls) => {
    setEcommerceDecls(ecomDecls);
    const result = compareDeclarations(pkgDecls, ecomDecls);
    setComparison(result);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setError(null);
    setEcommerceDecls(null);
    setComparison(null);
    
    try {
      const base64 = await imageToBase64(file);
      const resized = await resizeImage(base64);
      const ocrResult = await performOCR(resized);
      const extracted = await extractDeclarations(ocrResult.text);
      
      runComparison(inspection.declarations, extracted);
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading comparison data...</div>;
  if (!inspection) return <div className="p-4 text-center text-red-500">Inspection not found</div>;

  const mismatches = comparison?.mismatches || [];
  const missing = comparison?.missingInEcommerce || [];
  const matches = comparison?.matches || [];
  const totalIssues = mismatches.length + missing.length;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="mr-3 p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 truncate">Cross-Platform Match</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Tabs */}
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button
            onClick={() => { setTab('demo'); runComparison(inspection.declarations, DEMO_ECOMMERCE_DECLARATIONS); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'demo' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Demo Listing
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'upload' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Upload Listing
          </button>
        </div>

        {/* Upload Section */}
        {tab === 'upload' && !ecommerceDecls && !isProcessing && (
          <div className="bg-white p-6 rounded-xl border-2 border-dashed border-slate-300 text-center">
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-slate-800 font-bold mb-1">Upload E-commerce Screenshot</h3>
            <p className="text-slate-500 text-sm mb-4">Upload a screenshot of the product details page from Amazon, Flipkart, etc.</p>
            <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors">
              Select Image
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {isProcessing && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center shadow-sm">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Analyzing e-commerce listing...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Results Area */}
        {comparison && (
          <div className="space-y-6">
            
            {/* Summary Alert */}
            {totalIssues > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center text-amber-800 font-bold mb-2">
                  <AlertTriangle className="w-5 h-5 mr-2 text-amber-600" />
                  {totalIssues} Potential Discrepancies Found
                </div>
                <p className="text-amber-700 text-sm">
                  Mismatched or missing declarations may indicate Section 18 violations under E-Commerce rules.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center text-green-800 font-bold mb-2">
                  <CheckCircle2 className="w-5 h-5 mr-2 text-green-600" />
                  Listings Appear Consistent
                </div>
                <p className="text-green-700 text-sm">
                  E-commerce declarations match the physical package declarations.
                </p>
              </div>
            )}

            {/* Comparison Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <div className="p-3 border-r border-slate-200 flex items-center">
                  <Package className="w-4 h-4 mr-1.5" /> Physical Package
                </div>
                <div className="p-3 flex items-center">
                  <ShoppingCart className="w-4 h-4 mr-1.5" /> E-commerce
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {/* Mismatches */}
                {mismatches.map((m, idx) => (
                  <div key={`mis-${idx}`} className="grid grid-cols-2 relative bg-amber-50/30">
                    <div className="absolute inset-x-0 top-0 h-px bg-amber-200"></div>
                    <div className="p-3 border-r border-slate-200">
                      <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">{m.field}</div>
                      <div className="text-sm font-medium text-slate-800 break-words">{m.packageValue}</div>
                    </div>
                    <div className="p-3 relative">
                      <div className="text-sm font-medium text-red-700 break-words">{m.ecommerceValue}</div>
                      <XCircle className="w-4 h-4 text-red-500 absolute top-3 right-3" />
                    </div>
                  </div>
                ))}
                
                {/* Missing */}
                {missing.map((m, idx) => (
                  <div key={`miss-${idx}`} className="grid grid-cols-2 bg-slate-50/50">
                    <div className="p-3 border-r border-slate-200">
                      <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">{m.field}</div>
                      <div className="text-sm font-medium text-slate-800 break-words">{m.packageValue}</div>
                    </div>
                    <div className="p-3 flex items-center justify-center relative">
                      <span className="text-sm italic text-slate-400">Missing from listing</span>
                      <AlertTriangle className="w-4 h-4 text-amber-500 absolute top-3 right-3" />
                    </div>
                  </div>
                ))}

                {/* Matches */}
                {matches.map((m, idx) => (
                  <div key={`mat-${idx}`} className="grid grid-cols-2">
                    <div className="p-3 border-r border-slate-200">
                      <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">{m.field}</div>
                      <div className="text-sm text-slate-700 break-words">{m.packageValue}</div>
                    </div>
                    <div className="p-3 relative">
                      <div className="text-sm text-slate-700 break-words">{m.ecommerceValue}</div>
                      <CheckCircle2 className="w-4 h-4 text-green-500 absolute top-3 right-3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
