# TODO.md — Build Phases for Lantern Remote

Phase 1 (scaffold) is **done and pushed** (`feat: initialize electron forge vite application`).
Phase 2 (signaling) is **implemented in the working tree, not yet committed**.
Implement phases in order; do not skip ahead.
After each phase follow the Phase workflow in `AGENTS.md`, then stop and wait.

---

## Phase 2 — Signaling server + device registration — DONE (uncommitted)

**Goal:** two app instances discover each other via Socket.IO.

- [x] Add `socket.io` + `socket.io-client` dependencies; explain why.
      (Why documented in `server/index.ts` + README: rooms, acks, reconnect for
      signaling only — never media. `tsx` added as dev runner for `npm run server`.)
- [x] Implement `server/`:
  - [x] `socket/deviceRegistry.ts` — device registry (`register-device`, presence,
        disconnect cleanup, displaces stale socket on re-register)
  - [x] `rooms/connectionRooms.ts` — connection rooms (create pending, accept,
        remove, TTL expiry)
  - [x] Route: `connection-request`, `connection-accepted`, `connection-rejected`
        (`server/socket/handlers.ts`, auth checks: registered-only, host-only
        accept/reject, no self-connect, one session per device)
  - [x] Notify: device online/offline, `disconnect-device`, `peer-disconnected`
        (`left`/`offline`/`timeout`/`rejected`), pending-room TTL sweeper
- [x] Persist device ID: finished `DeviceIdentityService`
      (`app.getPath('userData')` + `device-identity.json`, atomic write via
      tmp+rename, `XXX XXX XXX` format, stable across restarts).
      No MAC address as public identifier. Shared helpers in `shared/deviceId.ts`.
- [x] Wire renderer: enabled Connect button → sends `connection-request`
      (`src/services/SignalingService.ts` + `src/hooks/useSignalingSession.ts`);
      host shows `IncomingRequestModal` with Accept/Reject. Self-connect allowed
      locally only via `LANTERN_USER_DATA`/`LANTERN_ALLOW_MULTI_INSTANCE` for
      two-instance testing.
- [x] Validate every signaling payload (`shared/signaling.ts` parsers);
      human-readable errors for server-unavailable, invalid ID, device offline,
      rejected, timeout, self-connect, unauthorized, room-not-found,
      already-in-session, not-registered.

**Verify:** `npm run typecheck` ✅, `npm run lint` ✅ (checked 2026-09-22).
Still to do manually: `npm run server` + two app instances (see README
two-instance instructions); Client enters Host ID → Host sees
"Incoming connection from XXX" with Accept/Reject.

**Commit:** `feat: add signaling server` (pending — 16 modified + 8 new files)

---

## Phase 3 — WebRTC signaling (offer/answer/ICE)

**Goal:** Client ↔ Host exchange SDP + ICE through the server.

- [ ] Create `src/services/WebRTCService.ts` (renderer-side, no JSX logic):
      create peer connection, offer/answer, ICE handling, connection-state
      monitoring (`new→connecting→connected→disconnected→failed→closed`),
      reconnect/cleanup.
- [ ] STUN config from env (`STUN_SERVERS`), design ready for future TURN.
- [ ] Route `webrtc-offer`, `webrtc-answer`, `ice-candidate` via server rooms.
- [ ] Drive `connectionStore` through
      `idle→connecting→waiting-for-approval→approved→negotiating→connected/disconnected/failed`.
- [ ] Handle negotiation failure, ICE failure, timeouts with user-facing errors.

**Verify:** DevTools/`Logger` shows offer→answer→ICE flowing C→S→H→S→C
and peer state reaching `connected` (no media yet).

**Commit:** `feat: implement webrtc signaling`

---

## Phase 4 — Screen capture + streaming

**Goal:** one instance streams its desktop to the other over WebRTC.

- [ ] Create `ScreenCaptureService` (host side):
      enumerate displays, select display, `getDisplayMedia`/Electron
      `desktopCapturer` per installed Electron version, return `MediaStream`,
      stop, error handling (denied, unavailable).
- [ ] Host must explicitly start sharing; add IPC channels in `shared/ipc.ts`.
- [ ] Attach host tracks to peer connection; client renders remote stream.
- [ ] Multi-monitor support if practical; clear "Not supported" otherwise.

**Verify:** Host clicks Share → Client sees live host desktop.

**Commit:** `feat: implement screen capture`

---

## Phase 5 — RemoteDesktopViewer UI

**Goal:** professional viewer for the remote stream.

- [ ] Create `RemoteDesktopViewer`: aspect-ratio-preserving video, fit/actual-size,
      fullscreen, connection state + FPS/status overlay.
- [ ] Create `ConnectionToolbar`: Fullscreen, Fit, Actual Size, Disconnect
      (stubs for Quality, Monitor selection, Clipboard, File transfer).
- [ ] Create `ConnectionRequestModal` (Accept/Reject) + `ScreenSelector`.
- [ ] Keep components presentational; logic in services/hooks/stores.

**Verify:** connect → viewer shows stream with working toolbar actions.

**Commit:** `feat: add remote desktop viewer`

---

## Phase 6 — Remote mouse control

**Goal:** client mouse drives host cursor via `remote-input` DataChannel.

- [ ] Capture on client: mousemove, mousedown, mouseup, click,
      double-click, wheel. Send **normalized** (0.0–1.0) coordinates, never raw pixels.
- [ ] Create `RemoteInputService` + platform adapters
      (`LinuxInputAdapter`, `WindowsInputAdapter`, `MacOSInputAdapter`)
      behind a common interface. Prioritize Linux.
- [ ] Host converts normalized → display coordinates; validates every message
      against a typed schema (`shared/` message types).
- [ ] Clear "remote input unavailable" state where unsupported.
      No privileged OS input libraries until data flow is proven.

**Verify:** moving/clicking in viewer moves/clicks on host (same- or dual-machine).

**Commit:** `feat: add remote mouse control`

---

## Phase 7 — Remote keyboard control

**Goal:** client keystrokes reach host via DataChannel.

- [ ] Send structured `{ type: 'keyboard', event: 'keydown'|'keyup', key, code }`.
- [ ] Host processes only whitelisted event types; never executes arbitrary input.
- [ ] Handle focus/blur edge cases (stuck keys on disconnect), keyup flush.

**Verify:** typing in focused viewer types on host; no stuck keys after disconnect.

**Commit:** `feat: add remote keyboard control`

---

## Phase 8 — Connection approval + temporary tokens

**Goal:** device ID + expiring token + host approval required for every session.

- [ ] Token service: `crypto.randomInt` (never `Math.random`), e.g. 6-char code,
      short expiry, single-use, revocable on disconnect.
- [ ] Client must present token with `connection-request`; host validates
      before showing Accept/Reject.
- [ ] Host can regenerate/cancel token; UI shows expiry state.
- [ ] Document model in `SECURITY.md`.

**Verify:** connect without/with wrong/expired token fails; correct token +
Accept connects; token expires as configured.

**Commit:** `feat: add connection authentication`

---

## Phase 9 — Clipboard synchronization (text-only, opt-in)

**Goal:** optional bidirectional text clipboard over `clipboard` DataChannel.

- [ ] Setting `Enable clipboard synchronization`, default **false**.
- [ ] Text-only both directions; validate + size-limit messages.
- [ ] Never log clipboard contents.

**Verify:** with setting ON, copy on client pastes on host and vice versa;
with OFF, nothing syncs.

**Commit:** `feat: add clipboard synchronization`

---

## Phase 10 — Settings, logging, diagnostics, history

**Goal:** production-grade observability + local history.

- [ ] Finish `Logger`: console in dev, rotating local log files in prod.
- [ ] Diagnostics panel: signaling/ICE/WebRTC states, disconnect reasons.
- [ ] Recent-connections history (local only).
- [ ] Settings: signaling URL, STUN servers, clipboard toggle.

**Verify:** logs rotate on disk; diagnostics reflect live states; history persists.

**Commit:** `feat: add settings logging and diagnostics`

---

## Phase 11 — Automated tests

**Goal:** unit coverage for logic that must not regress.

- [ ] Device ID generation/formatting/persistence (mocked storage).
- [ ] Token generation (mock `randomInt`), expiry logic.
- [ ] Remote message validation (valid + malformed inputs).
- [ ] Connection state transitions.
- [ ] Signaling message routing (mocked sockets).
- [ ] Normalized mouse-coordinate conversion.
- [ ] Cleanup logic (rooms, peer connections, listeners).
- [ ] Mocks/adapters for platform input; **no real OS mouse movement in tests.**

**Verify:** `npm test` (or chosen runner) green; typecheck + lint green.

**Commit:** `test: add core application tests`

---

## Phase 12 — Polish + documentation

**Goal:** publishable portfolio project.

- [ ] UI polish: consistent dark theme, empty/error states, no excessive animation.
- [ ] README: full architecture, process model, WebRTC/signaling design,
      setup, builds, security summary, limitations, roadmap, Mermaid diagrams.
- [ ] `SECURITY.md` final review; `.env.example` complete.
- [ ] File-transfer **types/interfaces only** (chunking, progress,
      cancellation, integrity) for a future `file-transfer` DataChannel —
      no implementation until core is stable.
- [ ] Final `typecheck` + `lint` + `package`/`make` smoke test.

**Verify:** clean install → `npm run start` works; `npm run package` succeeds.

**Commit:** `docs: add architecture and security documentation`

---

## Global constraints (all phases)

No stealth access, persistence, permission bypass, security-software tampering,
credential theft, out-of-session keylogging, covert monitoring, silent install,
or unauthorized access. Every session needs explicit host consent.
