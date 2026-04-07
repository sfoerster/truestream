import { useTrustLevel } from '../hooks/useTrustLevel';
import { useSettingsStore } from '../../store/settings-store';
import { TrustLevel } from '../../types/trust';

const LEVEL_COLORS: Record<TrustLevel, string> = {
  initializing: 'text-gray-400',
  confident: 'text-green-500',
  uncertain: 'text-amber-500',
  suspicious: 'text-orange-500',
  likely_synthetic: 'text-red-500',
  verified: 'text-blue-500',
};

const LEVEL_LABELS: Record<TrustLevel, string> = {
  initializing: 'INITIALIZING',
  confident: 'CONFIDENT',
  uncertain: 'UNCERTAIN',
  suspicious: 'SUSPICIOUS',
  likely_synthetic: 'LIKELY SYNTHETIC',
  verified: 'VERIFIED',
};

const QUALITY_LABELS = {
  full: 'Video + Audio',
  video_only: 'Video only',
  audio_only: 'Audio only',
  insufficient: 'Gathering data...',
};

/** Primary trust level display component for the side panel */
export function TrustIndicator() {
  const trust = useTrustLevel();
  const showNumerics = useSettingsStore((s) => s.showScoreNumerics);

  return (
    <div class="text-center space-y-2">
      <div class={`text-2xl font-bold ${LEVEL_COLORS[trust.level]}`}>
        {LEVEL_LABELS[trust.level]}
      </div>

      {showNumerics && trust.isActive && (
        <div class="text-3xl font-mono text-white">{trust.compositeScore.toFixed(2)}</div>
      )}

      {trust.isActive && trust.signalQuality !== 'insufficient' && (
        <div class="text-sm text-gray-400 space-x-2">
          {trust.videoScore !== null && <span>Video {trust.videoScore.toFixed(2)}</span>}
          {trust.videoScore !== null && trust.audioScore !== null && <span class="text-gray-600">·</span>}
          {trust.audioScore !== null && <span>Audio {trust.audioScore.toFixed(2)}</span>}
        </div>
      )}

      <div class="text-xs text-gray-500">{QUALITY_LABELS[trust.signalQuality]}</div>
    </div>
  );
}
