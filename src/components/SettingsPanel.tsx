import { useConnectionStore } from '../stores/connectionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

interface SettingsPanelProps {
  clipboardActive: boolean;
}

/** Settings (clipboard sync defaults OFF per spec; text-only, both directions). */
export function SettingsPanel({ clipboardActive }: SettingsPanelProps) {
  const clipboardSync = useSettingsStore((s) => s.clipboardSync);
  const setClipboardSync = useSettingsStore((s) => s.setClipboardSync);
  const clipboardSent = useConnectionStore((s) => s.clipboardSent);
  const clipboardReceived = useConnectionStore((s) => s.clipboardReceived);

  return (
    <section className="card" aria-label="Settings">
      <h2>Settings</h2>
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
      <p className="hint">
        Signaling URL:{' '}
        {import.meta.env.VITE_SIGNALING_SERVER_URL ?? 'http://localhost:3001 (default)'}
      </p>
    </section>
  );
}
