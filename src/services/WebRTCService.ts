/**
 * Renderer-side WebRTC peer connection manager.
 *
 * WHY a dedicated service: all RTCPeerConnection logic lives in exactly one
 * place — never in JSX or hooks. Phase 3 negotiates connectivity plus a
 * `control` DataChannel; Phase 4 adds media tracks, Phases 6+ add
 * `remote-input`/`clipboard` channels on the same connection.
 */

export interface WebRTCEvents {
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onIceState?: (state: RTCIceConnectionState) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onControlOpen?: () => void;
  onControlMessage?: (data: string) => void;
}

export interface SessionDescription {
  sdp: string;
  type: 'offer' | 'answer';
}

const CONTROL_CHANNEL_LABEL = 'control';
const DEFAULT_STUN_SERVERS = 'stun:stun.l.google.com:19302';

/**
 * WHY this shape: STUN URLs come from the environment so production can
 * inject its own without code changes. TURN entries
 * ({ urls, username, credential }) append to this same array later.
 */
function buildIceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_STUN_SERVERS ?? DEFAULT_STUN_SERVERS;
  const urls = raw
    .split(',')
    .map((entry: string) => entry.trim())
    .filter((entry: string) => entry.length > 0);
  return [{ urls: urls.length > 0 ? urls : [DEFAULT_STUN_SERVERS] }];
}

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private controlChannel: RTCDataChannel | null = null;
  private events: WebRTCEvents = {};

  setEvents(events: WebRTCEvents): void {
    this.events = events;
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc?.connectionState ?? 'new';
  }

  get iceConnectionState(): RTCIceConnectionState {
    return this.pc?.iceConnectionState ?? 'new';
  }

  /** Client role: create an offer after the host accepted. */
  async createOffer(): Promise<SessionDescription> {
    const pc = this.createPeerConnection();
    this.controlChannel = pc.createDataChannel(CONTROL_CHANNEL_LABEL);
    this.wireControlChannel(this.controlChannel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return toSessionDescription(pc.localDescription, 'offer');
  }

  /** Host role: answer an incoming offer. */
  async acceptOffer(offer: SessionDescription): Promise<SessionDescription> {
    const pc = this.createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return toSessionDescription(pc.localDescription, 'answer');
  }

  /** Client role: apply the host's answer. */
  async acceptAnswer(answer: SessionDescription): Promise<void> {
    const pc = this.requirePeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer.sdp }));
  }

  async addIceCandidate(candidate: {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
  }): Promise<void> {
    const pc = this.requirePeerConnection();
    await pc.addIceCandidate(
      new RTCIceCandidate({
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      }),
    );
  }

  close(): void {
    try {
      this.controlChannel?.close();
    } catch {
      // Channel may already be closed; cleanup must not throw.
    }
    this.controlChannel = null;
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onicecandidate = null;
      this.pc.ondatachannel = null;
      try {
        this.pc.close();
      } catch {
        // Close is idempotent-safe; ignore late errors during teardown.
      }
      this.pc = null;
    }
  }

  private createPeerConnection(): RTCPeerConnection {
    this.close();
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
    this.pc = pc;

    pc.onconnectionstatechange = () => {
      this.events.onConnectionState?.(pc.connectionState);
    };
    pc.oniceconnectionstatechange = () => {
      this.events.onIceState?.(pc.iceConnectionState);
    };
    pc.onicecandidate = (event) => {
      // Null candidate = end of gathering; nothing to trickle.
      if (event.candidate) {
        this.events.onIceCandidate?.(event.candidate);
      }
    };
    pc.onicecandidateerror = (event) => {
      console.warn('[webrtc] ICE candidate error', event);
    };
    // Answerer side: the offerer's `control` channel arrives here.
    pc.ondatachannel = (event) => {
      if (event.channel.label === CONTROL_CHANNEL_LABEL) {
        this.controlChannel = event.channel;
        this.wireControlChannel(event.channel);
      }
    };
    return pc;
  }

  private wireControlChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.events.onControlOpen?.();
    };
    channel.onmessage = (event) => {
      // Control channel carries text frames only; binary is rejected.
      if (typeof event.data === 'string') {
        this.events.onControlMessage?.(event.data);
      }
    };
  }

  private requirePeerConnection(): RTCPeerConnection {
    if (!this.pc) {
      throw new Error('No active peer connection for this session.');
    }
    return this.pc;
  }
}

function toSessionDescription(
  description: RTCSessionDescription | null,
  type: 'offer' | 'answer',
): SessionDescription {
  if (!description?.sdp) {
    throw new Error('Peer connection produced an empty session description.');
  }
  return { sdp: description.sdp, type };
}

export const webrtcService = new WebRTCService();
