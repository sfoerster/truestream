import { ScoredFrame, ScoredWindow } from '../../src/types/session';

export function generateVideoScores(count: number, baseReal = 0.8): ScoredFrame[] {
  const scores: ScoredFrame[] = [];
  for (let i = 0; i < count; i++) {
    const real = Math.max(0, Math.min(1, baseReal + (Math.random() - 0.5) * 0.1));
    scores.push({ timestamp: Date.now() - (count - i) * 250, real, fake: 1 - real, confidence: 0.9 + Math.random() * 0.1 });
  }
  return scores;
}

export function generateAudioScores(count: number, baseGenuine = 0.8): ScoredWindow[] {
  const scores: ScoredWindow[] = [];
  for (let i = 0; i < count; i++) {
    const genuine = Math.max(0, Math.min(1, baseGenuine + (Math.random() - 0.5) * 0.1));
    scores.push({ timestamp: Date.now() - (count - i) * 3000, genuine, spoofed: 1 - genuine, confidence: 0.9 + Math.random() * 0.1 });
  }
  return scores;
}
