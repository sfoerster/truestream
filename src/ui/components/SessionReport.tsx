import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { SessionState } from '../../types/session';

interface SessionReportProps {
  session: SessionState;
}

/** Collapsible session report at the bottom of the side panel */
export function SessionReport({ session }: SessionReportProps) {
  const [expanded, setExpanded] = useState(false);

  const duration = Math.floor((Date.now() - session.startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const copyReport = useCallback(() => {
    const lines = [
      `TrueStream Session Report`,
      `Session ID: ${session.sessionId}`,
      `Platform: ${session.platform}`,
      `Duration: ${minutes}m ${seconds}s`,
      `Final Trust Level: ${session.trustLevel}`,
      `Final Score: ${session.compositeTrustScore.toFixed(2)}`,
      `Video Scores: ${session.videoScores.length}`,
      `Audio Scores: ${session.audioScores.length}`,
      ``,
      `Trust History:`,
      ...session.trustHistory.map(
        (h) => `  ${new Date(h.timestamp).toLocaleTimeString()} ${h.from} -> ${h.to} (${h.trigger})`,
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }, [session, minutes, seconds]);

  return (
    <div class="border-t border-gray-700 pt-3">
      <button onClick={() => setExpanded(!expanded)} class="flex items-center justify-between w-full text-sm text-gray-400 hover:text-gray-200">
        <span>Session Report</span>
        <span>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div class="mt-3 space-y-2 text-xs text-gray-400">
          <p>Duration: {minutes}m {seconds}s</p>
          <p>Platform: {session.platform}</p>

          <div>
            <p class="text-gray-300 mb-1">Trust History:</p>
            {session.trustHistory.length === 0 ? (
              <p class="text-gray-500">No transitions yet</p>
            ) : (
              <ul class="space-y-1">
                {session.trustHistory.map((h, i) => (
                  <li key={i} class="pl-2 border-l border-gray-600">
                    {new Date(h.timestamp).toLocaleTimeString()}: {h.from} → {h.to}
                    <span class="text-gray-600 ml-1">({h.trigger})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={copyReport} class="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors">
            Copy session report
          </button>
        </div>
      )}
    </div>
  );
}
