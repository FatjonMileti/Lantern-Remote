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
- Remote input flows only inside an accepted, actively sharing session, and
  only whitelisted message kinds are processed (Phase 6). OS backends will
  additionally require explicit OS-level permission (uinput group /
  Accessibility approval) when they land.
- Clipboard sync defaults to OFF and is text-only (Phase 9).

## Identity vs. authentication

- The 9-digit device ID (`482 913 742` format) is an **identifier, not a secret**.
- It is generated with `crypto.randomInt` and persisted under `userData`
  (never a MAC address or other hardware identifier).
- Every session additionally requires a temporary connection code plus host
  approval (device ID + code + Accept, all three).

## Connection codes (Phase 8)

- 6 characters from an unambiguous alphabet (no 0/O, 1/I/L), generated with
  `crypto.randomInt`, compared in constant time (`timingSafeEqual`).
- 10-minute expiry, single-use (burned the moment an Accept authorizes a
  session), revoked on session teardown, never persisted — a restart wipes them.
- The host validates the presented code **before** showing any Accept/Reject
  UI; wrong codes are auto-rejected with `invalid-token` and counted, so
  guessing attempts are visible.
- Codes travel opaquely through the signaling server (shape-checked only —
  the server never holds a live code). A compromised server could still
  harvest a presented code, which is why expiry is short and use is single;
  production deployments should add authenticated device registration.
- The human carries the code out-of-band (host screen → client keyboard),
  like a pairing PIN; the client never stores it beyond the typed field.
- Future production deployments should add authenticated device registration
  and TURN credentials; some NAT environments will require TURN infrastructure.

## Logging hygiene

Never log passwords, tokens, private keys, clipboard contents, or raw input events.
Log connection/ICE/signaling/WebRTC states and disconnect reasons only.
