import { useConnectionStore } from '../stores/connectionStore.js';

/**
 * Remote-id entry (Phase 1 skeleton).
 * Actual connection-request signaling lands in Phase 2.
 */
export function ConnectionInput() {
  const remoteId = useConnectionStore((s) => s.remoteId);
  const setRemoteId = useConnectionStore((s) => s.setRemoteId);
  const status = useConnectionStore((s) => s.status);

  return (
    <section className="card" aria-label="Connect to remote device">
      <h2>Connect to Remote Device</h2>
      <div className="row">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Remote ID, e.g. 482 913 742"
          value={remoteId}
          onChange={(e) => setRemoteId(e.target.value)}
          aria-label="Remote ID"
        />
        <button type="button" disabled title="Signaling arrives in Phase 2">
          Connect
        </button>
      </div>
      <p className="hint">
        Status: <strong>{status}</strong> — connection requests are enabled in Phase 2.
      </p>
    </section>
  );
}
