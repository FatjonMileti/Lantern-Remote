import { useConnectionStore } from '../stores/connectionStore.js';

/** Connection status indicator. Lifecycle state lives in the store. */
export function ConnectionStatus() {
  const status = useConnectionStore((s) => s.status);
  const signalingConnected = useConnectionStore((s) => s.signalingConnected);
  const incoming = useConnectionStore((s) => s.incoming);
  const role = useConnectionStore((s) => s.role);
  const rtcState = useConnectionStore((s) => s.rtcState);
  const iceState = useConnectionStore((s) => s.iceState);
  const sharing = useConnectionStore((s) => s.sharing);
  const inputSupported = useConnectionStore((s) => s.inputSupported);
  const inputUnavailableReason = useConnectionStore((s) => s.inputUnavailableReason);
  const lastRemoteInput = useConnectionStore((s) => s.lastRemoteInput);

  return (
    <section className="card" aria-label="Connection status">
      <h2>Session</h2>
      <p>
        State: <span className="pill">{status}</span>
      </p>
      <p className="hint">
        Signaling {signalingConnected ? 'connected' : 'disconnected'}
        {role ? ` · Role: ${role}` : ''}
        {incoming ? ` · Incoming from ${incoming.fromDeviceId}` : ''}
      </p>
      <p className="hint">
        WebRTC: <strong>{rtcState}</strong> · ICE: <strong>{iceState}</strong>
      </p>
      {sharing && (
        <p className="hint">
          Remote input:{' '}
          <strong>{inputSupported ? 'active' : 'unavailable'}</strong>
          {!inputSupported && inputUnavailableReason ? ` — ${inputUnavailableReason}` : ''}
          {lastRemoteInput ? ` · Last: ${lastRemoteInput}` : ''}
        </p>
      )}
    </section>
  );
}
