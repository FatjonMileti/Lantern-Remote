import { useConnectionStore } from '../stores/connectionStore.js';

/** Connection status indicator (Phase 1 skeleton; no duplicated lifecycle state). */
export function ConnectionStatus() {
  const status = useConnectionStore((s) => s.status);
  return (
    <section className="card" aria-label="Connection status">
      <h2>Session</h2>
      <p>
        State: <span className="pill">{status}</span>
      </p>
      <p className="hint">WebRTC session details appear here from Phase 3 onward.</p>
    </section>
  );
}
