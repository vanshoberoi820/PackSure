import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ScanLine,
  ChevronRight,
  ClipboardList,
  Trash2,
  CheckSquare,
  Square,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { getInspections, syncWithCloudDatabase, deleteInspections, deleteInspection } from '../utils/storage';
import StatusBadge from '../components/StatusBadge';
import ScoreCircle from '../components/ScoreCircle';

export default function InspectionsPage() {
  const navigate = useNavigate();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  // Multi-selection state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const loadInspections = async () => {
      try {
        // First show local instant cache
        const localData = getInspections();
        if (localData && localData.length > 0) {
          setInspections((localData || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }

        // Then sync latest from cloud
        const data = await syncWithCloudDatabase();
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

  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectMode(true);
      setSelectedIds(new Set());
    }
  };

  const toggleSelectId = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredInspections.length && filteredInspections.length > 0) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredInspections.map(i => i.id));
      setSelectedIds(allIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      deleteInspections(idsToDelete);

      const remaining = inspections.filter(i => !selectedIds.has(i.id));
      setInspections(remaining);
      
      const count = idsToDelete.length;
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setShowConfirmModal(false);

      setNotification(`Successfully deleted ${count} inspection${count > 1 ? 's' : ''}`);
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      console.error('Deletion error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingle = (e, id) => {
    e.stopPropagation();
    setSelectedIds(new Set([id]));
    setShowConfirmModal(true);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-nav">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between text-xs font-semibold animate-fade-in border border-emerald-400/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-0.5 hover:bg-emerald-700 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <ClipboardList className="w-6 h-6 mr-2 text-blue-600" />
            Inspections
          </h1>
          <div className="flex items-center gap-2">
            {inspections.length > 0 && (
              <button
                onClick={toggleSelectMode}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  isSelectMode
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isSelectMode ? 'Done' : 'Select'}
              </button>
            )}
            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
              {inspections.length > 0 ? `${inspections.length} Total` : '0 Total'}
            </div>
          </div>
        </div>

        {/* Selection Toolbar (Shown when Select Mode is Active) */}
        {isSelectMode && (
          <div className="mb-3 p-2.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2 animate-fade-in">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-2.5 py-1.5 rounded-lg bg-white shadow-xs border border-slate-200 active:scale-95 transition-all"
            >
              {selectedIds.size === filteredInspections.length && filteredInspections.length > 0 ? (
                <>
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  Deselect All
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  Select All ({filteredInspections.length})
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedIds.size > 0
                    ? 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        )}

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
          <div className="text-center py-10 text-slate-500 font-medium">Loading inspections...</div>
        ) : filteredInspections.length > 0 ? (
          filteredInspections.map((inspection) => {
            const isSelected = selectedIds.has(inspection.id);
            return (
              <div 
                key={inspection.id}
                onClick={() => {
                  if (isSelectMode) {
                    toggleSelectId(inspection.id);
                  } else {
                    navigate(`/result/${inspection.id}`);
                  }
                }}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all flex items-center cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/20 shadow-md'
                    : 'border-slate-100 hover:shadow-md hover:border-slate-200'
                } active:scale-[0.99]`}
              >
                {/* Selection Checkbox */}
                {isSelectMode && (
                  <div className="mr-3 shrink-0">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white hover:border-blue-400'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </div>
                )}

                <div className="mr-3 shrink-0">
                  <ScoreCircle score={inspection.compliance?.overallScore || 0} size={44} strokeWidth={4} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {inspection.productName || 'Unknown Product'}
                  </h3>
                  <div className="flex flex-col mt-0.5 space-y-0.5">
                    <span className="text-xs text-slate-500 font-mono">ID: {inspection.id?.substring(0,10)}</span>
                    <span className="text-[11px] text-slate-400">{formatDate(inspection.createdAt)}</span>
                  </div>
                </div>
                <div className="ml-2 flex flex-col items-end space-y-2 shrink-0">
                  <StatusBadge status={inspection.compliance?.status || inspection.status} size="small" />
                  {!isSelectMode ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleDeleteSingle(e, inspection.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Inspection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-transparent" />
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm mt-4">
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
                onClick={() => navigate('/scan')}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-md active:scale-95"
              >
                <ScanLine className="w-4 h-4 mr-2" />
                Start New Scan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl border border-slate-100 text-center animate-scale-up">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Inspections?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800">{selectedIds.size}</span> inspection{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-md shadow-rose-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
