import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ScanLine, ChevronRight, ClipboardList, Filter } from 'lucide-react';
import { getInspections } from '../utils/storage';
import StatusBadge from '../components/StatusBadge';
import ScoreCircle from '../components/ScoreCircle';

export default function InspectionsPage() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const loadInspections = async () => {
      try {
        const data = await getInspections();
        // Sort newest first
        const sorted = (data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setInspections(sorted);
      } catch (error) {
        console.error('Failed to load inspections:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInspections();
  }, []);

  const filteredInspections = inspections.filter(insp => {
    const matchesSearch = insp.productName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          insp.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filter === 'All') return true;
    if (filter === 'Compliant') return insp.compliance?.status === 'compliant';
    if (filter === 'Needs Review') return insp.compliance?.status === 'needs_review' || insp.status === 'needs_review';
    if (filter === 'Violations') return insp.compliance?.status === 'violation' || insp.status === 'violation';
    
    return true;
  });

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown date';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-nav">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <ClipboardList className="w-6 h-6 mr-2 text-blue-600" />
            Inspections
          </h1>
          <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
            {inspections.length} Total
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
            placeholder="Search by product or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex overflow-x-auto hide-scrollbar space-x-2 pb-1 -mx-4 px-4">
          {['All', 'Compliant', 'Needs Review', 'Violations'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Loading inspections...</div>
        ) : filteredInspections.length > 0 ? (
          filteredInspections.map((inspection) => (
            <div 
              key={inspection.id}
              onClick={() => navigate(`/result/${inspection.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            >
              <div className="mr-3 shrink-0">
                <ScoreCircle score={inspection.compliance?.overallScore || 0} size={44} strokeWidth={4} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {inspection.productName || 'Unknown Product'}
                </h3>
                <div className="flex flex-col mt-0.5 space-y-1">
                  <span className="text-xs text-slate-500 font-mono">ID: {inspection.id?.substring(0,8)}</span>
                  <span className="text-xs text-slate-400">{formatDate(inspection.createdAt)}</span>
                </div>
              </div>
              <div className="ml-2 flex flex-col items-end space-y-2 shrink-0">
                <StatusBadge status={inspection.compliance?.status || inspection.status} size="small" />
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-100 shadow-sm mt-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-blue-300" />
            </div>
            <h3 className="text-slate-800 font-semibold mb-2">No inspections found</h3>
            <p className="text-slate-500 text-sm mb-6">
              {inspections.length === 0 
                ? "You haven't performed any inspections yet." 
                : "Try adjusting your search or filters."}
            </p>
            {inspections.length === 0 && (
              <button 
                onClick={() => navigate('/')}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ScanLine className="w-4 h-4 mr-2" />
                Start New Scan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
