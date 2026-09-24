import { useConnectionStore } from '../stores/connectionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

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
 * file-transfer entries are visible stubs for later phases — present but
 * inert, never pretending to work. The clipboard entry is live since
 * Phase 9: it reflects the real sync state (setting + connected).
 */
export function ConnectionToolbar({
  scaleMode = 'fit',
  onScaleModeChange,
  onFullscreenToggle,
  isFullscreen = false,
  onDisconnect,
  disabled = false,
}: ConnectionToolbarProps) {
  const clipboardSync = useSettingsStore((s) => s.clipboardSync);
  const connected = useConnectionStore((s) => s.status) === 'connected';
  const clipboardActive = clipboardSync && connected;
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
        <span
          className={clipboardActive ? 'stub stub-active' : 'stub'}
          title={
            clipboardActive
              ? 'Clipboard sync is ON — text syncs both ways'
              : 'Clipboard sync is OFF — enable it in Settings'
          }
        >
          Clipboard{clipboardActive ? ' •' : ''}
        </span>
        <span className="stub" title="File transfer (future)">
          Files
        </span>
      </div>
    </div>
  );
}
