import { useConnectionStore } from '../stores/connectionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

interface SettingsPanelProps {
  clipboardActive: boolean;
}

/** Settings (clipboard sync, signaling URL, STUN servers). */
export function SettingsPanel({ clipboardActive }: SettingsPanelProps) {
  const clipboardSync = useSettingsStore((s) => s.clipboardSync);
  const setClipboardSync = useSettingsStore((s) => s.setClipboardSync);
  const signalingUrl = useSettingsStore((s) => s.signalingUrl);
  const setSignalingUrl = useSettingsStore((s) => s.setSignalingUrl);
  const stunServers = useSettingsStore((s) => s.stunServers);
  const setStunServers = useSettingsStore((s) => s.setStunServers);
  const clipboardSent = useConnectionStore((s) => s.clipboardSent);
  const clipboardReceived = useConnectionStore((s) => s.clipboardReceived);

  return (
    <section className="card" aria-label="Settings">
      <h2>Settings</h2>
      <div className="settings-section">
        <label className="row">
          <input
            type="checkbox"
            checked={clipboardSync}
            onChange={(e) => setClipboardSync(e.target.checked)}
          />
          Enable clipboard synchronization (text only)
        </label>
        <p className="hint">
          {clipboardActive
            ? `Syncing — sent ${clipboardSent}, received ${clipboardReceived} this session.`
            : clipboardSync
              ? 'Enabled — sync starts when the session connects.'
              : 'Off — nothing is read from or written to either clipboard.'}
        </p>
      </div>
      <div className="settings-section">
        <label className="settings-label">Signaling Server URL</label>
        <input
          type="text"
          value={signalingUrl}
          onChange={(e) => setSignalingUrl(e.target.value)}
          placeholder="http://localhost:3001"
          aria-label="Signaling server URL"
        />
        <p className="hint">
          Requires app restart to take effect. Default: http://localhost:3001
        </p>
      </div>
      <div className="settings-section">
        <label className="settings-label">STUN Servers</label>
        <input
          type="text"
          value={stunServers}
          onChange={(e) => setStunServers(e.target.value)}
          placeholder="stun:stun.l.google.com:19302"
          aria-label="STUN servers"
        />
        <p className="hint">
          Comma-separated STUN server URLs. Default: stun:stun.l.google.com:19302
        </p>
      </div>
    </section>
  );
}
