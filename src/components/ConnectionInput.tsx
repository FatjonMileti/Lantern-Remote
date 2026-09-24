import { isValidTokenFormat, normalizeTokenInput } from '../../shared/connectionToken.js';

interface ConnectionInputProps {
  remoteId: string;
  tokenInput: string;
  status: string;
  signalingConnected: boolean;
  error: string | null;
  onRemoteIdChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const BUSY_STATES = new Set(['connecting', 'waiting-for-approval', 'approved', 'negotiating', 'connected']);

/** Remote-id + connection-code entry. Requests go through the session hook. */
export function ConnectionInput({
  remoteId,
  tokenInput,
  status,
  signalingConnected,
  error,
  onRemoteIdChange,
  onTokenChange,
  onConnect,
  onDisconnect,
}: ConnectionInputProps) {
  const busy = BUSY_STATES.has(status);
  const canConnect =
    signalingConnected && !busy && remoteId.trim().length > 0 && isValidTokenFormat(tokenInput);

  return (
    <section className="card" aria-label="Connect to remote device">
      <h2>Connect to Remote Device</h2>
      <div className="row">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Remote ID, e.g. 482 913 742"
          value={remoteId}
          onChange={(e) => onRemoteIdChange(formatInput(e.target.value))}
          aria-label="Remote ID"
          disabled={busy}
        />
        <input
          type="text"
          className="token-input"
          placeholder="Code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          value={tokenInput}
          onChange={(e) => onTokenChange(normalizeTokenInput(e.target.value))}
          aria-label="Connection code"
          disabled={busy}
        />
        {busy ? (
          <button type="button" className="button-secondary" onClick={onDisconnect}>
            Cancel
          </button>
        ) : (
          <button type="button" onClick={onConnect} disabled={!canConnect}>
            Connect
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <p className="hint">
        Signaling: <strong>{signalingConnected ? 'online' : 'offline'}</strong> · Status:{' '}
        <strong>{status}</strong> · Ask the host for their 6-character code.
      </p>
    </section>
  );
}

function formatInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(
    (part) => part.length > 0,
  );
  return parts.join(' ');
}
