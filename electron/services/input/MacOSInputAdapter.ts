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
