import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, ChevronRight } from 'lucide-react';
import { getInspections } from '../utils/storage';
import { generateReport } from '../engine/reportEngine';
import StatusBadge from '../components/StatusBadge';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getInspections();
        // Only show completed/reviewed inspections or those with compliance data
        const completed = (data || []).filter(insp => insp.compliance).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setReports(completed);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleDownload = async (inspection) => {
    try {
      setDownloadingId(inspection.id);
      await generateReport(inspection);
      // Brief delay to show success state
      setTimeout(() => setDownloadingId(null), 1000);
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Failed to generate report. Please try again.');
      setDownloadingId(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
  };

  // Stats
  const thisMonth = reports.filter(r => {
    const d = new Date(r.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-nav">
      {/* Header */}
      <div className="bg-blue-600 px-4 pt-8 pb-6">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center">
          <FileText className="w-6 h-6 mr-2" />
          Official Reports
        </h1>
        
        {/* Stats Row */}
        <div className="flex space-x-3">
          <div className="bg-blue-500/30 rounded-xl p-3 flex-1 border border-blue-400/30 backdrop-blur-sm text-white">
            <div className="text-blue-100 text-xs font-medium mb-1 uppercase tracking-wider">Total</div>
            <div className="text-2xl font-bold">{reports.length}</div>
          </div>
          <div className="bg-blue-500/30 rounded-xl p-3 flex-1 border border-blue-400/30 backdrop-blur-sm text-white">
            <div className="text-blue-100 text-xs font-medium mb-1 uppercase tracking-wider">This Month</div>
            <div className="text-2xl font-bold">{thisMonth}</div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-4 -mt-2">
        <h2 className="text-slate-800 font-bold text-lg mb-2 px-1">Available Reports</h2>
        
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading reports...</div>
        ) : reports.length > 0 ? (
          reports.map(report => (
            <div key={report.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 pr-2">
                  <h3 className="font-bold text-slate-900 leading-tight mb-1">
                    {report.productName || 'Inspection Report'}
                  </h3>
                  <div className="flex items-center text-xs text-slate-500 mb-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(report.createdAt)}
                  </div>
                  <div className="text-xs font-mono text-slate-400 truncate">ID: {report.id}</div>
                </div>
                <StatusBadge status={report.compliance?.status} size="small" />
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                <div className="flex items-center text-sm font-semibold text-slate-700">
                  <span className="text-slate-500 mr-2">Score:</span>
                  <span className={report.compliance?.overallScore >= 80 ? 'text-green-600' : 'text-amber-600'}>
                    {report.compliance?.overallScore}%
                  </span>
                </div>
                
                <button
                  onClick={() => handleDownload(report)}
                  disabled={downloadingId === report.id}
                  className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    downloadingId === report.id
                      ? 'bg-blue-50 text-blue-400'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 active:bg-blue-200'
                  }`}
                >
                  {downloadingId === report.id ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1.5" />
                      Download PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-slate-700 font-medium mb-1">No reports available</h3>
            <p className="text-slate-500 text-sm">Complete inspections to generate legal reports.</p>
          </div>
        )}
      </div>
    </div>
  );
}
