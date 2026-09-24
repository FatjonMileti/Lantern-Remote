import type {
  InputAdapterStatus,
  RemoteInputMouseButton,
} from '../../../shared/remoteInput.js';

export type InputButtonEvent = 'down' | 'up' | 'click' | 'double-click';

/**
 * OS-level input sink. Coordinates arrive as integer display pixels —
 * normalization and validation happen before this point.
 *
 * WHY an interface: each OS needs its own privileged backend (uinput/ydotool
 * on Linux, SendInput on Windows, CGEvent on macOS). Stubs below expose a
 * clear unsupported state until a backend lands; nothing pretends to work.
 */
export interface RemoteInputAdapter {
  status(): InputAdapterStatus;
  moveMouse(x: number, y: number): Promise<void>;
  mouseButton(
    button: RemoteInputMouseButton,
    event: InputButtonEvent,
    x: number,
    y: number,
  ): Promise<void>;
  mouseWheel(deltaX: number, deltaY: number, x: number, y: number): Promise<void>;
  /** `code` is a whitelisted `KeyboardEvent.code` (layout-independent). */
  keyDown(code: string): Promise<void>;
  keyUp(code: string): Promise<void>;
}
