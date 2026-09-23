import type { DesktopSource } from '../../shared/ipc.js';

interface ScreenShareControlsProps {
  sources: DesktopSource[];
  selectedId: string;
  sharing: boolean;
  canShare: boolean;
  listError: string | null;
  shareError: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
}

/**
 * Host-side sharing controls. Starting is always an explicit user action —
 * screens are never captured automatically on connect.
 */
export function ScreenShareControls({
  sources,
  selectedId,
  sharing,
  canShare,
  listError,
  shareError,
  onSelect,
  onRefresh,
  onStart,
  onStop,
}: ScreenShareControlsProps) {
  const selected = sources.find((source) => source.id === (selectedId || sources[0]?.id));

  return (
    <section className="card" aria-label="Screen sharing">
      <h2>Share This Screen</h2>
      <div className="row">
        <select
          aria-label="Display to share"
          value={selectedId || sources[0]?.id || ''}
          onChange={(e) => onSelect(e.target.value)}
          disabled={sharing || sources.length === 0}
        >
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
          {sources.length === 0 && <option value="">No displays found</option>}
        </select>
        <button type="button" className="button-secondary" onClick={onRefresh} disabled={sharing}>
          Refresh
        </button>
      </div>
      {selected?.thumbnailDataUrl && (
        <img className="source-thumbnail" src={selected.thumbnailDataUrl} alt="" aria-hidden="true" />
      )}
      <div className="row">
        {sharing ? (
          <button type="button" className="button-secondary" onClick={onStop}>
            Stop sharing
          </button>
        ) : (
          <button type="button" onClick={onStart} disabled={!canShare}>
            Start sharing
          </button>
        )}
        <span className="pill">{sharing ? 'Sharing' : 'Not sharing'}</span>
      </div>
      {listError && <p className="error">{listError}</p>}
      {shareError && <p className="error">{shareError}</p>}
      {!canShare && !sharing && (
        <p className="hint">Connect to a peer first — sharing starts explicitly, never automatically.</p>
      )}
    </section>
  );
}
