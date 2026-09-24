import { clipboard } from 'electron';
import { MAX_CLIPBOARD_TEXT_CHARS } from '../../shared/clipboard.js';
import { Logger } from './Logger.js';

const logger = new Logger('main:clipboard');

/**
 * Main-process clipboard access (Phase 9).
 *
 * WHY main owns this: the sandboxed renderer has no `clipboard` module and
 * `navigator.clipboard` needs focus + permission prompts mid-session.
 * Electron's `clipboard.readText()` returns '' for image/rich content, which
 * callers treat as "no text" (never propagated — see shared/clipboard.ts).
 * Contents are NEVER logged, only lengths and verdicts.
 */
export class ClipboardService {
  /**
   * Read current text, truncated to MAX+1 so an enormous local clipboard
   * can't blow up IPC — the +1 lets the renderer detect oversize.
   */
  async readText(): Promise<string> {
    try {
      const text = await clipboard.readText();
      return text.slice(0, MAX_CLIPBOARD_TEXT_CHARS + 1);
    } catch (error) {
      logger.error('Failed to read clipboard', error);
      return '';
    }
  }

  /** Write validated text. Returns false (no throw) when rejected. */
  writeText(text: unknown): boolean {
    if (typeof text !== 'string' || text.length === 0) return false;
    if (text.length > MAX_CLIPBOARD_TEXT_CHARS) {
      logger.warn('Clipboard write rejected: oversize', { length: text.length });
      return false;
    }
    try {
      clipboard.writeText(text);
      return true;
    } catch (error) {
      logger.error('Failed to write clipboard', error);
      return false;
    }
  }
}
