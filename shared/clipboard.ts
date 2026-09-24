/**
 * Clipboard sync protocol (Phase 9, text-only, opt-in).
 *
 * WHY shared: both renderers serialize/parse the same frames, and main
 * truncates reads to the same bound. Text-only by design: images and rich
 * content read back as empty strings and are skipped, never propagated —
 * propagating an empty frame would wipe the peer's real text when the user
 * copies an image locally.
 */

/** Out-of-band agreement: the `clipboard` DataChannel carries text frames only. */
export const CLIPBOARD_CHANNEL_LABEL = 'clipboard';

/**
 * Max clipboard text in UTF-16 code units. 256 KiB keeps every frame well
 * inside SCTP message limits on all platforms; anything larger is rejected
 * (not truncated — silent truncation would corrupt pasted content).
 */
export const MAX_CLIPBOARD_TEXT_CHARS = 256 * 1024;

export interface ClipboardTextMessage {
  kind: 'clipboard-text';
  text: string;
}

export function serializeClipboardMessage(message: ClipboardTextMessage): string {
  return JSON.stringify({ kind: message.kind, text: message.text });
}

/**
 * Validate an inbound frame. Returns the message, or null when the frame is
 * malformed, non-text, empty (see above — never wipe the peer), or oversize.
 */
export function parseClipboardMessage(payload: unknown): ClipboardTextMessage | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (record.kind !== 'clipboard-text') return null;
  if (typeof record.text !== 'string') return null;
  if (record.text.length === 0 || record.text.length > MAX_CLIPBOARD_TEXT_CHARS) return null;
  return { kind: 'clipboard-text', text: record.text };
}
