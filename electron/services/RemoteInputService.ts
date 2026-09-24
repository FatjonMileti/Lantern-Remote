import {
  denormalizePoint,
  parseRemoteInputRequest,
  type InputAdapterStatus,
  type RemoteInputRequest,
} from '../../shared/remoteInput.js';
import { LinuxInputAdapter } from './input/LinuxInputAdapter.js';
import { MacOSInputAdapter } from './input/MacOSInputAdapter.js';
import type { RemoteInputAdapter } from './input/RemoteInputAdapter.js';
import { WindowsInputAdapter } from './input/WindowsInputAdapter.js';

export interface DispatchResult {
  ok: boolean;
  /** Log-safe summary (message kind only — never coordinates or contents). */
  kind: string | null;
  reason: string | null;
}

/**
 * Main-process input dispatcher. Re-validates every request with the shared
 * parser (defense in depth — the renderer already validated once),
 * denormalizes against the target display, and calls the platform adapter.
 */
export class RemoteInputService {
  private readonly adapter: RemoteInputAdapter;

  constructor(platform: NodeJS.Platform = process.platform) {
    if (platform === 'win32') {
      this.adapter = new WindowsInputAdapter();
    } else if (platform === 'darwin') {
      this.adapter = new MacOSInputAdapter();
    } else {
      this.adapter = new LinuxInputAdapter();
    }
  }

  status(): InputAdapterStatus {
    return this.adapter.status();
  }

  async dispatch(raw: unknown): Promise<DispatchResult> {
    const request: RemoteInputRequest | null = parseRemoteInputRequest(raw);
    if (!request) {
      return { ok: false, kind: null, reason: 'Malformed remote input request.' };
    }
    const { message } = request;
    const display = { width: request.displayWidth, height: request.displayHeight };
    try {
      if (message.kind === 'mouse-move') {
        const p = denormalizePoint(display, message.x, message.y);
        await this.adapter.moveMouse(p.x, p.y);
      } else if (message.kind === 'mouse-button') {
        const p = denormalizePoint(display, message.x, message.y);
        await this.adapter.mouseButton(message.button, message.event, p.x, p.y);
      } else if (message.kind === 'mouse-wheel') {
        const p = denormalizePoint(display, message.x, message.y);
        await this.adapter.mouseWheel(message.deltaX, message.deltaY, p.x, p.y);
      } else {
        // Keyboard carries no coordinates; `code` was whitelisted by the
        // shared parser, and adapters map it (never the layoutful `key`).
        if (message.event === 'keydown') {
          await this.adapter.keyDown(message.code);
        } else {
          await this.adapter.keyUp(message.code);
        }
      }
      return { ok: true, kind: message.kind, reason: null };
    } catch (error) {
      return {
        ok: false,
        kind: message.kind,
        reason: error instanceof Error ? error.message : 'Remote input failed.',
      };
    }
  }
}
