/**
 * Remote input protocol (mouse in Phase 6, keyboard joins in Phase 7).
 *
 * WHY shared: client, host renderer, and main-process adapters must accept
 * the same messages. Coordinates are normalized 0.0–1.0 relative to the
 * *rendered video frame* (letterboxing excluded) — never raw pixels — so a
 * client window of any size drives any host display. The host denormalizes
 * against its true shared-display size.
 */

export type RemoteInputMouseButton = 'left' | 'middle' | 'right';

export interface MouseMoveMessage {
  kind: 'mouse-move';
  x: number;
  y: number;
}

export interface MouseButtonMessage {
  kind: 'mouse-button';
  /** press/release pair. `click`/`double-click` are accepted and mapped to
   * press-release sequences by adapters; clients send down/up only so a
   * physical click is never applied twice. */
  event: 'down' | 'up' | 'click' | 'double-click';
  button: RemoteInputMouseButton;
  x: number;
  y: number;
}

export interface MouseWheelMessage {
  kind: 'mouse-wheel';
  /** Approximate pixel deltas (line/page modes converted by the sender). */
  deltaX: number;
  deltaY: number;
  x: number;
  y: number;
}

export interface KeyboardMessage {
  kind: 'keyboard';
  event: 'keydown' | 'keyup';
  /** Layout-dependent label (informational only — adapters map `code`). */
  key: string;
  /** Layout-independent code, must be whitelisted below. */
  code: string;
}

export type RemoteInputMessage =
  | MouseMoveMessage
  | MouseButtonMessage
  | MouseWheelMessage
  | KeyboardMessage;

export const MAX_WHEEL_DELTA = 1_000_000;
export const MAX_SHARED_DIMENSION = 16_384;

const BUTTONS: ReadonlySet<string> = new Set(['left', 'middle', 'right']);
const BUTTON_EVENTS: ReadonlySet<string> = new Set(['down', 'up', 'click', 'double-click']);
const KEYBOARD_EVENTS: ReadonlySet<string> = new Set(['keydown', 'keyup']);

/**
 * Whitelisted `KeyboardEvent.code` values (W3C UI Events code set, common
 * subset). The host processes ONLY these — anything else (including
 * `Unidentified`) is rejected. Adapters map `code`, never the
 * layout-dependent `key`, so QWERTZ/AZERTY senders drive the right position.
 */
function buildKeyboardCodeWhitelist(): ReadonlySet<string> {
  const codes = new Set<string>();
  for (let i = 0; i < 26; i += 1) codes.add(`Key${String.fromCharCode(65 + i)}`);
  for (let i = 0; i <= 9; i += 1) {
    codes.add(`Digit${i}`);
    codes.add(`Numpad${i}`);
  }
  for (let i = 1; i <= 24; i += 1) codes.add(`F${i}`);
  for (const code of [
    'AltLeft',
    'AltRight',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'AudioVolumeDown',
    'AudioVolumeMute',
    'AudioVolumeUp',
    'Backquote',
    'Backslash',
    'Backspace',
    'BracketLeft',
    'BracketRight',
    'CapsLock',
    'Comma',
    'ContextMenu',
    'ControlLeft',
    'ControlRight',
    'Delete',
    'End',
    'Enter',
    'Equal',
    'Escape',
    'Home',
    'Insert',
    'IntlBackslash',
    'MediaPlayPause',
    'MediaStop',
    'MediaTrackNext',
    'MediaTrackPrevious',
    'MetaLeft',
    'MetaRight',
    'Minus',
    'NumLock',
    'NumpadAdd',
    'NumpadDecimal',
    'NumpadDivide',
    'NumpadEnter',
    'NumpadMultiply',
    'NumpadSubtract',
    'PageDown',
    'PageUp',
    'Pause',
    'Period',
    'PrintScreen',
    'Quote',
    'ScrollLock',
    'Semicolon',
    'ShiftLeft',
    'ShiftRight',
    'Slash',
    'Space',
    'Tab',
  ]) {
    codes.add(code);
  }
  return codes;
}

export const KEYBOARD_CODE_WHITELIST: ReadonlySet<string> = buildKeyboardCodeWhitelist();

/** `key` is descriptive only; still bounded so frames stay small. */
export const MAX_KEY_LENGTH = 32;

function isUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isDelta(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_WHEEL_DELTA
  );
}

/** Null for anything malformed — never trust a remote frame. */
export function parseRemoteInputMessage(value: unknown): RemoteInputMessage | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind === 'mouse-move') {
    if (!isUnit(record.x) || !isUnit(record.y)) return null;
    return { kind, x: record.x, y: record.y };
  }
  if (kind === 'mouse-button') {
    if (
      typeof record.event !== 'string' ||
      !BUTTON_EVENTS.has(record.event) ||
      typeof record.button !== 'string' ||
      !BUTTONS.has(record.button) ||
      !isUnit(record.x) ||
      !isUnit(record.y)
    ) {
      return null;
    }
    return {
      kind,
      event: record.event as MouseButtonMessage['event'],
      button: record.button as RemoteInputMouseButton,
      x: record.x,
      y: record.y,
    };
  }
  if (kind === 'mouse-wheel') {
    if (!isDelta(record.deltaX) || !isDelta(record.deltaY)) return null;
    if (!isUnit(record.x) || !isUnit(record.y)) return null;
    return { kind, x: record.x, y: record.y, deltaX: record.deltaX, deltaY: record.deltaY };
  }
  if (kind === 'keyboard') {
    if (typeof record.event !== 'string' || !KEYBOARD_EVENTS.has(record.event)) return null;
    if (typeof record.key !== 'string' || record.key.length === 0) return null;
    if (record.key.length > MAX_KEY_LENGTH) return null;
    if (typeof record.code !== 'string' || !KEYBOARD_CODE_WHITELIST.has(record.code)) {
      return null;
    }
    return {
      kind,
      event: record.event as KeyboardMessage['event'],
      key: record.key,
      code: record.code,
    };
  }
  return null;
}

export function serializeRemoteInputMessage(message: RemoteInputMessage): string {
  return JSON.stringify(message);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export interface FrameSize {
  width: number;
  height: number;
}

/**
 * Map a point in element pixels to frame-normalized coords under
 * `object-fit: contain` letterboxing. Returns null outside the frame —
 * callers drop those events so menus/borders never inject input.
 */
export function normalizePoint(
  element: FrameSize,
  video: FrameSize,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } | null {
  if (element.width <= 0 || element.height <= 0 || video.width <= 0 || video.height <= 0) {
    return null;
  }
  const scale = Math.min(element.width / video.width, element.height / video.height);
  const contentWidth = video.width * scale;
  const contentHeight = video.height * scale;
  const contentLeft = (element.width - contentWidth) / 2;
  const contentTop = (element.height - contentHeight) / 2;
  const fx = offsetX - contentLeft;
  const fy = offsetY - contentTop;
  if (fx < 0 || fy < 0 || fx > contentWidth || fy > contentHeight) return null;
  return { x: clamp01(fx / contentWidth), y: clamp01(fy / contentHeight) };
}

/** Normalized coords → integer display pixels for the OS adapter. */
export function denormalizePoint(
  display: FrameSize,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: Math.round(clamp01(x) * display.width),
    y: Math.round(clamp01(y) * display.height),
  };
}

/** Wire format renderer→main: validated message plus the display it targets. */
export interface RemoteInputRequest {
  message: RemoteInputMessage;
  displayWidth: number;
  displayHeight: number;
}

/** Adapter capability report — the honest "not supported" state. */
export interface InputAdapterStatus {
  supported: boolean;
  reason: string | null;
}

function isDisplayDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_SHARED_DIMENSION
  );
}

export function parseRemoteInputRequest(value: unknown): RemoteInputRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const message = parseRemoteInputMessage(record.message);
  if (!message) return null;
  if (!isDisplayDimension(record.displayWidth) || !isDisplayDimension(record.displayHeight)) {
    return null;
  }
  return { message, displayWidth: record.displayWidth, displayHeight: record.displayHeight };
}
