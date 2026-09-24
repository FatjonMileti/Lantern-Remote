interface ConnectionTokenCardProps {
  code: string | null;
  remainingMs: number | null;
  blockedAttempts: number;
  onEnsure: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/**
 * Host-side connection code. The human reads this aloud (or pastes it) to
 * the client — codes are single-use, expire in 10 minutes, and burn on
 * accept. Wrong codes never reach a modal; they are counted below.
 */
export function ConnectionTokenCard({
  code,
  remainingMs,
  blockedAttempts,
  onEnsure,
  onRegenerate,
  onRevoke,
}: ConnectionTokenCardProps) {
  return (
    <section className="card" aria-label="Connection code">
      <h2>Connection Code</h2>
      {code ? (
        <>
          <p className="token-code" aria-live="polite">
            {code}
          </p>
          <div className="row">
            <button type="button" className="button-secondary" onClick={onRegenerate}>
              New code
            </button>
            <button type="button" className="button-secondary" onClick={onRevoke}>
              Revoke
            </button>
            <span className="pill">
              Expires in {remainingMs === null ? '–' : formatRemaining(remainingMs)}
            </span>
          </div>
        </>
      ) : (
        <div className="row">
          <button type="button" onClick={onEnsure}>
            Generate code
          </button>
        </div>
      )}
      {blockedAttempts > 0 && (
        <p className="hint">
          Blocked {blockedAttempts} incorrect {blockedAttempts === 1 ? 'attempt' : 'attempts'}.
        </p>
      )}
      <p className="hint">Share this code with whoever you want to let in — once, then it burns.</p>
    </section>
  );
}
