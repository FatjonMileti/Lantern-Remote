import {
  MAX_CLIPBOARD_TEXT_CHARS,
  parseClipboardMessage,
  serializeClipboardMessage,
} from '../../shared/clipboard.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { webrtcService } from './WebRTCService.js';
import { getClipboardText, setClipboardText } from './lanternBridge.js';

/** Local clipboard poll cadence — copy/paste latency vs. IPC chatter. */
export const CLIPBOARD_POLL_MS = 1000;

/** OS/clipboard + channel seams, injectable so unit checks run headless. */
export interface ClipboardDeps {
  readLocal: () => Promise<string>;
  writeLocal: (text: string) => Promise<boolean>;
  send: (data: string) => boolean;
}

const liveDeps: ClipboardDeps = {
  readLocal: getClipboardText,
  writeLocal: setClipboardText,
  send: (data) => webrtcService.sendClipboard(data),
};

/**
 * Renderer-side clipboard sync (Phase 9, text-only, opt-in).
 *
 * Both peers run the same loop: poll the local clipboard while the session
 * is connected and the setting is on; send changes over the `clipboard`
 * channel; apply validated inbound frames locally.
 *
 * Echo suppression: applied inbound text becomes the local baseline, so the
 * next poll sees "no change" instead of bouncing it back. Baselines reset on
 * start/stop so toggling mid-session never replays stale text.
 */
export class RendererClipboardService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private baseline: string | null = null;

  get running(): boolean {
    return this.timer !== null;
  }

  /** Begin polling. Seeds the baseline from the current clipboard (no send),
   * so pre-existing differences only propagate on the next local copy. */
  start(deps: ClipboardDeps = liveDeps): void {
    if (this.timer) return;
    this.baseline = null;
    void deps
      .readLocal()
      .catch(() => '')
      .then((text) => {
        // Start may have been stopped while the read was in flight.
        if (!this.timer) return;
        this.baseline = text;
      });
    this.timer = setInterval(() => {
      void this.pollOnce(deps);
    }, CLIPBOARD_POLL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.baseline = null;
  }

  /** Single poll step — public for headless unit checks. */
  async pollOnce(deps: ClipboardDeps = liveDeps): Promise<void> {
    if (!this.timer) return;
    let text: string;
    try {
      text = await deps.readLocal();
    } catch {
      return;
    }
    if (text === this.baseline) return;
    this.baseline = text;
    // Empty (no text, or image content) and oversize are never sent.
    if (text.length === 0 || text.length > MAX_CLIPBOARD_TEXT_CHARS) return;
    if (deps.send(serializeClipboardMessage({ kind: 'clipboard-text', text }))) {
      useConnectionStore.getState().incrementClipboardSent();
    }
  }

  /** Apply one inbound channel frame. Validated; empty/oversize dropped. */
  async handleRemoteMessage(data: string, deps: ClipboardDeps = liveDeps): Promise<void> {
    if (!this.timer) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    const message = parseClipboardMessage(parsed);
    if (!message || message.text === this.baseline) return;
    this.baseline = message.text;
    try {
      if (await deps.writeLocal(message.text)) {
        useConnectionStore.getState().incrementClipboardReceived();
      }
    } catch {
      // A failed write leaves the baseline set; the next local copy resyncs.
    }
  }
}

export const clipboardService = new RendererClipboardService();
