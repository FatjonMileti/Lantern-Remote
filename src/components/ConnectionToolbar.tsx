export type ViewerScaleMode = 'fit' | 'actual';

interface ConnectionToolbarProps {
  scaleMode?: ViewerScaleMode;
  onScaleModeChange?: (mode: ViewerScaleMode) => void;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onDisconnect: () => void;
  disabled?: boolean;
}

/**
 * Session toolbar: scaling, fullscreen, disconnect. Quality / monitor /
 * clipboard / file-transfer entries are visible stubs for later phases —
 * present but inert, never pretending to work.
 */
export function ConnectionToolbar({
  scaleMode = 'fit',
  onScaleModeChange,
  onFullscreenToggle,
  isFullscreen = false,
  onDisconnect,
  disabled = false,
}: ConnectionToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Connection controls">
      <div className="toolbar-group">
        <button
          type="button"
          className={`tool-button${scaleMode === 'fit' ? ' active' : ''}`}
          onClick={() => onScaleModeChange?.('fit')}
          disabled={disabled}
          title="Fit to window"
          aria-pressed={scaleMode === 'fit'}
        >
          Fit
        </button>
        <button
          type="button"
          className={`tool-button${scaleMode === 'actual' ? ' active' : ''}`}
          onClick={() => onScaleModeChange?.('actual')}
          disabled={disabled}
          title="Actual size (1:1 pixels, scrollable)"
          aria-pressed={scaleMode === 'actual'}
        >
          1:1
        </button>
        <button
          type="button"
          className={`tool-button${isFullscreen ? ' active' : ''}`}
          onClick={onFullscreenToggle}
          disabled={disabled}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>
      <div className="toolbar-group">
        <button
          type="button"
          className="tool-button tool-button-danger"
          onClick={onDisconnect}
          disabled={disabled}
          title="Disconnect session"
        >
          Disconnect
        </button>
      </div>
      <div className="toolbar-group toolbar-stubs" aria-label="Future features">
        <span className="stub" title="Quality selector (later phase)">
          Quality
        </span>
        <span className="stub" title="Monitor selection (later phase)">
          Monitor
        </span>
        <span className="stub" title="Clipboard sync (Phase 9)">
          Clipboard
        </span>
        <span className="stub" title="File transfer (future)">
          Files
        </span>
      </div>
    </div>
  );
}
