import { useConnectionStore } from '../stores/connectionStore.js';

/**
 * Diagnostics panel showing live connection states and error information.
 *
 * WHY: production-grade observability requires visibility into signaling,
 * WebRTC, and ICE states for troubleshooting connection issues.
 */
export function DiagnosticsPanel() {
  const status = useConnectionStore((s) => s.status);
  const signalingConnected = useConnectionStore((s) => s.signalingConnected);
  const rtcState = useConnectionStore((s) => s.rtcState);
  const iceState = useConnectionStore((s) => s.iceState);
  const role = useConnectionStore((s) => s.role);
  const error = useConnectionStore((s) => s.error);
  const remoteId = useConnectionStore((s) => s.remoteId);
  const roomId = useConnectionStore((s) => s.roomId);

  return (
    <section className="card" aria-label="Diagnostics">
      <h2>Diagnostics</h2>
      <div className="diagnostics-grid">
        <div className="diagnostic-item">
          <span className="label">Status:</span>
          <span className={`value status-${status}`}>{status}</span>
        </div>
        <div className="diagnostic-item">
          <span className="label">Signaling:</span>
          <span className={`value ${signalingConnected ? 'connected' : 'disconnected'}`}>
            {signalingConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="diagnostic-item">
          <span className="label">Role:</span>
          <span className="value">{role || 'None'}</span>
        </div>
        <div className="diagnostic-item">
          <span className="label">RTC State:</span>
          <span className="value">{rtcState}</span>
        </div>
        <div className="diagnostic-item">
          <span className="label">ICE State:</span>
          <span className="value">{iceState}</span>
        </div>
        {remoteId && (
          <div className="diagnostic-item">
            <span className="label">Remote ID:</span>
            <span className="value">{remoteId}</span>
          </div>
        )}
        {roomId && (
          <div className="diagnostic-item">
            <span className="label">Room ID:</span>
            <span className="value">{roomId}</span>
          </div>
        )}
        {error && (
          <div className="diagnostic-item full-width">
            <span className="label">Error:</span>
            <span className="value error">{error}</span>
          </div>
        )}
      </div>
    </section>
  );
}
