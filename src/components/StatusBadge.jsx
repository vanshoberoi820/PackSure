import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function StatusBadge({ status, size = 'md' }) {
  const config = {
    compliant: {
      icon: CheckCircle2,
      label: 'Compliant',
      className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    needs_review: {
      icon: AlertTriangle,
      label: 'Needs Review',
      className: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    violation: {
      icon: XCircle,
      label: 'Potential Violation',
      className: 'text-rose-700 bg-rose-50 border-rose-200',
    },
  };

  const c = config[status] || config.needs_review;
  const Icon = c.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-3 py-1 gap-1.5',
    lg: 'text-sm px-4 py-1.5 gap-2',
  };

  const iconSize = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${c.className} ${sizeClasses[size]}`}
    >
      <Icon className={iconSize[size]} />
      {c.label}
    </span>
  );
}
