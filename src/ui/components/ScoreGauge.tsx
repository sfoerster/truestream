import { TrustLevel } from '../../types/trust';

interface ScoreGaugeProps {
  score: number;
  level: TrustLevel;
}

const LEVEL_STROKE_COLORS: Record<TrustLevel, string> = {
  initializing: '#9ca3af',
  confident: '#22c55e',
  uncertain: '#f59e0b',
  suspicious: '#f97316',
  likely_synthetic: '#ef4444',
  verified: '#3b82f6',
};

/** Animated SVG arc gauge showing the composite score from 0.0 to 1.0 */
export function ScoreGauge({ score, level }: ScoreGaugeProps) {
  const radius = 60;
  const strokeWidth = 8;
  const center = 70;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const filledLength = arcLength * Math.max(0, Math.min(1, score));
  const dashOffset = arcLength - filledLength;
  const color = LEVEL_STROKE_COLORS[level];

  return (
    <div class="flex justify-center">
      <svg width="140" height="120" viewBox="0 0 140 120">
        {/* Background arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#374151"
          stroke-width={strokeWidth}
          stroke-dasharray={`${arcLength} ${circumference}`}
          stroke-dashoffset="0"
          stroke-linecap="round"
          transform={`rotate(135, ${center}, ${center})`}
        />
        {/* Filled arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          stroke-width={strokeWidth}
          stroke-dasharray={`${arcLength} ${circumference}`}
          stroke-dashoffset={dashOffset}
          stroke-linecap="round"
          transform={`rotate(135, ${center}, ${center})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.4s ease' }}
        />
      </svg>
    </div>
  );
}
