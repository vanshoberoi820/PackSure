import { useEffect, useState } from 'react';

export default function ScoreCircle({ score = 0, size = 140, status = 'needs_review' }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 1500;
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  const colorMap = {
    compliant: { stroke: '#16a34a', bg: '#f0fdf4', text: '#166534' },
    needs_review: { stroke: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
    violation: { stroke: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
  };

  const colors = colorMap[status] || colorMap.needs_review;

  const statusLabel = {
    compliant: 'Compliant',
    needs_review: 'Needs Review',
    violation: 'Violation',
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="score-circle-track"
            strokeWidth={strokeWidth}
          />
          {/* Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="score-circle-fill"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-3xl font-bold"
            style={{ color: colors.text }}
          >
            {animatedScore}
          </span>
          <span className="text-xs text-gray-400 font-medium">/ 100</span>
        </div>
      </div>
      <div
        className="mt-3 px-4 py-1.5 rounded-full text-sm font-semibold border"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          borderColor: colors.stroke + '40',
        }}
      >
        {statusLabel[status] || 'Unknown'}
      </div>
    </div>
  );
}
