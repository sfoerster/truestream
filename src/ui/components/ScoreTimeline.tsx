

interface ScoreTimelineProps {
  scores: number[];
}

const WIDTH = 280;
const HEIGHT = 60;
const MAX_POINTS = 60;

/** SVG sparkline showing the last 60 composite score samples */
export function ScoreTimeline({ scores }: ScoreTimelineProps) {
  const displayScores = scores.slice(-MAX_POINTS);
  if (displayScores.length < 2) {
    return <div class="h-16 flex items-center justify-center text-gray-600 text-xs">Collecting data...</div>;
  }

  const points = displayScores.map((score, i) => {
    const x = (i / (MAX_POINTS - 1)) * WIDTH;
    const y = HEIGHT - score * HEIGHT;
    return `${x},${y}`;
  });

  const pathD = points.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(' ');

  // Threshold lines
  const confidentY = HEIGHT - 0.75 * HEIGHT;
  const uncertainY = HEIGHT - 0.4 * HEIGHT;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} class="w-full h-16">
      {/* Threshold lines */}
      <line x1="0" y1={confidentY} x2={WIDTH} y2={confidentY} stroke="#22c55e" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.5" />
      <line x1="0" y1={uncertainY} x2={WIDTH} y2={uncertainY} stroke="#f59e0b" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.5" />
      {/* Score line */}
      <path d={pathD} fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  );
}
