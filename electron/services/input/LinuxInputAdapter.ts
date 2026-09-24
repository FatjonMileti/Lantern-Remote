import { execFile, execFileSync } from 'node:child_process';
import type { RemoteInputMouseButton } from '../../../shared/remoteInput.js';
import type { InputButtonEvent, RemoteInputAdapter } from './RemoteInputAdapter.js';

/** Injectable process runner — the seam Phase 11 unit tests fake. */
export type CommandRunner = (args: string[]) => Promise<void>;

const XDOTOOL = 'xdotool';
const COMMAND_TIMEOUT_MS = 5_000;
/** One wheel notch ≈ one button-4/5 press; browser deltas come in ~100s. */
const WHEEL_NOTCH_PX = 100;
const MAX_WHEEL_NOTCHES = 20;

function buttonNumber(button: RemoteInputMouseButton): number {
  if (button === 'middle') return 2;
  if (button === 'right') return 3;
  return 1;
}

/**
 * `KeyboardEvent.code` → xdotool keysym. Covers the shared whitelist;
 * anything unmapped rejects explicitly (whitelist and map evolve together).
 */
function buildKeymap(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < 26; i += 1) {
    const letter = String.fromCharCode(97 + i);
    map.set(`Key${letter.toUpperCase()}`, letter);
  }
  for (let i = 0; i <= 9; i += 1) {
    map.set(`Digit${i}`, String(i));
    map.set(`Numpad${i}`, `KP_${i}`);
  }
  for (let i = 1; i <= 24; i += 1) map.set(`F${i}`, `F${i}`);
  const named: Array<[string, string]> = [
    ['AltLeft', 'Alt_L'],
    ['AltRight', 'Alt_R'],
    ['ArrowDown', 'Down'],
    ['ArrowLeft', 'Left'],
    ['ArrowRight', 'Right'],
    ['ArrowUp', 'Up'],
    ['AudioVolumeDown', 'XF86AudioLowerVolume'],
    ['AudioVolumeMute', 'XF86AudioMute'],
    ['AudioVolumeUp', 'XF86AudioRaiseVolume'],
    ['Backquote', 'grave'],
    ['Backslash', 'backslash'],
    ['Backspace', 'BackSpace'],
    ['BracketLeft', 'bracketleft'],
    ['BracketRight', 'bracketright'],
    ['CapsLock', 'Caps_Lock'],
    ['Comma', 'comma'],
    ['ContextMenu', 'Menu'],
    ['ControlLeft', 'Control_L'],
    ['ControlRight', 'Control_R'],
    ['Delete', 'Delete'],
    ['End', 'End'],
    ['Enter', 'Return'],
    ['Equal', 'equal'],
    ['Escape', 'Escape'],
    ['Home', 'Home'],
    ['Insert', 'Insert'],
    ['IntlBackslash', 'backslash'],
    ['MediaPlayPause', 'XF86AudioPlay'],
    ['MediaStop', 'XF86AudioStop'],
    ['MediaTrackNext', 'XF86AudioNext'],
    ['MediaTrackPrevious', 'XF86AudioPrev'],
    ['MetaLeft', 'Super_L'],
    ['MetaRight', 'Super_R'],
    ['Minus', 'minus'],
    ['NumLock', 'Num_Lock'],
    ['NumpadAdd', 'KP_Add'],
    ['NumpadDecimal', 'KP_Decimal'],
    ['NumpadDivide', 'KP_Divide'],
    ['NumpadEnter', 'KP_Enter'],
    ['NumpadMultiply', 'KP_Multiply'],
    ['NumpadSubtract', 'KP_Subtract'],
    ['PageDown', 'Page_Down'],
    ['PageUp', 'Page_Up'],
    ['Pause', 'Pause'],
    ['Period', 'period'],
    ['PrintScreen', 'Print'],
    ['Quote', 'apostrophe'],
    ['ScrollLock', 'Scroll_Lock'],
    ['Semicolon', 'semicolon'],
    ['ShiftLeft', 'Shift_L'],
    ['ShiftRight', 'Shift_R'],
    ['Slash', 'slash'],
    ['Space', 'space'],
    ['Tab', 'Tab'],
  ];
  for (const [code, keysym] of named) map.set(code, keysym);
  return map;
}

const KEYMAP: ReadonlyMap<string, string> = buildKeymap();

function wheelNotches(delta: number): number {
  const notches = Math.round(Math.abs(delta) / WHEEL_NOTCH_PX);
  return Math.min(MAX_WHEEL_NOTCHES, Math.max(1, notches));
}

function defaultRunner(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // execFile with an argv array — never a shell string — so validated
    // integer coords cannot become command injection.
    execFile(XDOTOOL, args, { timeout: COMMAND_TIMEOUT_MS }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(describeFailure(args[0], stderr?.toString().trim() ?? '')));
        return;
      }
      resolve();
    });
  });
}

function describeFailure(subcommand: string | undefined, stderr: string): string {
  if (!process.env.DISPLAY) {
    return `xdotool ${subcommand ?? ''} failed: no X display (DISPLAY is unset — Wayland sessions need ydotool instead).`;
  }
  return stderr ? `xdotool failed: ${stderr}` : 'xdotool failed.';
}

function binaryPresent(): boolean {
  try {
    execFileSync('which', [XDOTOOL], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Linux input sink via xdotool (X11 sessions).
 *
 * WHY xdotool first: zero native modules (no Electron rebuild fragility),
 * driven as an external binary over argv. Commands run through a serial
 * queue so 30 Hz mouse moves cannot overtake each other. If the binary is
 * missing the adapter reports unsupported instead of failing silently;
 * Wayland sessions are told to use ydotool (follow-up backend).
 */
export class LinuxInputAdapter implements RemoteInputAdapter {
  private readonly run: CommandRunner;
  private readonly hasBinary: boolean;
  /** Serial chain — each command starts after the previous settles. */
  private queue: Promise<void> = Promise.resolve();

  constructor(runner: CommandRunner = defaultRunner) {
    this.run = runner;
    this.hasBinary = binaryPresent();
  }

  status(): { supported: boolean; reason: string | null } {
    if (!this.hasBinary) {
      return {
        supported: false,
        reason: 'xdotool is not installed (sudo apt install xdotool). Remote input stays unavailable.',
      };
    }
    return { supported: true, reason: null };
  }

  moveMouse(x: number, y: number): Promise<void> {
    return this.enqueue(['mousemove', String(Math.round(x)), String(Math.round(y))]);
  }

  mouseButton(
    button: RemoteInputMouseButton,
    event: InputButtonEvent,
    x: number,
    y: number,
  ): Promise<void> {
    const n = buttonNumber(button);
    if (event === 'down') return this.enqueue(['mousedown', String(n)]);
    if (event === 'up') return this.enqueue(['mouseup', String(n)]);
    // click / double-click synthesize the full press sequence AT the event
    // point (bare `click` would act at the current cursor instead).
    // Clients send down/up pairs, so these only fire for explicit kinds.
    const px = String(Math.round(x));
    const py = String(Math.round(y));
    const repeats = event === 'double-click' ? 2 : 1;
    return this.enqueue([
      'mousemove',
      px,
      py,
      'click',
      '--repeat',
      String(repeats),
      '--delay',
      '40',
      String(n),
    ]);
  }

  mouseWheel(deltaX: number, deltaY: number, _x: number, _y: number): Promise<void> {
    // xdotool scrolls via button presses: 4 = up, 5 = down, 6 = left, 7 = right.
    const presses: Array<[number, number]> = [];
    if (deltaY < 0) presses.push([4, wheelNotches(deltaY)]);
    else if (deltaY > 0) presses.push([5, wheelNotches(deltaY)]);
    if (deltaX < 0) presses.push([6, wheelNotches(deltaX)]);
    else if (deltaX > 0) presses.push([7, wheelNotches(deltaX)]);
    if (presses.length === 0) return Promise.resolve();
    const args: string[] = ['click'];
    for (const [button, count] of presses) {
      args.push('--repeat', String(count), String(button));
    }
    return this.enqueue(args);
  }

  keyDown(code: string): Promise<void> {
    const keysym = KEYMAP.get(code);
    if (!keysym) {
      return Promise.reject(new Error(`xdotool has no mapping for key ${code}.`));
    }
    return this.enqueue(['keydown', keysym]);
  }

  keyUp(code: string): Promise<void> {
    const keysym = KEYMAP.get(code);
    if (!keysym) {
      return Promise.reject(new Error(`xdotool has no mapping for key ${code}.`));
    }
    return this.enqueue(['keyup', keysym]);
  }

  private enqueue(args: string[]): Promise<void> {
    if (!this.hasBinary) {
      return Promise.reject(new Error(this.status().reason ?? 'xdotool unavailable.'));
    }
    const run = this.queue.then(() => this.run(args));
    // A failure must reject its caller but never break the chain behind it.
    this.queue = run.catch(() => undefined).then(() => undefined);
    return run;
  }
}
