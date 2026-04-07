import { AttestationResult } from '../../types/vinsium';

interface VerifiedBadgeProps {
  attestation: AttestationResult;
}

/** Shown when trustLevel === 'verified' */
export function VerifiedBadge({ attestation }: VerifiedBadgeProps) {
  const timeStr = attestation.attestedAt ? new Date(attestation.attestedAt).toLocaleTimeString() : 'Unknown';

  return (
    <div class="p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg space-y-2">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
        </svg>
        <span class="text-blue-400 font-bold">Identity Verified</span>
      </div>

      {attestation.attestationType === 'registered_device' && attestation.deviceName && (
        <p class="text-sm text-gray-300">Device: {attestation.deviceName}</p>
      )}

      {attestation.attestationType === 'one_time_link' && (
        <p class="text-sm text-amber-400">
          Verified via one-time link. This provides weaker assurance than a registered device.
        </p>
      )}

      <p class="text-xs text-gray-500">Verified at {timeStr}</p>
    </div>
  );
}
