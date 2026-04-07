import { useMemo } from 'preact/hooks';
import { useSession } from './useSession';
import { TrustLevel } from '../../types/trust';

export interface TrustLevelInfo {
  level: TrustLevel;
  compositeScore: number;
  videoScore: number | null;
  audioScore: number | null;
  signalQuality: 'full' | 'video_only' | 'audio_only' | 'insufficient';
  isActive: boolean;
}

export function useTrustLevel(): TrustLevelInfo {
  const session = useSession();
  return useMemo<TrustLevelInfo>(() => {
    if (!session) return { level: 'initializing', compositeScore: 0, videoScore: null, audioScore: null, signalQuality: 'insufficient', isActive: false };
    const hasVideo = session.videoScores.length >= 3;
    const hasAudio = session.audioScores.length >= 3;
    let signalQuality: TrustLevelInfo['signalQuality'] = 'insufficient';
    if (hasVideo && hasAudio) signalQuality = 'full';
    else if (hasVideo) signalQuality = 'video_only';
    else if (hasAudio) signalQuality = 'audio_only';
    const latestVideo = session.videoScores.length > 0 ? session.videoScores[session.videoScores.length - 1].real : null;
    const latestAudio = session.audioScores.length > 0 ? session.audioScores[session.audioScores.length - 1].genuine : null;
    return { level: session.trustLevel, compositeScore: session.compositeTrustScore, videoScore: latestVideo, audioScore: latestAudio, signalQuality, isActive: true };
  }, [session]);
}
