# AGENTS.md — Working Conventions for Lantern Remote

This file tells any coding agent (or new contributor) how to work in this repo.
Authoritative docs: `README.md` (architecture/setup), `SECURITY.md` (security model).

## Stack (do not change without discussion)

Electron Forge (Vite plugin) · Vite · React 19 · TypeScript strict · Zustand ·
Socket.IO (signaling only) · WebRTC (media + DataChannels). **No Electron Builder.**

## Commands

```bash
npm run start      # dev
npm run package    # production package
npm run make       # distributables
npm run typecheck  # tsc --noEmit
npm run lint       # eslint electron src server shared
npm run format     # prettier --write
```

Linux sandbox note: if `npm run start` aborts on `chrome-sandbox` SUID,
use `ELECTRON_DISABLE_SANDBOX=1 npm run start` (dev machines only).

## Process model (non-negotiable)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — see
  `electron/main/window.ts`. Never weaken these.
- Renderer never touches `ipcRenderer`/Node/Electron directly. All access goes
  through `window.lantern` (see `electron/preload.ts` + `shared/ipc.ts`).
- `shared/ipc.ts` is the single source of truth for channels/payloads.
  Extend it when adding IPC; keep preload/main/renderer in sync.
- No business logic in JSX. Logic lives in `src/services/`, `src/hooks/`,
  `electron/services/`, `server/`. Components are presentational.

## Code quality rules

- TypeScript strict; `no-explicit-any` is an error. No `any` without a comment
  explaining why it is unavoidable.
- Small focused modules; interfaces for platform-specific services;
  dependency injection where useful.
- Never duplicate WebRTC or IPC logic — one service per concern
  (`WebRTCService`, `ScreenCaptureService`, `RemoteInputService`).
- Comments explain WHY, not what. No giant components.
- Validate every remote message (signaling + DataChannel). Never trust remote input.
- Never log passwords, tokens, clipboard contents, or raw input events.

## Security invariants

- Host must explicitly Accept every incoming connection. No auto-accept, no
  stealth/persistence/bypass behavior of any kind (see README § constraints).
- Device ID is an identifier, not a secret. Auth = device ID + expiring
  token (`crypto.randomInt`, never `Math.random`) + host approval.
- Signaling server never receives screen video — only signaling messages.

## Phase workflow (mandatory per phase)

1. Implement the phase per `TODO.md`.
2. Run `npm run typecheck`, `npm run lint`, relevant tests.
3. Run the app (`npm run start`) when UI/main-process code changed.
4. Fix all errors before moving on.
5. Report: files changed, architecture notes, verification results,
   manual test steps. Then stop and wait for the next instruction.
6. Commit with the conventional message listed in `TODO.md`
   (only when asked to commit).

## Adding dependencies

Prefer official Electron/WebRTC APIs and well-maintained packages.
State why the dependency is needed; avoid drive-by additions.
`socket.io` / `socket.io-client` arrive in Phase 2; add them then, not earlier.

## Quality & workflow
- Agent: read files fully before editing; one `in_progress` todo at a time (verify before completing); preserve user corrections/constraints; never overwrite user edits — reconcile instead; update this file when a new convention/workflow is established.

