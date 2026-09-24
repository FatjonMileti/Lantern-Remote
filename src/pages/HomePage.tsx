import { ConnectionInput } from '../components/ConnectionInput.js';
import { ConnectionStatus } from '../components/ConnectionStatus.js';
import { ConnectionTokenCard } from '../components/ConnectionTokenCard.js';
import { DeviceIdCard } from '../components/DeviceIdCard.js';
import { IncomingRequestModal } from '../components/IncomingRequestModal.js';
import { RecentConnections } from '../components/RecentConnections.js';
import { RemoteDesktopViewer } from '../components/RemoteDesktopViewer.js';
import { ScreenShareControls } from '../components/ScreenShareControls.js';
import { SettingsPanel } from '../components/SettingsPanel.js';
import { useClipboardSync } from '../hooks/useClipboardSync.js';
import { useConnectionToken } from '../hooks/useConnectionToken.js';
import { useScreenShare } from '../hooks/useScreenShare.js';
import { useSignalingSession } from '../hooks/useSignalingSession.js';
import { useConnectionStore } from '../stores/connectionStore.js';

/** Main screen composition. Session actions come from the signaling hook. */
export function HomePage() {
  const { connectToRemote, acceptIncoming, rejectIncoming, disconnectSession } =
    useSignalingSession();
  const {
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
  } = useScreenShare();
  const remoteId = useConnectionStore((s) => s.remoteId);
  const setRemoteId = useConnectionStore((s) => s.setRemoteId);
  const tokenInput = useConnectionStore((s) => s.tokenInput);
  const setTokenInput = useConnectionStore((s) => s.setTokenInput);
  const status = useConnectionStore((s) => s.status);
  const error = useConnectionStore((s) => s.error);
  const signalingConnected = useConnectionStore((s) => s.signalingConnected);
  const incoming = useConnectionStore((s) => s.incoming);
  const remoteStream = useConnectionStore((s) => s.remoteStream);
  const fullscreen = useConnectionStore((s) => s.fullscreen);
  const setFullscreen = useConnectionStore((s) => s.setFullscreen);
  const {
    code: tokenCode,
    remainingMs,
    blockedAttempts,
    ensure: ensureToken,
    regenerate: regenerateToken,
    revoke: revokeToken,
  } = useConnectionToken();
  const clipboardActive = useClipboardSync();

  return (
    <main className="layout">
      <header className="header">
        <h1>Lantern Remote</h1>
        <p>Open-source remote desktop — explicit consent required for every session.</p>
      </header>
      <div className="grid">
        <DeviceIdCard />
        <ConnectionTokenCard
          code={tokenCode}
          remainingMs={remainingMs}
          blockedAttempts={blockedAttempts}
          onEnsure={ensureToken}
          onRegenerate={regenerateToken}
          onRevoke={revokeToken}
        />
        <ConnectionInput
          remoteId={remoteId}
          tokenInput={tokenInput}
          status={status}
          signalingConnected={signalingConnected}
          error={error}
          onRemoteIdChange={setRemoteId}
          onTokenChange={setTokenInput}
          onConnect={() => void connectToRemote()}
          onDisconnect={() => void disconnectSession()}
        />
        <ConnectionStatus />
        <ScreenShareControls
          sources={sources}
          selectedId={selectedId}
          sharing={sharing}
          canShare={canShare}
          listError={listError}
          shareError={shareError}
          onSelect={setSelectedId}
          onRefresh={refreshSources}
          onStart={() => void startSharing()}
          onStop={stopSharing}
        />
        <RemoteDesktopViewer
          stream={remoteStream}
          onDisconnect={() => void disconnectSession()}
          isFullscreen={fullscreen}
          onFullscreenChange={setFullscreen}
        />
        <RecentConnections />
        <SettingsPanel clipboardActive={clipboardActive} />
      </div>
      <footer className="footer">
        <span>Phase 9 — text clipboard sync is opt-in (Settings, off by default).</span>
      </footer>
      {incoming && (
        <IncomingRequestModal
          fromDeviceId={incoming.fromDeviceId}
          onAccept={() => void acceptIncoming()}
          onReject={() => void rejectIncoming()}
        />
      )}
    </main>
  );
}
