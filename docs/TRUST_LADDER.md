# Trust Ladder

TrueStream uses a five-level trust model called the **trust ladder** plus a special cryptographic tier. This document explains the levels, transitions, asymmetric hysteresis rules, configurable thresholds, and design rationale.

---

## Design Philosophy

Trust is presented as a discrete ladder, not a continuous score. Users see a clear, actionable indicator rather than a floating-point number they must interpret. The ladder is deliberately conservative: it is easier to lose trust than to regain it, and the highest level can only be reached through cryptographic proof.

---

## The Five Levels (Plus Verified)

### Level 1: Distrusted

- **Badge:** Red octagon
- **Composite score range:** 0.00 - 0.29
- **Meaning:** Strong evidence of synthetic or manipulated media in the stream. Both video and audio models are reporting high fake probability.
- **User guidance:** "This stream shows strong signs of manipulation. Do not trust the identity of the person on this call."
- **Recommended action:** End the call or verify identity through an independent out-of-band channel. Vinsium verification is also offered but the user should exercise extreme caution.

### Level 2: Uncertain

- **Badge:** Yellow triangle
- **Composite score range:** 0.30 - 0.49
- **Meaning:** Some indicators of manipulation detected, but not conclusive. The models see anomalies that could indicate a deepfake or could be caused by poor network conditions, unusual lighting, or heavy compression.
- **User guidance:** "Some anomalies detected. Consider verifying identity through other means."
- **Recommended action:** Use Vinsium cryptographic verification to resolve the ambiguity.

**The commercial zone.** The Uncertain level is the primary value proposition for Vinsium. When a user sees Uncertain, TrueStream suggests cryptographic verification as a resolution path. The Uncertain range (0.30 - 0.49) is deliberately wide enough to capture edge cases that AI scoring cannot resolve with confidence, making Vinsium's value clear without manufacturing false alarms. This is an honest acknowledgment that AI detection has inherent limits, and cryptographic proof fills the gap.

### Level 3: Nominal

- **Badge:** Grey circle
- **Composite score range:** 0.50 - 0.84
- **Meaning:** Baseline state. Not enough data to make a confident judgment, or scores fall in the middle range where the models are not strongly confident in either direction.
- **User guidance:** "No anomalies detected so far. Monitoring continues."

Every session starts at Nominal. This is the default state before any inference has completed, and it persists until enough scoring windows have accumulated to trigger a transition in either direction.

### Level 4: Trusted

- **Badge:** Green circle
- **Composite score range:** 0.85 - 1.00
- **Meaning:** AI models consistently score the stream as authentic across multiple consecutive scoring windows. Both video and audio analyses indicate genuine media.
- **User guidance:** "AI analysis indicates this stream is likely authentic."

Note the qualifier "likely." Trusted is a probabilistic assessment, not a guarantee. Sufficiently advanced deepfakes could potentially score in this range. For certainty, the user should escalate to Verified.

### Level 5: Verified

- **Badge:** Green shield
- **Composite score range:** Not applicable (set by cryptographic proof, not AI scoring)
- **Meaning:** The remote participant's identity has been cryptographically proven through a Vinsium challenge-response using Ed25519 signatures.
- **User guidance:** "Identity verified cryptographically. This person has proven control of their registered key."

Verified is fundamentally different from the other four levels. It is not derived from statistical inference -- it is derived from mathematical proof. See the "Verified Immutability" section below.

---

## Threshold Table

| Composite Score Range | Trust Level | Badge |
|-----------------------|-------------|-------|
| 0.00 - 0.29 | Distrusted | Red octagon |
| 0.30 - 0.49 | Uncertain | Yellow triangle |
| 0.50 - 0.84 | Nominal | Grey circle |
| 0.85 - 1.00 | Trusted | Green circle |
| N/A (crypto proof) | Verified | Green shield |

### Configurable Thresholds

Thresholds are configurable via `chrome.storage.local` in the extension options page for advanced users. The three configurable boundaries are:

| Setting | Default | Storage key |
|---------|---------|-------------|
| Trusted threshold | 0.85 | `preferences.thresholds.trusted` |
| Nominal threshold | 0.50 | `preferences.thresholds.nominal` |
| Uncertain threshold | 0.30 | `preferences.thresholds.uncertain` |

The defaults are calibrated against the FaceForensics++ (LQ) and ASVspoof 2021 (DF) validation sets to minimize false positives while maintaining sensitivity to real attacks. Lowering the Trusted threshold makes it easier to reach Trusted but increases the risk of missing sophisticated deepfakes. Raising the Uncertain threshold widens the Uncertain zone and triggers more Vinsium suggestions.

---

## Asymmetric Hysteresis

Instant trust level changes would cause the badge to flicker during normal network jitter, video compression artifacts, lighting changes, or brief visual glitches. TrueStream uses asymmetric hysteresis to provide stable, meaningful transitions.

### Degradation: 3 Consecutive Windows

To move the trust level **downward** (e.g., from Trusted to Nominal, or Nominal to Uncertain), **three consecutive** scoring windows must produce composite scores in the lower level's range.

```
Window 1: composite = 0.42 (Uncertain range) -> degrade counter: 1/3
Window 2: composite = 0.38 (Uncertain range) -> degrade counter: 2/3
Window 3: composite = 0.41 (Uncertain range) -> degrade counter: 3/3 -> DEGRADE to Uncertain
```

If any window in the sequence produces a composite score at or above the current level's threshold, the degradation counter resets to zero:

```
Window 1: composite = 0.42 (Uncertain range) -> degrade counter: 1/3
Window 2: composite = 0.55 (Nominal range)   -> degrade counter: RESET to 0
Window 3: composite = 0.39 (Uncertain range) -> degrade counter: 1/3 (starting over)
```

### Recovery: 5 Consecutive Windows

To move the trust level **upward** (e.g., from Uncertain to Nominal, or Nominal to Trusted), **five consecutive** scoring windows must produce composite scores in the higher level's range.

```
Window 1: composite = 0.87 (Trusted range) -> recover counter: 1/5
Window 2: composite = 0.91 (Trusted range) -> recover counter: 2/5
Window 3: composite = 0.88 (Trusted range) -> recover counter: 3/5
Window 4: composite = 0.90 (Trusted range) -> recover counter: 4/5
Window 5: composite = 0.86 (Trusted range) -> recover counter: 5/5 -> RECOVER to Trusted
```

If any window drops below the target level's threshold, the recovery counter resets:

```
Window 1: composite = 0.87 (Trusted range) -> recover counter: 1/5
Window 2: composite = 0.91 (Trusted range) -> recover counter: 2/5
Window 3: composite = 0.72 (Nominal range) -> recover counter: RESET to 0
Window 4: composite = 0.88 (Trusted range) -> recover counter: 1/5 (starting over)
```

### Why Asymmetric?

The asymmetry (3 to degrade, 5 to recover) is a deliberate design choice reflecting security principles:

- **Fast degradation** ensures that real threats are surfaced quickly. At the default video inference cadence of 1 fps, three windows means approximately 3 seconds to warn the user of a potential deepfake.
- **Slow recovery** prevents an attacker from briefly disabling their deepfake (showing their real face for a few seconds) to reset the trust level and then resuming the attack. Five consecutive clean windows means the stream must be consistently authentic for approximately 5 seconds before trust is restored.
- **Net effect:** It is easier to lose trust than to regain it. This matches real-world security intuition: trust is hard to earn and easy to break. A security tool should err on the side of warning.

### Hysteresis Counters

The trust state machine maintains two counters per session:

- `degradeCounter`: Counts consecutive windows scoring in a lower level. Range: 0-3. Resets when a window scores at or above the current level.
- `recoverCounter`: Counts consecutive windows scoring in a higher level. Range: 0-5. Resets when a window scores below the target level.

Both counters are stored in `chrome.storage.session` as part of the session state and survive service worker restarts.

---

## Multi-Level Transitions

Trust can only move **one level at a time** per hysteresis cycle. Even if the composite score drops from the Trusted range (0.90) directly into the Distrusted range (0.10), the trust level steps through each intermediate level:

```
Trusted -> (3 windows in Nominal range) -> Nominal
         -> (3 windows in Uncertain range) -> Uncertain
         -> (3 windows in Distrusted range) -> Distrusted
```

This takes a minimum of 9 scoring windows (approximately 9 seconds) to fall from Trusted to Distrusted. The stepwise approach prevents jarring visual jumps and gives the user time to process each transition.

Recovery follows the same pattern in reverse, requiring 5 windows per level:

```
Distrusted -> (5 windows) -> Uncertain -> (5 windows) -> Nominal -> (5 windows) -> Trusted
```

Minimum recovery from Distrusted to Trusted: 15 windows (approximately 15 seconds).

---

## The Verified Level

### How It Is Reached

Verified can **only** be reached through a successful Vinsium challenge-response. No amount of high AI scores will promote a session to Verified. This is a fundamental design boundary:

- AI provides probabilistic confidence (Trusted = "probably real").
- Cryptography provides mathematical certainty (Verified = "proven control of registered key").

These are categorically different claims, and the trust ladder reflects that distinction.

### Immutability

Once a session reaches Verified, AI-based scoring **cannot degrade it**. Even if every subsequent frame scores 0.0 (maximally fake), the Verified badge remains. The rationale:

1. **Cryptographic proof is strictly stronger than statistical inference.** A proven identity does not become unproven because of visual artifacts or model uncertainty.
2. **Removing Verified based on AI scores would undermine user trust in the verification system.** If the green shield could disappear due to a network glitch, users would stop trusting it.
3. **Consistency.** The Verified level represents a discrete event (a successful challenge-response), not an ongoing assessment. Events that happened are not un-happened by subsequent observations.

### What Can Remove Verified

Only two events remove the Verified status:

1. **Failed re-challenge:** If the user explicitly re-runs Vinsium verification and it fails (invalid signature, key mismatch, or timeout), Verified is removed and the trust level falls back to whatever the current AI scoring supports.
2. **Session termination:** When the call ends or the tab is closed, all session state, including Verified, is cleared. Verification does not carry across sessions.

A Vinsium service outage, network error, or challenge expiration does **not** remove an existing Verified status. Only an actively failed re-verification can do so.

---

## Scoring Windows

A scoring window is the time interval over which inference results are collected before making a trust decision.

| Modality | Window duration | Inference cadence |
|----------|-----------------|-------------------|
| Video | 1 second | 1 frame per second |
| Audio | 2 seconds | 1 chunk per 2 seconds |

At the end of each window, the composite scorer combines available modality scores:

```
composite = (video_weight * video_score) + (audio_weight * audio_score)

Default weights:
  video_weight = 0.60
  audio_weight = 0.40
```

If only one modality is available (e.g., video-only call, or Zoom where audio interception is unavailable), that modality receives 100% of the weight. The composite scorer in `composite-scorer.ts` also applies exponential moving average smoothing via `smoothing.ts` to reduce noise between consecutive windows.

---

## Edge Cases

### Cold Start

When a call first begins, there are no inference results yet. The session starts at **Nominal** and stays there until enough scoring windows have completed to trigger a transition via hysteresis. This means the first possible trust change (in either direction) occurs at the earliest after 3 windows (approximately 3 seconds for degradation).

### Network Interruption

If frames stop arriving (e.g., due to network issues or the remote participant disabling their camera), no new scoring windows are produced. The trust level holds at its last value. TrueStream does not degrade trust due to the **absence** of data -- it only degrades based on actively suspicious data. When frames resume, scoring continues from the current state with reset hysteresis counters.

### Multiple Participants

Each remote participant is scored independently with their own:
- Trust ladder level
- Hysteresis counters (degrade and recover)
- Vinsium verification status
- Score history

The overlay displays a separate trust ring badge per participant, positioned on their respective video tile.

### Tab Backgrounding

When a tab is backgrounded, browsers throttle timers and may suspend workers. TrueStream detects this condition and pauses scoring. The trust level holds at its last value until the tab is foregrounded and scoring resumes. No degradation occurs during backgrounding.

### Platform Fallback Mode

When a platform does not support Insertable Streams (e.g., Zoom) and TrueStream falls back to canvas capture, the overlay displays a subtle indicator that a fallback method is in use. Detection accuracy may be 5-8% lower in fallback mode because captured frames have already been decoded and re-rendered, potentially losing subtle artifacts the models rely on.
