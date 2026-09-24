import {
  KEYBOARD_CODE_WHITELIST,
  MAX_KEY_LENGTH,
  normalizePoint,
  parseRemoteInputMessage,
  serializeRemoteInputMessage,
  type FrameSize,
  type RemoteInputMessage,
  type RemoteInputMouseButton,
  type RemoteInputRequest,
} from '../../shared/remoteInput.js';
import { webrtcService } from './WebRTCService.js';
import { getRemoteInputStatus, sendRemoteInput } from './lanternBridge.js';

/** Max mouse-move frames per second — the channel is not a firehose. */
export const MOVE_THROTTLE_MS = 33;

/** Approx line/page wheel units in pixels (backend-specific anyway). */
const LINE_IN_PIXELS = 16;
const PAGE_IN_PIXELS = 800;

function toButton(button: number): RemoteInputMouseButton | null {
  if (button === 0) return 'left';
  if (button === 1) return 'middle';
  if (button === 2) return 'right';
  return null;
}

function toPixels(delta: number, mode: number): number {
  if (mode === 1) return delta * LINE_IN_PIXELS;
  if (mode === 2) return delta * PAGE_IN_PIXELS;
  return delta;
}

/**
 * Renderer-side remote input: client capture AND host forwarding.
 *
 * Client: pointer events over the remote video become normalized messages
 * on the `remote-input` channel. Moves are throttled with trailing-latest
 * semantics; down/up/wheel send immediately; right-click menu is suppressed
 * while control is active so right button reaches the host. Keyboard is
 * captured only while the video element has focus (click it first) —
 * page-level capture would hijack browser shortcuts.
 *
 * Host: validated inbound frames are forwarded to main with the shared
 * display size; main denormalizes and dispatches to the OS adapter.
 */
class RendererRemoteInputService {
  /** Codes currently held down — flushed as keyups on blur/detach. */
  private readonly heldKeys = new Set<string>();

  send(message: RemoteInputMessage): boolean {
    return webrtcService.sendRemoteInput(serializeRemoteInputMessage(message));
  }

  /**
   * Attach capture listeners; returns detach. Detach (and window blur)
   * flush keyups for every held key so the host can never stick a key.
   * Caller gates on role/status — this service owns events and framing only.
   */
  attachCapture(video: HTMLVideoElement): () => void {
    let lastMoveAt = 0;
    let trailingTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingMove: { x: number; y: number } | null = null;

    const framePoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const rect = video.getBoundingClientRect();
      const element: FrameSize = { width: rect.width, height: rect.height };
      const frame: FrameSize = { width: video.videoWidth, height: video.videoHeight };
      return normalizePoint(element, frame, clientX - rect.left, clientY - rect.top);
    };

    const flushMove = (): void => {
      trailingTimer = null;
      if (!pendingMove) return;
      const point = pendingMove;
      pendingMove = null;
      lastMoveAt = Date.now();
      this.send({ kind: 'mouse-move', x: point.x, y: point.y });
    };

    const onMouseMove = (event: MouseEvent): void => {
      const point = framePoint(event.clientX, event.clientY);
      if (!point) return;
      pendingMove = point;
      const now = Date.now();
      if (now - lastMoveAt >= MOVE_THROTTLE_MS) {
        if (trailingTimer) {
          clearTimeout(trailingTimer);
          trailingTimer = null;
        }
        flushMove();
      } else if (!trailingTimer) {
        trailingTimer = setTimeout(flushMove, MOVE_THROTTLE_MS - (now - lastMoveAt));
      }
    };

    const buttonAt = (
      event: MouseEvent,
      buttonEvent: 'down' | 'up',
    ): { message: RemoteInputMessage } | null => {
      const button = toButton(event.button);
      const point = framePoint(event.clientX, event.clientY);
      if (!button || !point) return null;
      return { message: { kind: 'mouse-button', event: buttonEvent, button, ...point } };
    };

    const onMouseDown = (event: MouseEvent): void => {
      const result = buttonAt(event, 'down');
      if (result) this.send(result.message);
    };

    const onMouseUp = (event: MouseEvent): void => {
      const result = buttonAt(event, 'up');
      if (result) this.send(result.message);
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const point = framePoint(event.clientX, event.clientY);
      if (!point) return;
      this.send({
        kind: 'mouse-wheel',
        deltaX: toPixels(event.deltaX, event.deltaMode),
        deltaY: toPixels(event.deltaY, event.deltaMode),
        ...point,
      });
    };

    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
    };

    const keyMessage = (
      event: KeyboardEvent,
      keyEvent: 'keydown' | 'keyup',
    ): RemoteInputMessage | null => {
      // Whitelist first: unlisted codes (and `Unidentified`) never leave.
      if (!KEYBOARD_CODE_WHITELIST.has(event.code)) return null;
      const key = event.key.length > 0 ? event.key.slice(0, MAX_KEY_LENGTH) : event.code;
      return { kind: 'keyboard', event: keyEvent, key, code: event.code };
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      const message = keyMessage(event, 'keydown');
      if (!message) return;
      // Stop local side effects (scroll on Space/arrows, focus move on Tab).
      // Browser-reserved chords (Ctrl+W etc.) still act locally — documented.
      event.preventDefault();
      // Auto-repeat forwards like a physical hold; the host sees repeats.
      if (this.send(message)) {
        this.heldKeys.add(event.code);
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      const message = keyMessage(event, 'keyup');
      this.heldKeys.delete(event.code);
      if (!message) return;
      event.preventDefault();
      this.send(message);
    };

    const flushHeldKeys = (): void => {
      if (this.heldKeys.size === 0) return;
      for (const code of this.heldKeys) {
        this.send({ kind: 'keyboard', event: 'keyup', key: code, code });
      }
      this.heldKeys.clear();
    };

    const onBlur = (): void => {
      flushHeldKeys();
    };

    video.addEventListener('mousemove', onMouseMove);
    video.addEventListener('mousedown', onMouseDown);
    video.addEventListener('mouseup', onMouseUp);
    video.addEventListener('wheel', onWheel, { passive: false });
    video.addEventListener('contextmenu', onContextMenu);
    video.addEventListener('keydown', onKeyDown);
    video.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      if (trailingTimer) clearTimeout(trailingTimer);
      flushHeldKeys();
      video.removeEventListener('mousemove', onMouseMove);
      video.removeEventListener('mousedown', onMouseDown);
      video.removeEventListener('mouseup', onMouseUp);
      video.removeEventListener('wheel', onWheel);
      video.removeEventListener('contextmenu', onContextMenu);
      video.removeEventListener('keydown', onKeyDown);
      video.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  /**
   * Host path: validate an inbound frame and forward it to main with the
   * shared display size. Returns the parsed message for diagnostics, or null
   * when the frame is invalid / no display is shared.
   */
  forwardToHost(data: string, display: FrameSize | null): RemoteInputMessage | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
    const message = parseRemoteInputMessage(parsed);
    if (!message || !display) return null;
    const request: RemoteInputRequest = {
      message,
      displayWidth: Math.round(display.width),
      displayHeight: Math.round(display.height),
    };
    sendRemoteInput(request);
    return message;
  }

  inputStatus(): ReturnType<typeof getRemoteInputStatus> {
    return getRemoteInputStatus();
  }
}

export const remoteInputService = new RendererRemoteInputService();
