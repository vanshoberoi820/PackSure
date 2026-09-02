import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ChevronRight } from 'lucide-react';

export default function DeclarationCard({ declaration, onClick }) {
  const d = declaration;

  const statusConfig = {
    detected: {
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      badge: 'Detected',
      badgeColor: 'text-emerald-700 bg-emerald-100',
    },
    needs_review: {
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      badge: 'Needs Review',
      badgeColor: 'text-amber-700 bg-amber-100',
    },
    not_detected: {
      icon: XCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      badge: 'Not Detected',
      badgeColor: 'text-rose-700 bg-rose-100',
    },
    not_applicable: {
      icon: MinusCircle,
      color: 'text-slate-500',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      badge: 'Not Applicable',
      badgeColor: 'text-slate-600 bg-slate-200',
    },
  };

  const config = statusConfig[d.status] || statusConfig.not_detected;
  const Icon = config.icon;

  return (
    <button
      onClick={() => onClick?.(d)}
      className={`w-full text-left p-4 rounded-xl border ${config.border} ${config.bg} hover:shadow-sm transition-all duration-150 active:scale-[0.99]`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-800 truncate">
              {d.label}
            </h4>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${config.badgeColor}`}>
              {config.badge}
            </span>
          </div>

          {d.value ? (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{d.value}</p>
          ) : (
            <p className="text-sm text-gray-400 mt-1 italic">
              No information detected
            </p>
          )}

          {d.confidence > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    d.confidence >= 80
                      ? 'bg-emerald-500'
                      : d.confidence >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${d.confidence}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-500 font-medium w-8 text-right">
                {d.confidence}%
              </span>
            </div>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-gray-300 mt-1 flex-shrink-0" />
      </div>
    </button>
  );
}
