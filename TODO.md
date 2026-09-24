# TODO.md — Build Phases for Lantern Remote

Phase 1 (scaffold) is **done and pushed** (`feat: initialize electron forge vite application`).
Phase 2 (signaling) is **implemented in the working tree, not yet committed**.
Implement phases in order; do not skip ahead.
After each phase follow the Phase workflow in `AGENTS.md`, then stop and wait.

---

## Phase 2 — Signaling server + device registration — DONE

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

## Phase 3 — WebRTC signaling (offer/answer/ICE) — DONE

**Goal:** Client ↔ Host exchange SDP + ICE through the server.

- [x] Created `src/services/WebRTCService.ts` (renderer-side, no JSX logic):
      peer connection, offer/answer, ICE trickle, `control` DataChannel
      (offerer creates, answerer receives via `ondatachannel`), state
      monitoring (`new→connecting→connected→disconnected→failed→closed`),
      idempotent cleanup. No media tracks yet (Phase 4).
- [x] STUN config from env (`VITE_STUN_SERVERS`, default Google STUN);
      `buildIceServers()` shaped so TURN entries append later without changes.
- [x] Routed `webrtc-offer`, `webrtc-answer`, `ice-candidate` via server rooms
      (`server/socket/handlers.ts`): registered-only, accepted-rooms-only,
      direction enforced (offers client→host, answers host→client, ICE either
      member), peer sockets resolved via registry, SDP (32 KB) and candidate
      (4 KB) length caps. Renderer re-validates relayed payloads.
- [x] `connectionStore` drives
      `idle→connecting→waiting-for-approval→approved→negotiating→connected/disconnected/failed`
      plus `role` (`client`|`host`) and live `rtcState`/`iceState` shown in
      `ConnectionStatus`. Roles checked on every inbound offer/answer/ICE.
- [x] Negotiation failure, ICE failure, and 20 s negotiation timeout tear the
      session down and surface human errors (`NEGOTIATION_TIMEOUT`,
      `ICE_FAILED`); stale ICE candidates after teardown are ignored.

**Verify:** `typecheck` ✅, `lint` ✅, throwaway tsx routing test 18/18 ✅
(offer/answer/ICE relay intact both ways, `null` ICE fields preserved,
outsider + wrong-direction + oversized-SDP rejected, peer notified on leave;
script deleted after run), app boot clean ✅ (window ready, no IPC errors).
NOT verified headless: live `RTCPeerConnection` reaching `connected` between
two real instances (no `wrtc` in tree) — do the manual two-instance run below.

**Manual test:** `npm run server` + two instances (AGENTS.md recipe); client
enters host ID → host Accepts → client offer→host answer→ICE flows and both
Session cards show `connected` with matching `rtcState`/`iceState`.

**Commit:** `feat: implement webrtc signaling` (pending)

---

## Phase 4 — Screen capture + streaming — DONE

**Goal:** one instance streams its desktop to the other over WebRTC.

- [x] Created `ScreenCaptureService` (`src/services/`) + `DesktopSourcesService`
      (`electron/services/`, Electron 44 `desktopCapturer`): enumerate displays
      with thumbnail previews, `getUserMedia` capture by source id, stop,
      mapped errors (denied / unavailable / unsupported). Audio off (video-only).
- [x] Host shares only via explicit Start sharing (`ScreenShareControls` +
      `useScreenShare`); added `GET_DESKTOP_SOURCES` IPC in `shared/ipc.ts`
      with preload/main/renderer in sync. No auto-share on connect.
- [x] Host tracks attach via `WebRTCService.addLocalStream`; client re-offers
      over the existing connection after a `video-tracks-added` control frame
      (no server changes — client→host offers were already routable); host
      answers with tracks, client renders in `RemoteVideo` (Phase 5 builds the
      full viewer). `video-tracks-ended` clears the viewer; every teardown path
      stops capture tracks so a dead session never keeps sharing.
- [x] Multi-monitor: source picker lists all `screen` sources with thumbnails.
      Unsupported environments get a clear message instead of silent failure.

**Verify:** `typecheck` ✅, `lint` ✅, control-message parser 6/6 ✅
(round-trip both kinds; garbage/unknown-kind/binary/null rejected), app boot
clean ✅ (fresh profile, no IPC errors).
NOT verified headless: live pixels from host to client (needs two GUIs +
display capture) — do the manual run below.

**Manual test:** `npm run server` + two instances (AGENTS.md recipe). Client
connects → host Accepts → both `connected` → host picks a display → Start
sharing → client `Remote Screen` card shows the live host desktop. Stop
sharing → client viewer clears. Disconnect → capture tracks stop.

**Commit:** `feat: implement screen capture`

---

## Phase 5 — RemoteDesktopViewer UI — DONE

**Goal:** professional viewer for the remote stream.

- [x] Created `RemoteDesktopViewer`: aspect-ratio box from intrinsic video size,
      fit/1:1 scaling (1:1 scrolls), container fullscreen with `fullscreenchange`
      sync (Esc never desyncs store state), FPS via `requestVideoFrameCallback`
      (rAF fallback, handle cancelled on cleanup) + resolution overlay.
      Stream attached imperatively via ref (React has no `srcObject` prop —
      no casts); old `RemoteVideo` placeholder deleted.
- [x] Created `ConnectionToolbar` (own module): Fit, 1:1, Fullscreen,
      Disconnect. Quality / Monitor / Clipboard / Files render as inert
      labeled stubs — visible roadmap, never pretending to work.
- [x] Accept/Reject modal (`IncomingRequestModal`, Phase 2) and source picker
      (inside `ScreenShareControls`, Phase 4) already existed — no duplicates
      created.
- [x] Components presentational; fullscreen flag is the only new store field.

**Verify:** `typecheck` ✅, `lint` ✅, app boot clean ✅ (fresh profile).
NOT verified headless: real pixels + toolbar interaction need two live
instances — same manual run as Phase 4, now checking Fit/1:1/Fullscreen/FPS.

**Commit:** `feat: add remote desktop viewer`

---

## Phase 6 — Remote mouse control — DONE

**Goal:** client mouse drives host cursor via `remote-input` DataChannel.

- [x] Capture on client (`RemoteInputService.attachCapture`, wired in viewer
      only for client role + connected): mousemove (33 ms throttle, trailing
      latest), mousedown/up, wheel (deltaMode→pixel approx). Sends
      **normalized** (0.0–1.0) frame coords with contain-letterboxing excluded
      (outside-frame events dropped); right-click menu suppressed while
      attached. `click`/`double-click` accepted by the protocol but the client
      sends down/up pairs only — a physical click must never apply twice.
- [x] Created renderer `RemoteInputService` + main `RemoteInputService`
      dispatcher + `RemoteInputAdapter` interface with `LinuxInputAdapter`,
      `WindowsInputAdapter`, `MacOSInputAdapter` stubs (Linux prioritized in
      structure; all report unsupported with a reason — no fake backends).
- [x] Host validates twice (channel frame via shared parser, IPC request via
      shared parser in main), denormalizes against the true shared-display
      size, dispatches per kind. Fire-and-forget `lantern:remote-input` IPC
      (no ack at tens of Hz) + `get-remote-input-status` query channel.
- [x] Honest unavailable state: host Session card shows "Remote input:
      unavailable — reason" while sharing; client viewer shows INPUT chip when
      sending; host shows last-received-input readout proving data flow.
      No privileged OS input libraries — architecture and flow first.

**Verify:** `typecheck` ✅, `lint` ✅ (incl. fixing a real rules-of-hooks
violation the linter caught), protocol/coordinate checks 17/17 ✅
(validation, letterbox math, denormalization, request parsing, evil
dimensions rejected), app boot clean ✅.
NOT verified headless: cursor actually moving (needs OS backend, pending)
and two-live-instance flow — manual run: connect → share → move/click/wheel
in client viewer → host Session card shows Last input updating; host cursor
correctly does NOT move yet.

**Commit:** `feat: add remote mouse control`

**Follow-up (uncommitted):** `LinuxInputAdapter` now drives a real cursor via
xdotool (X11): argv-only `execFile` (no shell), serial queue, per-command
timeout, button mapping 1/2/3, wheel via buttons 4–7, injected-runner seam
for unit tests. Verified with fake-runner checks (command strings, ordering,
failure isolation).
`MacOSInputAdapter` via cliclick (`brew install cliclick`): `m`/`dd`/`du`/
`c`/`dc`/`rc` mapped (drag works as dd…m…du); middle, right press/release,
and wheel have no cliclick equivalent and reject explicitly; Accessibility
denial detected via stderr and surfaced. Verified with a fake on-PATH binary
through the real exec path.
Still open: live cursor tests on real hardware, ydotool backend for Wayland,
Windows backend (nut.js vs PowerShell helper decision).

---

## Phase 7 — Remote keyboard control — DONE

**Goal:** client keystrokes reach host via DataChannel.

- [x] Structured `{ kind: 'keyboard', event: 'keydown'|'keyup', key, code }`
      (`kind`, not `type`, per the established protocol envelope). `code` is
      authoritative for mapping; `key` informational, length-capped.
- [x] Host processes only whitelisted `code` values (~140-entry set: letters,
      digits, numpad, F1–F24, modifiers, arrows, navigation, punctuation,
      media). `Unidentified` and anything unlisted is rejected at the shared
      parser — main re-validates before dispatch. xdotool keysym table;
      cliclick modifiers (`kd`/`ku`) + listed `kp` keys, atomic-press keyup
      no-op documented; unmapped codes reject explicitly on both.
- [x] Focus/blur safety: capture only while the video element is focused
      (tabIndex + KEYS chip + focus ring); client tracks held codes and
      flushes keyups on window blur and on detach (disconnect path included),
      so no stuck keys. Auto-repeat forwards as physical hold. No arbitrary
      JS crosses the channel — parsed messages only.

**Verify:** `typecheck` ✅, `lint` ✅, validator 7/7 ✅, xdotool keymap 8/8 ✅
(incl. unmapped rejection), cliclick keys 2/2 ✅, boot clean ✅. No live
key presses executed by tests (would type on this box).
NOT verified headless: real typing host↔client — manual run: connect →
share → click video (KEYS chip) → type → host app receives; Alt+Tab away →
no stuck keys.

**Commit:** `feat: add remote keyboard control`

---

## Phase 8 — Connection approval + temporary tokens — DONE

**Goal:** device ID + expiring token + host approval required for every session.

- [x] `ConnectionTokenService` (main, in-memory only): 6-char codes from an
      unambiguous alphabet via `crypto.randomInt` (never `Math.random`),
      10-minute TTL, single-use (burned on accept), revoked on teardown,
      constant-time compare, injectable clock for tests. Never persisted.
- [x] Client presents code with `connection-request` (format-checked locally,
      shape-checked by server); host validates **before** any modal — wrong
      codes auto-reject with `invalid-token` (relayed reason, new error
      message) and increment a visible blocked-attempts counter. Server never
      holds a live code (documented harvest bound in SECURITY.md).
- [x] Host card: Generate / New code / Revoke, live countdown, expiry
      auto-clears; client field normalizes typing (uppercase, alphabet-only).
- [x] Model documented in `SECURITY.md` (out-of-band carry, burn-on-accept,
      server-harvest bound, production registration follow-up).

**Verify:** `typecheck` ✅, `lint` ✅, format/service/parser checks 22/22 ✅
(lifecycle incl. expiry rotation + consume, reject-reason defaults), token
routing 8/8 ✅ (missing/malformed rejected, opaque passthrough, reason
relayed, bogus reason rejected), boot clean ✅.
NOT verified headless: full human flow — manual run: host Generate → client
types ID + wrong code → blocked count rises, no modal; right code → modal →
Accept → code burned (Generate needed for next session); wait 10 min →
expired rejects.

**Commit:** `feat: add connection authentication`

---

## Phase 9 — Clipboard synchronization (text-only, opt-in) — DONE

**Goal:** optional bidirectional text clipboard over `clipboard` DataChannel.

- [x] Setting `Enable clipboard synchronization`, default **false**
      (`settingsStore`, pre-existing skeleton now live).
- [x] `shared/clipboard.ts`: `clipboard-text` frames, 256 KiB cap, empty
      rejected (image copies can't wipe the peer), oversize rejected.
- [x] `clipboard` DataChannel on the same peer connection (offerer creates,
      answerer routes by label, text frames only, same drop-if-closed
      contract as control/input).
- [x] Main `ClipboardService` (Electron 44 async clipboard) + 2 IPC channels;
      reads truncated to MAX+1, writes re-validated, lengths-only logging.
- [x] Renderer `ClipboardService`: 1s poll while connected + enabled, seed
      baseline on start (no replay), echo suppression, per-session counters.
- [x] UI: Settings shows live state + sent/received counts; toolbar Clipboard
      entry reflects real sync state instead of a stub.
- [x] Model documented in `SECURITY.md`.

**Verify:** `typecheck` ✅, `lint` ✅, Prettier ✅, protocol checks 7/7 ✅,
echo/suppression checks 9/9 ✅ (seed silence, send-once, no-resend, apply,
no-echo, malformed/oversize/duplicate ignored, stopped inert), oversize
local 1/1 ✅, boot clean ✅.
NOT verified headless: real OS clipboards host↔client — manual run with two
instances: setting ON both, copy on client → paste on host and vice versa;
setting OFF either side → nothing syncs; copy image → peer text untouched.

**Commit:** `feat: add clipboard synchronization`

---

## Phase 10 — Settings, logging, diagnostics, history — DONE

**Goal:** production-grade observability + local history.

- [x] Finish `Logger`: console in dev, rotating local log files in prod.
- [x] Diagnostics panel: signaling/ICE/WebRTC states, disconnect reasons.
- [x] Recent-connections history (local only).
- [x] Settings: signaling URL, STUN servers, clipboard toggle.

**Verify:** `typecheck` ✅, `lint` ✅, app boot clean ✅. Logger supports rotating file
transport in prod (5 MB per file, 3 rotated files). Diagnostics panel shows live
connection states. History persists to localStorage (20 entries max). Settings
persist across restarts.

**Commit:** `feat: add settings logging and diagnostics` (pending)

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
