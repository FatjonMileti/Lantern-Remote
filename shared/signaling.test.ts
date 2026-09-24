import { describe, expect, it } from 'vitest';
import { parseIceCandidatePayload } from './signaling.js';

describe('signaling validators', () => {
  const base = {
    roomId: 'room-12345',
    candidate: 'candidate:1 1 UDP 123 127.0.0.1 5000 typ host',
    sdpMid: '0',
  };

  it('accepts null or non-negative integer ICE indexes', () => {
    expect(parseIceCandidatePayload({ ...base, sdpMLineIndex: null })).not.toBeNull();
    expect(parseIceCandidatePayload({ ...base, sdpMLineIndex: 0 })).not.toBeNull();
    expect(parseIceCandidatePayload({ ...base, sdpMLineIndex: 2 })).not.toBeNull();
  });

  it('rejects non-finite, fractional, and negative ICE indexes', () => {
    expect(parseIceCandidatePayload({ ...base, sdpMLineIndex: Number.NaN })).toBeNull();
    expect(
      parseIceCandidatePayload({ ...base, sdpMLineIndex: Number.POSITIVE_INFINITY }),
    ).toBeNull();
    expect(parseIceCandidatePayload({ ...base, sdpMLineIndex: 1.5 })).toBeNull();
    expect(parseIceCandidatePayload({ ...base, sdpMLineIndex: -1 })).toBeNull();
  });
});
