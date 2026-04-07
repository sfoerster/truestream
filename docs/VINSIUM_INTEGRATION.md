# Vinsium Integration

Vinsium provides cryptographic identity verification as an escalation path when AI-based trust scoring is inconclusive. This document describes the integration protocol, API contract, attestation types, signature verification, account states, error handling, and the stub bridge used for development and testing.

---

## Overview

Vinsium is an external service that manages Ed25519 public key pairs tied to user identities. When a TrueStream user wants to verify the identity of a remote call participant beyond what AI scoring can provide, TrueStream initiates a challenge-response protocol through Vinsium.

Vinsium is entirely optional. TrueStream functions fully without it, using only AI-based scoring. Vinsium adds a **Verified** trust level that AI scoring alone can never reach, providing mathematical certainty where statistical inference provides only probabilistic confidence.

---

## Challenge-Response Flow

```
  Verifier (local user)     TrueStream Extension     Vinsium Service          Prover (remote user)
       |                          |                       |                          |
       |  1. Click "Verify"       |                       |                          |
       +------------------------->|                       |                          |
       |                          |                       |                          |
       |                          |  2. Generate nonce    |                          |
       |                          +---+                   |                          |
       |                          |   | crypto.           |                          |
       |                          |   | getRandomValues() |                          |
       |                          |   | (32 bytes)        |                          |
       |                          |<--+                   |                          |
       |                          |                       |                          |
       |                          |  3. POST /v1/challenge|                          |
       |                          +---------------------->|                          |
       |                          |                       |                          |
       |                          |  4. 202 Accepted      |                          |
       |                          |     {challenge_id}    |                          |
       |                          |<----------------------+                          |
       |                          |                       |                          |
       |                          |                       |  5. Forward challenge    |
       |                          |                       |     (push/WS/poll)       |
       |                          |                       +------------------------->|
       |                          |                       |                          |
       |                          |                       |  6. Sign(nonce, sk)      |
       |                          |                       |     Ed25519              |
       |                          |                       |<-------------------------+
       |                          |                       |                          |
       |                          |  7. GET /v1/challenge/{id}                       |
       |                          +---------------------->|                          |
       |                          |                       |                          |
       |                          |  8. 200 OK            |                          |
       |                          |     {sig, pk, status: |                          |
       |                          |      "completed"}     |                          |
       |                          |<----------------------+                          |
       |                          |                       |                          |
       |                          |  9. Verify locally    |                          |
       |                          +---+                   |                          |
       |                          |   | Ed25519 verify    |                          |
       |                          |   | (sig, pk, nonce)  |                          |
       |                          |<--+                   |                          |
       |                          |                       |                          |
       |                          | 10. Fetch registered  |                          |
       |                          |     public key        |                          |
       |                          +---------------------->|                          |
       |                          |     GET /v1/accounts/ |                          |
       |                          |     {account_id}/     |                          |
       |                          |     public-key        |                          |
       |                          |<----------------------+                          |
       |                          |                       |                          |
       |                          | 11. Compare pk ==     |                          |
       |                          |     registered pk     |                          |
       |                          +---+                   |                          |
       |                          |<--+                   |                          |
       |                          |                       |                          |
       | 12. Result: Verified     |                       |                          |
       |<-------------------------+                       |                          |
       |                          |                       |                          |
```

### Step Details

1. **Click "Verify":** The local user clicks the "Verify" button in the side panel or on the trust ring overlay. This is always a deliberate user action; TrueStream never initiates verification automatically.
2. **Generate nonce:** TrueStream generates a cryptographically random 32-byte nonce using `crypto.getRandomValues()`. The nonce is stored in memory for later comparison.
3. **POST /v1/challenge:** The nonce (base64-encoded), the remote participant's Vinsium account identifier, a session ID, and the challenger's account ID are sent to the Vinsium service.
4. **202 Accepted:** Vinsium returns a challenge ID and an expiration timestamp (default: 60 seconds from creation).
5. **Forward challenge:** Vinsium forwards the challenge to the prover through its own delivery channel (push notification, WebSocket, or client polling).
6. **Sign:** The prover's Vinsium client signs the nonce with their Ed25519 private key. The private key never leaves the prover's device.
7. **Poll:** TrueStream polls `GET /v1/challenge/{challenge_id}` every 2 seconds while the challenge is pending.
8. **Completed:** When the prover has signed, the poll returns `status: "completed"` with the signature and public key.
9. **Verify locally:** TrueStream verifies the Ed25519 signature locally using the Web Crypto API (`crypto.subtle.verify`).
10. **Fetch registered key:** TrueStream fetches the public key registered with Vinsium for the target account to confirm key binding.
11. **Compare:** The public key from the response is compared against the registered key. Both must match.
12. **Result:** If both the signature and key binding checks pass, the trust level is set to **Verified**. The side panel displays the verified account information.

---

## Cold Path

The "cold path" is the flow when the remote participant does not have a Vinsium account or has not installed the Vinsium client.

```
  Verifier                TrueStream               Vinsium Service
       |                       |                       |
       |  Click "Verify"       |                       |
       +---------------------->|                       |
       |                       |  POST /v1/challenge   |
       |                       +---------------------->|
       |                       |                       |
       |                       |  404 Not Found        |
       |                       |  (account not found)  |
       |                       |<----------------------+
       |                       |                       |
       |  "Remote participant  |                       |
       |   is not set up for   |                       |
       |   verification"       |                       |
       |<----------------------+                       |
       |                       |                       |
```

Alternatively, if the account exists but the prover never responds:

```
  Verifier                TrueStream               Vinsium Service
       |                       |                       |
       |  Click "Verify"       |                       |
       +---------------------->|                       |
       |                       |  POST /v1/challenge   |
       |                       +---------------------->|
       |                       |  202 Accepted         |
       |                       |<----------------------+
       |                       |                       |
       |                       |  Poll (every 2s)...   |
       |                       +--- ... ------------->|
       |                       |  status: "pending"    |
       |                       |<--- ... -------------+
       |                       |                       |
       |                       |  (60 seconds elapse)  |
       |                       |                       |
       |                       |  Poll                 |
       |                       +---------------------->|
       |                       |  status: "expired"    |
       |                       |<----------------------+
       |                       |                       |
       |  "Verification timed  |                       |
       |   out. The remote     |                       |
       |   participant did not |                       |
       |   respond."           |                       |
       |<----------------------+                       |
```

In both cold-path cases, the trust level remains at whatever the AI scoring currently supports. **No degradation occurs** because of a failed Vinsium lookup. Vinsium verification is always additive and opt-in for both parties.

---

## API Contract

### POST `/v1/challenge`

Initiates a challenge-response verification.

**Request:**
```json
{
  "challenger_id": "string",
  "target_account": "string",
  "nonce": "base64-encoded-32-bytes",
  "session_id": "string"
}
```

**Response (202 Accepted):**
```json
{
  "challenge_id": "uuid",
  "status": "pending",
  "expires_at": "ISO-8601 timestamp"
}
```

**Error responses:**
- `404 Not Found` -- Target account does not exist.
- `403 Forbidden` -- Target account is suspended.
- `410 Gone` -- Target account's key has been revoked.
- `429 Too Many Requests` -- Rate limit exceeded.

### GET `/v1/challenge/{challenge_id}`

Polls for challenge completion.

**Response (200 OK, pending):**
```json
{
  "challenge_id": "uuid",
  "status": "pending",
  "expires_at": "ISO-8601 timestamp"
}
```

**Response (200 OK, completed):**
```json
{
  "challenge_id": "uuid",
  "status": "completed",
  "signature": "base64-encoded-ed25519-signature",
  "public_key": "base64-encoded-ed25519-public-key",
  "signed_at": "ISO-8601 timestamp"
}
```

**Response (200 OK, expired):**
```json
{
  "challenge_id": "uuid",
  "status": "expired"
}
```

### GET `/v1/accounts/{account_id}/public-key`

Retrieves the registered public key for an account. Used for key binding verification.

**Response (200 OK):**
```json
{
  "account_id": "string",
  "public_key": "base64-encoded-ed25519-public-key",
  "registered_at": "ISO-8601 timestamp",
  "key_status": "active"
}
```

**Error responses:**
- `404 Not Found` -- Account does not exist.
- `410 Gone` -- Key has been revoked.

---

## Attestation Types

Vinsium's protocol is designed to be extensible. TrueStream currently uses one attestation type, with others planned:

| Type | Description | Status |
|------|-------------|--------|
| `identity.ed25519` | Ed25519 signature over a random nonce, proving control of a registered key pair. Fast, no hardware dependency. | **Supported** |
| `identity.webauthn` | WebAuthn assertion using a platform authenticator (fingerprint, face, security key). Ties verification to a physical gesture. | Planned |
| `device.tpm` | TPM-backed attestation proving the call originates from a specific physical device. Prevents key extraction and replay from a different machine. | Planned |
| `liveness.video` | Challenge to perform a specific gesture on camera, verified by Vinsium's server-side model. Combines identity with liveness. | Under consideration |

The attestation type is specified in the challenge request. TrueStream's bridge (`src/vinsium/bridge.ts`) currently hardcodes `identity.ed25519` but the interface supports future types.

---

## Signature Verification

TrueStream performs Ed25519 signature verification locally using the Web Crypto API in `src/vinsium/crypto.ts`:

```typescript
async function verifySignature(
  publicKeyBytes: Uint8Array,
  signature: Uint8Array,
  nonce: Uint8Array,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    publicKeyBytes,
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  return crypto.subtle.verify("Ed25519", key, signature, nonce);
}
```

Verification checks two independent conditions, both of which must pass:

1. **Signature validity:** The signature is a valid Ed25519 signature of the nonce under the provided public key. This proves the signer possesses the corresponding private key.
2. **Key binding:** The provided public key matches the key registered with Vinsium for the target account (fetched via `/v1/accounts/{account_id}/public-key`). This binds the cryptographic proof to a specific identity.

If either check fails, verification fails and the trust level is not changed.

---

## Account States

A Vinsium account can be in several states that affect the challenge flow:

| State | Meaning | HTTP Response | TrueStream Behavior |
|-------|---------|---------------|---------------------|
| `active` | Account is registered and key is valid. | Challenge proceeds (202). | Normal flow. |
| `suspended` | Account temporarily suspended (e.g., for abuse or suspicious activity). | `403 Forbidden` | Shows "Verification unavailable for this account." Trust level unchanged. |
| `revoked` | Key has been explicitly revoked by the account holder (e.g., after key compromise). | `410 Gone` | Shows "This account's verification key has been revoked." Trust level unchanged. |
| `not_found` | No account exists for the target identifier. | `404 Not Found` | Shows "No verification account found for this participant." Trust level unchanged. |

In all non-active states, the trust level is **never degraded**. Vinsium is a purely additive system: its failures and unavailability never make things worse.

---

## Stub Bridge

For development, testing, and offline use, TrueStream includes a stub Vinsium bridge at `src/vinsium/bridge.stub.ts` that simulates the entire challenge-response protocol without making any network requests.

### What the Stub Does

- Generates a deterministic Ed25519 key pair from a configurable seed using a KDF.
- Signs challenges locally using the generated key pair.
- Returns results after a configurable delay (default: 500ms) to simulate network latency.
- Can be configured to simulate all failure modes (expired challenge, suspended account, revoked key, not found, network error).

### When the Stub Is Active

The stub bridge is activated when any of the following conditions are met:

- The build target is `stub` (i.e., `npm run dev:stub` or `npm run build:stub`).
- The user enables "Use stub Vinsium" in the extension options page (`preferences.vinsiumStub = true` in `chrome.storage.local`).
- The `VINSIUM_STUB=true` environment variable is set during build.

The WXT build configuration (`wxt.config.ts`) handles the bridge swap at build time, aliasing `bridge.ts` to `bridge.stub.ts` when the stub mode is active.

### Stub Configuration

```typescript
interface StubConfig {
  delay: number;             // Simulated network delay in ms (default: 500)
  shouldSucceed: boolean;    // Whether the challenge should succeed (default: true)
  failureMode?:
    | "expired"              // Challenge times out
    | "suspended"            // Target account is suspended
    | "revoked"              // Target key is revoked
    | "not_found"            // Target account not found
    | "network_error";       // Simulated network failure
  seed?: string;             // Deterministic seed for key generation (default: "test-seed")
}
```

### Using the Stub in Tests

```typescript
import { createStubBridge } from "@/vinsium/bridge.stub";

const bridge = createStubBridge({
  delay: 0,           // No delay in tests
  shouldSucceed: true,
});

const result = await bridge.verify("target-account-id", "session-123");
expect(result.verified).toBe(true);
```

To test failure modes:

```typescript
const bridge = createStubBridge({
  delay: 0,
  shouldSucceed: false,
  failureMode: "expired",
});

const result = await bridge.verify("target-account-id", "session-123");
expect(result.verified).toBe(false);
expect(result.error).toBe("Challenge expired");
```

---

## Error Handling

All Vinsium operations are wrapped in error handling that isolates failures from the core AI-based scoring pipeline. The Vinsium bridge never throws exceptions that propagate to the scoring system.

| Error | Handling | User Message |
|-------|----------|-------------|
| Network timeout | Challenge marked as failed. | "Verification timed out. Check your connection and try again." |
| HTTP 403 (Suspended) | Challenge rejected. | "Verification unavailable for this account." |
| HTTP 404 (Not Found) | Challenge rejected. | "No verification account found for this participant." |
| HTTP 410 (Revoked) | Challenge rejected. | "This account's verification key has been revoked." |
| HTTP 429 (Rate Limit) | Challenge queued for retry. | "Too many verification attempts. Please wait." |
| HTTP 5xx (Server Error) | Challenge marked as failed. | "Vinsium service is temporarily unavailable. Try again later." |
| Invalid signature | Verification fails. | "Signature verification failed. The response could not be authenticated." |
| Key mismatch | Verification fails. | "The signing key does not match the registered key for this account." |
| Concurrent challenge | Subsequent request queued. | "A verification is already in progress." |
| Challenge expired (60s) | Challenge marked as failed. | "The remote participant did not respond within 60 seconds." |

In all error cases, the trust level is **never degraded**. A failed Vinsium attempt simply means the Verified level is not reached; the trust level remains at whatever the AI scoring supports.

---

## Security Considerations

- **Nonce reuse prevention:** Each challenge uses a fresh 32-byte nonce generated via `crypto.getRandomValues()`. Nonces are never reused across challenges. The challenge ID binds the nonce to a specific challenge instance.
- **Replay attacks:** Challenges expire after 60 seconds. Signed responses include the challenge ID, binding them to a specific challenge instance. A replayed response from a previous challenge will fail because the nonce will not match.
- **Key pinning:** TrueStream does not persist public keys between sessions. Each verification fetches the current registered key from Vinsium, ensuring revoked keys are detected immediately on the next verification attempt.
- **MITM on Vinsium:** If the HTTPS connection to the Vinsium service is intercepted, an attacker could provide a fraudulent public key. This is mitigated by TLS certificate validation and by the fact that the attacker would also need the corresponding private key to produce a valid signature for the nonce. Both conditions must hold simultaneously for a successful MITM attack.
- **Side-channel isolation:** Vinsium messages travel through a completely separate channel from the WebRTC media path. Compromising one channel does not compromise the other.
- **No media in protocol:** The Vinsium protocol never transmits video frames, audio samples, inference scores, or any other media-derived data. Only nonces, signatures, public keys, and account identifiers are exchanged.
