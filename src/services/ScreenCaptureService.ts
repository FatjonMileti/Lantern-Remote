import type { DesktopSource } from '../../shared/ipc.js';
import { getDesktopSources } from './lanternBridge.js';

export const CAPTURE_ERROR_MESSAGES = {
  PERMISSION_DENIED: 'Screen capture was denied. Allow screen recording for Lantern Remote and try again.',
  SOURCE_UNAVAILABLE: 'That display is no longer available. Refresh the list and try again.',
  NOT_SUPPORTED: 'Screen capture is not supported in this environment.',
  FAILED: 'Could not start screen capture. Try again.',
} as const;

/**
 * Host-side screen capture (renderer half).
 *
 * WHY split across processes: enumeration uses the privileged
 * `desktopCapturer` API via main+IPC; frame capture itself is standard
 * `getUserMedia`, so no Electron leaks into the renderer. Audio is
 * intentionally off — Phase 4 is video-only.
 */
export class ScreenCaptureService {
  listScreens(): Promise<DesktopSource[]> {
    return getDesktopSources();
  }

  async startCapture(sourceId: string): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(CAPTURE_ERROR_MESSAGES.NOT_SUPPORTED);
    }
    // `mandatory.chromeMediaSource` is Electron/Chromium-specific and absent
    // from lib.dom typings — cast narrowly instead of using `any`.
    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      },
    } as unknown as MediaStreamConstraints;
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      throw new Error(mapCaptureError(error));
    }
  }

  stopStream(stream: MediaStream | null): void {
    if (!stream) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Tracks may already be ended during teardown; ignore.
      }
    }
  }
}

function mapCaptureError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') return CAPTURE_ERROR_MESSAGES.PERMISSION_DENIED;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return CAPTURE_ERROR_MESSAGES.SOURCE_UNAVAILABLE;
  }
  if (name === 'NotSupportedError') return CAPTURE_ERROR_MESSAGES.NOT_SUPPORTED;
  return CAPTURE_ERROR_MESSAGES.FAILED;
}

export const screenCaptureService = new ScreenCaptureService();
