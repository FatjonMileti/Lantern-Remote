import { useEffect } from 'react';
import { parseControlMessage } from '../../shared/controlMessages.js';
import { formatDeviceId } from '../../shared/deviceId.js';
import type { RemoteInputMessage } from '../../shared/remoteInput.js';
import { NEGOTIATION_TIMEOUT_MS, SIGNALING_ERROR_MESSAGES } from '../../shared/signaling.js';
import { remoteInputService } from '../services/RemoteInputService.js';
import { signalingService } from '../services/SignalingService.js';
import { webrtcService } from '../services/WebRTCService.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { useDeviceStore } from '../stores/deviceStore.js';
import { stopLocalCapture } from './useScreenShare.js';

const DEFAULT_SIGNALING_URL = 'http://localhost:3001';

function signalingUrl(): string {
  return import.meta.env.VITE_SIGNALING_SERVER_URL ?? DEFAULT_SIGNALING_URL;
}

let negotiationTimer: ReturnType<typeof setTimeout> | null = null;

function clearNegotiationTimer(): void {
  if (negotiationTimer) {
    clearTimeout(negotiationTimer);
    negotiationTimer = null;
  }
}

function armNegotiationTimer(): void {
  clearNegotiationTimer();
  negotiationTimer = setTimeout(() => {
    const store = useConnectionStore.getState();
    if (store.status !== 'negotiating') return;
    failSession(SIGNALING_ERROR_MESSAGES.NEGOTIATION_TIMEOUT);
  }, NEGOTIATION_TIMEOUT_MS);
}

/**
 * Tear down a dead session: stop capture, close the peer connection, release
 * the server room (the peer sees `peer-disconnected`), surface a human error.
 */
function failSession(message: string): void {
  clearNegotiationTimer();
  const store = useConnectionStore.getState();
  const roomId = store.roomId;
  stopLocalCapture();
  webrtcService.close();
  void signalingService.disconnectSession(roomId).catch(() => {
    // Local reset is required even if the server is already gone.
  });
  store.reset();
  store.setStatus('failed');
  store.setError(message);
}

/**
 * One-line diagnostics summary (kind + normalized coords, 2 decimals).
 * Shown in the host Session card so data flow is visible end to end.
 */
function summarizeInput(message: RemoteInputMessage): string {
  if (message.kind === 'keyboard') {
    return `${message.event} ${message.code}`;
  }
  const x = message.x.toFixed(2);
  const y = message.y.toFixed(2);
  if (message.kind === 'mouse-button') {
    return `${message.event} ${message.button} (${x}, ${y})`;
  }
  if (message.kind === 'mouse-wheel') {
    return `wheel Δ${message.deltaX},${message.deltaY} (${x}, ${y})`;
  }
  return `move (${x}, ${y})`;
}

/**
 * Wires signaling + WebRTC into the connection store.
 * Components stay presentational; all negotiation lives here.
 *
 * Flow: client requests → host accepts → client offers → host answers →
 * both trickle ICE → `connected`. Roles: the requester always offers.
 */
export function useSignalingSession(): {
  connectToRemote: () => Promise<void>;
  acceptIncoming: () => Promise<void>;
  rejectIncoming: () => Promise<void>;
  disconnectSession: () => Promise<void>;
} {
  const deviceId = useDeviceStore((s) => s.deviceId);
  const loading = useDeviceStore((s) => s.loading);

  useEffect(() => {
    if (loading || !deviceId || deviceId.includes('·')) return undefined;

    webrtcService.setEvents({
      onConnectionState: (state) => {
        const store = useConnectionStore.getState();
        store.setRtcState(state);
        if (state === 'connected') {
          clearNegotiationTimer();
          store.setStatus('connected');
          store.setError(null);
        } else if (state === 'failed') {
          failSession(SIGNALING_ERROR_MESSAGES.ICE_FAILED);
        } else if (state === 'disconnected' || state === 'closed') {
          // Transient blips also land here; reconnect arrives in Phase 4+.
          clearNegotiationTimer();
          webrtcService.close();
          store.setStatus('disconnected');
        }
      },
      onIceState: (state) => {
        useConnectionStore.getState().setIceState(state);
      },
      onIceCandidate: (candidate) => {
        const store = useConnectionStore.getState();
        if (!store.roomId) return;
        void signalingService
          .sendIceCandidate(store.roomId, {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          })
          .catch(() => {
            // Peer may be gone; connection-state events report the outcome.
          });
      },
      onRemoteStream: (stream) => {
        useConnectionStore.getState().setRemoteStream(stream);
      },
      onRemoteInputMessage: (data) => {
        // Host path only: the client never applies input to itself. Trust
        // comes from the channel; content is validated inside forwardToHost.
        const store = useConnectionStore.getState();
        if (store.role !== 'host' || !store.sharing) return;
        const message = remoteInputService.forwardToHost(data, store.sharedDisplaySize);
        if (!message) return;
        store.setLastRemoteInput(summarizeInput(message));
      },
      onControlMessage: (data) => {
        // Trust comes from the channel itself (only the peer holds it);
        // the frame content is still validated before acting on it.
        const message = parseControlMessage(data);
        if (!message) return;
        const store = useConnectionStore.getState();
        if (message.kind === 'video-tracks-added') {
          if (store.role === 'client' && store.roomId && store.status === 'connected') {
            void sendReoffer(store.roomId);
          }
        } else if (message.kind === 'video-tracks-ended') {
          if (store.role === 'client') {
            store.setRemoteStream(null);
          }
        }
      },
    });

    signalingService.setListeners({
      onConnected: () => {
        useConnectionStore.getState().setSignalingConnected(true);
        useConnectionStore.getState().setError(null);
      },
      onDisconnected: () => {
        useConnectionStore.getState().setSignalingConnected(false);
      },
      onUnavailable: (message) => {
        const store = useConnectionStore.getState();
        store.setSignalingConnected(false);
        store.setError(message);
      },
      onIncoming: (payload) => {
        const store = useConnectionStore.getState();
        store.setIncoming({
          roomId: payload.roomId,
          fromDeviceId: formatDeviceId(payload.fromDeviceId),
        });
        store.setRoomId(payload.roomId);
        store.setRole('host');
        store.setStatus('waiting-for-approval');
      },
      onAccepted: (payload) => {
        const store = useConnectionStore.getState();
        store.setRoomId(payload.roomId);
        store.setStatus('negotiating');
        store.setError(null);
        void createAndSendOffer(payload.roomId);
      },
      onRejected: () => {
        const store = useConnectionStore.getState();
        store.setError(SIGNALING_ERROR_MESSAGES.REJECTED);
        store.setStatus('failed');
        store.setIncoming(null);
        store.setRoomId(null);
      },
      onOffer: (payload) => {
        const store = useConnectionStore.getState();
        if (store.role !== 'host' || store.roomId !== payload.roomId) return;
        void answerOffer(payload.roomId, payload.sdp);
      },
      onAnswer: (payload) => {
        const store = useConnectionStore.getState();
        if (store.role !== 'client' || store.roomId !== payload.roomId) return;
        void webrtcService.acceptAnswer({ sdp: payload.sdp, type: 'answer' }).catch((error) => {
          failSession(error instanceof Error ? error.message : SIGNALING_ERROR_MESSAGES.ICE_FAILED);
        });
      },
      onIceCandidate: (payload) => {
        const store = useConnectionStore.getState();
        if (!store.roomId || store.roomId !== payload.roomId) return;
        void webrtcService
          .addIceCandidate({
            candidate: payload.candidate,
            sdpMid: payload.sdpMid,
            sdpMLineIndex: payload.sdpMLineIndex,
          })
          .catch(() => {
            // Stale candidates after teardown are harmless; ignore.
          });
      },
      onPeerDisconnected: (payload) => {
        const store = useConnectionStore.getState();
        stopLocalCapture();
        webrtcService.close();
        clearNegotiationTimer();
        if (payload.reason === 'timeout') {
          store.setError(SIGNALING_ERROR_MESSAGES.TIMEOUT);
          store.setStatus('failed');
        } else {
          store.setStatus('disconnected');
        }
        store.setIncoming(null);
        store.setRoomId(null);
      },
    });

    signalingService.connect(signalingUrl(), deviceId);

    return () => {
      clearNegotiationTimer();
      webrtcService.close();
      signalingService.setListeners({});
      signalingService.disconnect();
    };
  }, [deviceId, loading]);

  async function connectToRemote(): Promise<void> {
    const store = useConnectionStore.getState();
    store.setError(null);
    store.setRole('client');
    store.setStatus('connecting');
    try {
      const roomId = await signalingService.requestConnection(store.remoteId);
      store.setRoomId(roomId);
      store.setStatus('waiting-for-approval');
    } catch (error) {
      store.setRole(null);
      store.setStatus('failed');
      store.setError(error instanceof Error ? error.message : SIGNALING_ERROR_MESSAGES.INVALID_ID);
    }
  }

  async function acceptIncoming(): Promise<void> {
    const store = useConnectionStore.getState();
    const incoming = store.incoming;
    if (!incoming) return;
    try {
      await signalingService.accept(incoming.roomId);
      store.setIncoming(null);
      store.setStatus('negotiating');
      store.setError(null);
      armNegotiationTimer();
    } catch (error) {
      store.setStatus('failed');
      store.setError(
        error instanceof Error ? error.message : SIGNALING_ERROR_MESSAGES.ROOM_NOT_FOUND,
      );
    }
  }

  async function rejectIncoming(): Promise<void> {
    const store = useConnectionStore.getState();
    const incoming = store.incoming;
    if (!incoming) return;
    try {
      await signalingService.reject(incoming.roomId);
    } catch {
      // Host still clears local UI so a failed ack cannot leave a stuck modal.
    }
    stopLocalCapture();
    webrtcService.close();
    clearNegotiationTimer();
    store.setIncoming(null);
    store.setRoomId(null);
    store.setStatus('idle');
  }

  async function disconnectSession(): Promise<void> {
    const store = useConnectionStore.getState();
    stopLocalCapture();
    webrtcService.close();
    clearNegotiationTimer();
    try {
      await signalingService.disconnectSession(store.roomId);
    } catch {
      // Local reset is required even if the server is already gone.
    }
    store.reset();
  }

  return { connectToRemote, acceptIncoming, rejectIncoming, disconnectSession };
}

/** Client role: build the offer and send it once accepted. */
async function createAndSendOffer(roomId: string): Promise<void> {
  armNegotiationTimer();
  try {
    const offer = await webrtcService.createOffer();
    await signalingService.sendOffer(roomId, offer.sdp);
  } catch (error) {
    failSession(
      error instanceof Error ? error.message : SIGNALING_ERROR_MESSAGES.NEGOTIATION_TIMEOUT,
    );
  }
}

/**
 * Client role: re-offer on the live connection after the host attached
 * screen tracks. No negotiation timer — the session is already `connected`;
 * a failed re-offer still tears the session down (the peer is gone).
 */
async function sendReoffer(roomId: string): Promise<void> {
  try {
    const offer = await webrtcService.createOffer();
    await signalingService.sendOffer(roomId, offer.sdp);
  } catch (error) {
    failSession(error instanceof Error ? error.message : SIGNALING_ERROR_MESSAGES.ICE_FAILED);
  }
}

/** Host role: answer an incoming offer. */
async function answerOffer(roomId: string, sdp: string): Promise<void> {
  try {
    const answer = await webrtcService.acceptOffer({ sdp, type: 'offer' });
    await signalingService.sendAnswer(roomId, answer.sdp);
  } catch (error) {
    failSession(
      error instanceof Error ? error.message : SIGNALING_ERROR_MESSAGES.NEGOTIATION_TIMEOUT,
    );
  }
}
