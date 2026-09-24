import { execFile, execFileSync } from 'node:child_process';
import type { RemoteInputMouseButton } from '../../../shared/remoteInput.js';
import type { InputButtonEvent, RemoteInputAdapter } from './RemoteInputAdapter.js';

/** Injectable process runner — the seam Phase 11 unit tests fake. */
export type CommandRunner = (args: string[]) => Promise<void>;

const CLICLICK = 'cliclick';
const COMMAND_TIMEOUT_MS = 5_000;

function defaultRunner(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // execFile with an argv array — never a shell string — so validated
    // integer coords cannot become command injection.
    execFile(CLICLICK, args, { timeout: COMMAND_TIMEOUT_MS }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(describeFailure(stderr?.toString().trim() ?? '')));
        return;
      }
      resolve();
    });
  });
}

function describeFailure(stderr: string): string {
  // Since 5.1 cliclick warns on stderr when Accessibility permission is missing.
  if (/trusted|accessibility|permission/i.test(stderr)) {
    return 'cliclick was denied: grant Accessibility permission to Lantern Remote (System Settings → Privacy & Security → Accessibility), then try again.';
  }
  return stderr ? `cliclick failed: ${stderr}` : 'cliclick failed.';
}

function binaryPresent(): boolean {
  try {
    execFileSync('which', [CLICLICK], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function point(x: number, y: number): string {
  return `${Math.round(x)},${Math.round(y)}`;
}

/** Modifier codes → cliclick `kd`/`ku` names (the only true hold/release). */
const MODIFIERS: ReadonlyMap<string, string> = new Map([
  ['ShiftLeft', 'shift'],
  ['ShiftRight', 'shift'],
  ['ControlLeft', 'ctrl'],
  ['ControlRight', 'ctrl'],
  ['AltLeft', 'alt'],
  ['AltRight', 'alt'],
  ['MetaLeft', 'cmd'],
  ['MetaRight', 'cmd'],
]);

/**
 * `KeyboardEvent.code` → cliclick `kp` names. kp presses are atomic
 * (down+up at once), so keyup for these is a no-op by design. Codes outside
 * this table (letters, digits, punctuation, F17+, …) have no cliclick
 * equivalent and reject explicitly — text entry needs a follow-up backend.
 */
function buildPressableKeys(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (let i = 1; i <= 16; i += 1) map.set(`F${i}`, `f${i}`);
  for (let i = 0; i <= 9; i += 1) map.set(`Numpad${i}`, `num-${i}`);
  const named: Array<[string, string]> = [
    ['ArrowDown', 'arrow-down'],
    ['ArrowLeft', 'arrow-left'],
    ['ArrowRight', 'arrow-right'],
    ['ArrowUp', 'arrow-up'],
    ['AudioVolumeDown', 'volume-down'],
    ['AudioVolumeMute', 'mute'],
    ['AudioVolumeUp', 'volume-up'],
    ['Backspace', 'delete'],
    ['Delete', 'fwd-delete'],
    ['End', 'end'],
    ['Enter', 'return'],
    ['Escape', 'esc'],
    ['Home', 'home'],
    ['MediaPlayPause', 'play-pause'],
    ['MediaTrackNext', 'play-next'],
    ['MediaTrackPrevious', 'play-previous'],
    ['NumpadAdd', 'num-plus'],
    ['NumpadDivide', 'num-divide'],
    ['NumpadEnter', 'num-enter'],
    ['NumpadMultiply', 'num-multiply'],
    ['NumpadSubtract', 'num-minus'],
    ['PageDown', 'page-down'],
    ['PageUp', 'page-up'],
    ['Space', 'space'],
    ['Tab', 'tab'],
  ];
  for (const [code, name] of named) map.set(code, name);
  return map;
}

const PRESSABLE_KEYS: ReadonlyMap<string, string> = buildPressableKeys();

/**
 * macOS input sink via cliclick (`brew install cliclick`).
 *
 * WHY cliclick: same zero-native-module philosophy as xdotool on Linux —
 * an external binary driven over argv. Coverage is partial by tool design:
 * move, left press/release/click/double-click, and right-click map cleanly;
 * right press/release, middle button, and wheel have no cliclick equivalent
 * and reject per call with an explicit reason instead of silently dropping.
 * Drag works naturally: down…move…up becomes dd…m…du.
 */
export class MacOSInputAdapter implements RemoteInputAdapter {
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
        reason: 'cliclick is not installed (brew install cliclick). Remote input stays unavailable.',
      };
    }
    return { supported: true, reason: null };
  }

  moveMouse(x: number, y: number): Promise<void> {
    return this.enqueue([`m:${point(x, y)}`]);
  }

  mouseButton(
    button: RemoteInputMouseButton,
    event: InputButtonEvent,
    x: number,
    y: number,
  ): Promise<void> {
    if (button === 'middle') {
      return Promise.reject(new Error('cliclick has no middle-button command.'));
    }
    if (button === 'right') {
      // No right press/release exists; a full right-click is the only mapping.
      if (event === 'down' || event === 'up') {
        return Promise.reject(
          new Error('cliclick has no right-button press/release (right-click only).'),
        );
      }
      return this.enqueue([`rc:${point(x, y)}`]);
    }
    if (event === 'down') return this.enqueue([`dd:${point(x, y)}`]);
    if (event === 'up') return this.enqueue([`du:${point(x, y)}`]);
    if (event === 'double-click') return this.enqueue([`dc:${point(x, y)}`]);
    return this.enqueue([`c:${point(x, y)}`]);
  }

  mouseWheel(_deltaX: number, _deltaY: number, _x: number, _y: number): Promise<void> {
    return Promise.reject(new Error('cliclick has no scroll-wheel command.'));
  }

  keyDown(code: string): Promise<void> {
    const modifier = MODIFIERS.get(code);
    if (modifier) return this.enqueue([`kd:${modifier}`]);
    const key = PRESSABLE_KEYS.get(code);
    if (!key) {
      return Promise.reject(new Error(`cliclick has no key mapping for ${code}.`));
    }
    return this.enqueue([`kp:${key}`]);
  }

  keyUp(code: string): Promise<void> {
    const modifier = MODIFIERS.get(code);
    if (modifier) return this.enqueue([`ku:${modifier}`]);
    if (!PRESSABLE_KEYS.get(code)) {
      return Promise.reject(new Error(`cliclick has no key mapping for ${code}.`));
    }
    // kp presses complete atomically at keydown — nothing is held, so the
    // keyup is a deliberate no-op rather than a second press.
    return Promise.resolve();
  }

  private enqueue(args: string[]): Promise<void> {
    if (!this.hasBinary) {
      return Promise.reject(new Error(this.status().reason ?? 'cliclick unavailable.'));
    }
    const run = this.queue.then(() => this.run(args));
    // A failure must reject its caller but never break the chain behind it.
    this.queue = run.catch(() => undefined).then(() => undefined);
    return run;
  }
}
