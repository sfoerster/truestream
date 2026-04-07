import * as fs from 'fs';
import * as path from 'path';

interface ScoredFrame { timestamp: number; real: number; fake: number; confidence: number; }
interface ScoredWindow { timestamp: number; genuine: number; spoofed: number; confidence: number; }

function generateFrames(count: number, baseReal: number): ScoredFrame[] {
  return Array.from({ length: count }, (_, i) => {
    const real = Math.max(0, Math.min(1, baseReal + (Math.random() - 0.5) * 0.1));
    return { timestamp: 1700000000000 + i * 250, real, fake: 1 - real, confidence: 0.9 + Math.random() * 0.1 };
  });
}

function generateWindows(count: number, baseGenuine: number): ScoredWindow[] {
  return Array.from({ length: count }, (_, i) => {
    const genuine = Math.max(0, Math.min(1, baseGenuine + (Math.random() - 0.5) * 0.1));
    return { timestamp: 1700000000000 + i * 3000, genuine, spoofed: 1 - genuine, confidence: 0.9 + Math.random() * 0.1 };
  });
}

const outputDir = path.join(__dirname, '..', 'tests', 'fixtures', 'sessions');
fs.mkdirSync(outputDir, { recursive: true });

// Clean session
const clean = {
  sessionId: 'generated-clean-001', platform: 'google-meet', startTime: 1700000000000,
  videoScores: generateFrames(20, 0.9), audioScores: generateWindows(8, 0.92),
  compositeTrustScore: 0.91, trustLevel: 'confident', verificationState: null,
  trustHistory: [{ timestamp: 1700000001000, from: 'initializing', to: 'confident', trigger: 'score_change' }],
};
fs.writeFileSync(path.join(outputDir, 'generated-clean.json'), JSON.stringify(clean, null, 2));

// Flagged session
const flagged = {
  sessionId: 'generated-flagged-001', platform: 'google-meet', startTime: 1700000000000,
  videoScores: generateFrames(20, 0.25), audioScores: generateWindows(8, 0.3),
  compositeTrustScore: 0.27, trustLevel: 'suspicious', verificationState: null,
  trustHistory: [
    { timestamp: 1700000001000, from: 'initializing', to: 'uncertain', trigger: 'score_change' },
    { timestamp: 1700000003000, from: 'uncertain', to: 'suspicious', trigger: 'score_change' },
  ],
};
fs.writeFileSync(path.join(outputDir, 'generated-flagged.json'), JSON.stringify(flagged, null, 2));

console.log('Session fixtures generated.');
