import type { RemoteInputMouseButton } from '../../../shared/remoteInput.js';
import type { InputButtonEvent, RemoteInputAdapter } from './RemoteInputAdapter.js';

const REASON =
  'Remote input is not available on Linux yet. A privileged backend (uinput or ydotool/wtype) is planned; the protocol, validation, and dispatch layers are ready.';

/**
 * Linux input sink (stub). Moving a real cursor needs a privileged backend
 * plus explicit OS permission (uinput group / compositor approval) — none of
 * which is silently claimed here.
 */
export class LinuxInputAdapter implements RemoteInputAdapter {
  status(): { supported: boolean; reason: string | null } {
    return { supported: false, reason: REASON };
  }

  moveMouse(_x: number, _y: number): Promise<void> {
    return Promise.reject(new Error(REASON));
  }

  mouseButton(
    _button: RemoteInputMouseButton,
    _event: InputButtonEvent,
    _x: number,
    _y: number,
  ): Promise<void> {
    return Promise.reject(new Error(REASON));
  }

  mouseWheel(_deltaX: number, _deltaY: number, _x: number, _y: number): Promise<void> {
    return Promise.reject(new Error(REASON));
  }
}
