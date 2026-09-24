/**
 * File transfer protocol — TYPES ONLY (Phase 12).
 *
 * WHY types first: the handshake, chunking, progress, cancellation, and
 * integrity model must be agreed before any implementation exists, so a
 * future `file-transfer` DataChannel can be built against this contract
 * without redesigning. There is deliberately NO implementation here —
 * no validators, no senders, no receivers — until core is stable.
 *
 * Intended handshake (for the future implementer):
 * 1. Sender emits `file-offer` (name, size, sha256). Receiver shows an
 *    explicit Accept/Reject dialog — transfers never start silently,
 *    exactly like sessions.
 * 2. On accept, the sender streams `file-chunk` frames in `index` order,
 *    each `CHUNK_BYTES` of base64 (JSON framing keeps validation uniform
 *    with the other channels; the 33% overhead is acceptable for a v1).
 * 3. Either side may emit `file-cancel` at any time; partial data is
 *    discarded, never surfaced as a complete file.
 * 4. After the final chunk, the receiver hashes the bytes and compares
 *    against the offered `sha256` before emitting `file-complete` —
 *    integrity is verified before the file is trusted.
 * 5. Filenames are bare names only: no separators, no traversal, capped
 *    length. The receiver chooses the destination, never the sender.
 */

/** Out-of-band agreement for the future `file-transfer` DataChannel. */
export const FILE_TRANSFER_CHANNEL_LABEL = 'file-transfer';

/** Chunk payload size in bytes (base64 inflates on the wire — see above). */
export const FILE_CHUNK_BYTES = 16 * 1024;

/** Transfers above this are refused at offer time, never truncated. */
export const MAX_FILE_SIZE_BYTES = 64 * 1024 * 1024;

/** Bare filename cap; separators and traversal are never valid. */
export const MAX_FILENAME_CHARS = 255;

/** Sender proposes a transfer. The receiver must Accept before byte one. */
export interface FileOfferMessage {
  kind: 'file-offer';
  /** Bare filename only — no `/`, `\`, or `..` segments. */
  name: string;
  size: number;
  /** Hex SHA-256 of the full file; verified before completion. */
  sha256: string;
}

/** One ordered slice of the file, base64-encoded. */
export interface FileChunkMessage {
  kind: 'file-chunk';
  /** Zero-based; receiver requires contiguity from 0. */
  index: number;
  dataBase64: string;
}

/** Either side aborts; partial data is discarded. */
export interface FileCancelMessage {
  kind: 'file-cancel';
  /** Human-readable reason for diagnostics (never a path). */
  reason: string;
}

/** Receiver confirms hash match after the final chunk. */
export interface FileCompleteMessage {
  kind: 'file-complete';
  sha256: string;
}

export type FileTransferMessage =
  FileOfferMessage | FileChunkMessage | FileCancelMessage | FileCompleteMessage;

/** UI/reporting shape for an in-progress transfer (both directions). */
export interface FileTransferProgress {
  name: string;
  size: number;
  bytesTransferred: number;
  direction: 'sending' | 'receiving';
  status: 'offered' | 'active' | 'cancelled' | 'complete';
}
