# Security Model (Lantern Remote)

## Process isolation

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Renderer never receives `ipcRenderer`, Node.js, or Electron APIs.
- `electron/preload.ts` exposes only the typed `window.lantern` bridge
  defined in `shared/ipc.ts`.

## Signaling vs. media

- The Socket.IO signaling server routes **only** signaling messages
  (registration, connection requests, offers/answers, ICE candidates).
- It **never receives screen video or remote input contents**.
- Screen/input flow peer-to-peer over WebRTC, which provides DTLS-SRTP
  encryption for media and SCTP encryption for DataChannels.

## Consent

- No silent access: the host must explicitly Accept each incoming request.
- Screen sharing must be explicitly started by the host user (Phase 4).
- Clipboard sync defaults to OFF and is text-only (Phase 9).

## Identity vs. authentication

- The 9-digit device ID (`482 913 742` format) is an **identifier, not a secret**.
- Phase 8 adds: cryptographically random temporary password
  (`crypto.randomInt`, never `Math.random`), expiry, plus host approval.
- Future production deployments should add authenticated device registration
  and TURN credentials; some NAT environments will require TURN infrastructure.

## Logging hygiene

Never log passwords, tokens, private keys, clipboard contents, or raw input events.
Log connection/ICE/signaling/WebRTC states and disconnect reasons only.
