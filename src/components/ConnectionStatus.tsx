import { useConnectionStore } from '../stores/connectionStore.js';

/** Connection status indicator. Lifecycle state lives in the store. */
export function ConnectionStatus() {
  const status = useConnectionStore((s) => s.status);
  const signalingConnected = useConnectionStore((s) => s.signalingConnected);
  const incoming = useConnectionStore((s) => s.incoming);

  return (
    <section className="card" aria-label="Connection status">
      <h2>Session</h2>
      <p>
        State: <span className="pill">{status}</span>
      </p>
      <p className="hint">
        Signaling {signalingConnected ? 'connected' : 'disconnected'}
        {incoming ? ` · Incoming from ${incoming.fromDeviceId}` : ''}
        {status === 'approved' ? ' · Host accepted (WebRTC in Phase 3)' : ''}
      </p>
    </section>
  );
}
