/**
 * Typed `control` DataChannel messages (connection metadata only).
 *
 * WHY a shared module: both peers must parse the same frames. The channel
 * carries UTF-8 JSON text — binary frames are rejected by the receiver.
 * Later phases extend this union (`remote-input`, `clipboard` get their own
 * channels; see README data-channel design).
 */

export type ControlMessage = VideoTracksAddedMessage | VideoTracksEndedMessage;

export interface VideoTracksAddedMessage {
  kind: 'video-tracks-added';
}

export interface VideoTracksEndedMessage {
  kind: 'video-tracks-ended';
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(['video-tracks-added', 'video-tracks-ended']);

export function serializeControlMessage(message: ControlMessage): string {
  return JSON.stringify(message);
}

/** Returns null for any malformed, binary, or unknown message. */
export function parseControlMessage(data: unknown): ControlMessage | null {
  if (typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const kind = (parsed as Record<string, unknown>).kind;
  if (typeof kind !== 'string' || !KNOWN_KINDS.has(kind)) return null;
  return { kind } as ControlMessage;
}
