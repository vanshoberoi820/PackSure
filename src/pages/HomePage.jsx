import { useNavigate } from 'react-router-dom';
import { getStats, getInspections } from '../utils/storage';
import StatusBadge from '../components/StatusBadge';
import {
  ScanLine,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Shield,
  TrendingUp,
} from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  const stats = getStats();
  const inspections = getInspections().slice(0, 5);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-nav">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-5 pt-12 pb-20 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-primary-100 text-xs font-medium">PackSure</p>
              <p className="text-white text-sm font-semibold">Inspector Dashboard</p>
            </div>
          </div>
          <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center text-white text-sm font-bold">
            RK
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white">{greeting()} 👋</h1>
        <p className="text-primary-200 text-sm mt-1">
          Ready to inspect a product?
        </p>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/scan')}
          className="mt-6 w-full py-4 bg-white text-primary-700 font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 text-base"
        >
          <ScanLine className="w-6 h-6" strokeWidth={2.5} />
          Scan Product
        </button>
      </div>

      {/* Stats Grid */}
      <div className="px-5 -mt-10">
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              icon: ClipboardCheck,
              value: stats.total || 124,
              label: 'Inspections',
              color: 'text-primary-600',
              bg: 'bg-primary-50',
            },
            {
              icon: CheckCircle2,
              value: stats.compliant || 89,
              label: 'Compliant',
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              icon: AlertTriangle,
              value: stats.needsReview || 21,
              label: 'Review',
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
            {
              icon: XCircle,
              value: stats.violations || 14,
              label: 'Violations',
              color: 'text-rose-600',
              bg: 'bg-rose-50',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center"
              >
                <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <p className="text-[10px] text-gray-500 font-medium">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mt-6">
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/inspections')}
            className="flex-1 card flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">History</p>
              <p className="text-[10px] text-gray-400">View all</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="flex-1 card flex items-center gap-3 active:scale-[0.98] transition-all"
          >
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">Reports</p>
              <p className="text-[10px] text-gray-400">Download</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="px-5 mt-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Recent Inspections</h2>
          {inspections.length > 0 && (
            <button
              onClick={() => navigate('/inspections')}
              className="text-xs text-primary-600 font-semibold hover:text-primary-700"
            >
              View All →
            </button>
          )}
        </div>

        {inspections.length === 0 ? (
          <div className="card text-center py-8">
            <ScanLine className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No inspections yet</p>
            <p className="text-xs text-gray-400 mt-1">Scan your first product to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inspections.map((ins) => (
              <button
                key={ins.id}
                onClick={() => navigate(`/result/${ins.id}`)}
                className="w-full card flex items-center gap-3 active:scale-[0.99] transition-all text-left"
              >
                {ins.productImage ? (
                  <img
                    src={ins.productImage}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <ScanLine className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {ins.productName || 'Unknown Product'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{ins.id}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-lg font-bold text-gray-700">
                    {ins.compliance?.overallScore || 0}
                    <span className="text-xs text-gray-400 font-normal">/100</span>
                  </span>
                  <StatusBadge status={ins.status} size="sm" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
