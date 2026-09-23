import { ConnectionInput } from '../components/ConnectionInput.js';
import { ConnectionStatus } from '../components/ConnectionStatus.js';
import { DeviceIdCard } from '../components/DeviceIdCard.js';
import { IncomingRequestModal } from '../components/IncomingRequestModal.js';
import { RecentConnections } from '../components/RecentConnections.js';
import { SettingsPanel } from '../components/SettingsPanel.js';
import { useSignalingSession } from '../hooks/useSignalingSession.js';
import { useConnectionStore } from '../stores/connectionStore.js';

/** Main screen composition. Session actions come from the signaling hook. */
export function HomePage() {
  const { connectToRemote, acceptIncoming, rejectIncoming, disconnectSession } =
    useSignalingSession();
  const remoteId = useConnectionStore((s) => s.remoteId);
  const setRemoteId = useConnectionStore((s) => s.setRemoteId);
  const status = useConnectionStore((s) => s.status);
  const error = useConnectionStore((s) => s.error);
  const signalingConnected = useConnectionStore((s) => s.signalingConnected);
  const incoming = useConnectionStore((s) => s.incoming);

  return (
    <main className="layout">
      <header className="header">
        <h1>Lantern Remote</h1>
        <p>Open-source remote desktop — explicit consent required for every session.</p>
      </header>
      <div className="grid">
        <DeviceIdCard />
        <ConnectionInput
          remoteId={remoteId}
          status={status}
          signalingConnected={signalingConnected}
          error={error}
          onRemoteIdChange={setRemoteId}
          onConnect={() => void connectToRemote()}
          onDisconnect={() => void disconnectSession()}
        />
        <ConnectionStatus />
        <RecentConnections />
        <SettingsPanel />
      </div>
      <footer className="footer">
        <span>Phase 3 — WebRTC negotiation is live. Screen sharing arrives in Phase 4.</span>
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
