import { useCallback, useEffect, useState } from 'react';
import { serializeControlMessage } from '../../shared/controlMessages.js';
import type { DesktopSource } from '../../shared/ipc.js';
import { remoteInputService } from '../services/RemoteInputService.js';
import { screenCaptureService } from '../services/ScreenCaptureService.js';
import { webrtcService } from '../services/WebRTCService.js';
import { useConnectionStore } from '../stores/connectionStore.js';

/**
 * Stop local capture tracks and clear sharing state. Exported so every
 * session-teardown path (disconnect, peer left, negotiation failure) stops
 * the camera-less screen feed — a stopped session must never keep sharing.
 */
export function stopLocalCapture(): void {
  const store = useConnectionStore.getState();
  screenCaptureService.stopStream(store.localStream);
  webrtcService.removeLocalStream();
  store.setLocalStream(null);
  store.setSharing(false);
  store.setSharedDisplaySize(null);
  store.setLastRemoteInput(null);
}

function readDisplaySize(stream: MediaStream): { width: number; height: number } | null {
  const settings = stream.getVideoTracks()[0]?.getSettings();
  if (!settings || !settings.width || !settings.height) return null;
  return { width: settings.width, height: settings.height };
}

/**
 * Host-side screen sharing. The host explicitly picks a display and starts
 * sharing; tracks attach to the live peer connection and the client is told
 * over the `control` channel so it can re-offer (only client→host offers
 * are routed by the server).
 */
export function useScreenShare(): {
  sources: DesktopSource[];
  selectedId: string;
  sharing: boolean;
  canShare: boolean;
  listError: string | null;
  shareError: string | null;
  setSelectedId: (id: string) => void;
  refreshSources: () => void;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
} {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const sharing = useConnectionStore((s) => s.sharing);
  const status = useConnectionStore((s) => s.status);

  const canShare = status === 'connected' && !sharing;

  const refreshSources = useCallback(() => {
    setListError(null);
    screenCaptureService
      .listScreens()
      .then((list) => {
        setSources(list);
        setSelectedId((current) => current || list[0]?.id || '');
      })
      .catch((error) => {
        setListError(error instanceof Error ? error.message : 'Unable to list screens.');
      });
  }, []);

  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  async function startSharing(): Promise<void> {
    const store = useConnectionStore.getState();
    setShareError(null);
    if (store.status !== 'connected') {
      setShareError('Connect to a peer before starting screen sharing.');
      return;
    }
    if (store.sharing) return;
    const sourceId = selectedId || sources[0]?.id || '';
    if (!sourceId) {
      setShareError('No display available. Refresh the list and try again.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await screenCaptureService.startCapture(sourceId);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Could not start screen capture.');
      return;
    }
    try {
      webrtcService.addLocalStream(stream);
    } catch (error) {
      screenCaptureService.stopStream(stream);
      setShareError(error instanceof Error ? error.message : 'No active peer connection.');
      return;
    }
    store.setLocalStream(stream);
    store.setSharing(true);
    store.setSharedDisplaySize(readDisplaySize(stream));
    // Surface the honest adapter state now that sharing is live. Capability
    // is queried here (not at boot) because it describes this host session.
    remoteInputService
      .inputStatus()
      .then((status) => {
        useConnectionStore.getState().setInputCapability(status.supported, status.reason);
      })
      .catch(() => {
        useConnectionStore.getState().setInputCapability(false, 'Unable to query input support.');
      });
    const notified = webrtcService.sendControlMessage(
      serializeControlMessage({ kind: 'video-tracks-added' }),
    );
    if (!notified) {
      // Roll back: untracked sharing with no client notification is a lie.
      stopLocalCapture();
      setShareError('Control channel is not ready. Wait for the connection and try again.');
    }
  }

  function stopSharing(): void {
    setShareError(null);
    stopLocalCapture();
    // Best effort: the peer clears its viewer on receipt; if the channel is
    // gone the peer already saw `peer-disconnected` or will time out.
    webrtcService.sendControlMessage(serializeControlMessage({ kind: 'video-tracks-ended' }));
  }

  return {
    sources,
    selectedId,
    sharing,
    canShare,
    listError,
    shareError,
    setSelectedId,
    refreshSources,
    startSharing,
    stopSharing,
  };
}
