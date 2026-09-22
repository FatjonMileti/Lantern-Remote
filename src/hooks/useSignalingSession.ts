import { useEffect } from 'react';
import { formatDeviceId } from '../../shared/deviceId.js';
import { SIGNALING_ERROR_MESSAGES } from '../../shared/signaling.js';
import { signalingService } from '../services/SignalingService.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { useDeviceStore } from '../stores/deviceStore.js';

const DEFAULT_SIGNALING_URL = 'http://localhost:3001';

function signalingUrl(): string {
  return import.meta.env.VITE_SIGNALING_SERVER_URL ?? DEFAULT_SIGNALING_URL;
}

/**
 * Wires SignalingService into the connection store. Components stay presentational.
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
        store.setStatus('waiting-for-approval');
      },
      onAccepted: (payload) => {
        const store = useConnectionStore.getState();
        store.setRoomId(payload.roomId);
        store.setStatus('approved');
        store.setError(null);
      },
      onRejected: () => {
        const store = useConnectionStore.getState();
        store.setError(SIGNALING_ERROR_MESSAGES.REJECTED);
        store.setStatus('failed');
        store.setIncoming(null);
        store.setRoomId(null);
      },
      onPeerDisconnected: (payload) => {
        const store = useConnectionStore.getState();
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
      signalingService.setListeners({});
      signalingService.disconnect();
    };
  }, [deviceId, loading]);

  async function connectToRemote(): Promise<void> {
    const store = useConnectionStore.getState();
    store.setError(null);
    store.setStatus('connecting');
    try {
      const roomId = await signalingService.requestConnection(store.remoteId);
      store.setRoomId(roomId);
      store.setStatus('waiting-for-approval');
    } catch (error) {
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
      store.setStatus('approved');
      store.setError(null);
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
    store.setIncoming(null);
    store.setRoomId(null);
    store.setStatus('idle');
  }

  async function disconnectSession(): Promise<void> {
    const store = useConnectionStore.getState();
    try {
      await signalingService.disconnectSession(store.roomId);
    } catch {
      // Local reset is required even if the server is already gone.
    }
    store.reset();
  }

  return { connectToRemote, acceptIncoming, rejectIncoming, disconnectSession };
}
