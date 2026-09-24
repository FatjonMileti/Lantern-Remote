import type { RemoteInputMouseButton } from '../../../shared/remoteInput.js';
import type { InputButtonEvent, RemoteInputAdapter } from './RemoteInputAdapter.js';

const REASON =
  'Remote input is not available on macOS yet. A CGEvent backend (plus Accessibility permission) is planned; the protocol, validation, and dispatch layers are ready.';

/** macOS input sink (stub — see LinuxInputAdapter for the rationale). */
export class MacOSInputAdapter implements RemoteInputAdapter {
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
