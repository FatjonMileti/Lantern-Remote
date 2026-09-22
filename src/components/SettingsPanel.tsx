import { useSettingsStore } from '../stores/settingsStore.js';

/** Settings placeholder (clipboard sync defaults OFF per spec). */
export function SettingsPanel() {
  const clipboardSync = useSettingsStore((s) => s.clipboardSync);
  const setClipboardSync = useSettingsStore((s) => s.setClipboardSync);

  return (
    <section className="card" aria-label="Settings">
      <h2>Settings</h2>
      <label className="row">
        <input
          type="checkbox"
          checked={clipboardSync}
          onChange={(e) => setClipboardSync(e.target.checked)}
        />
        Enable clipboard synchronization (text only, Phase 9)
      </label>
      <p className="hint">
        Signaling URL:{' '}
        {import.meta.env.VITE_SIGNALING_SERVER_URL ?? 'http://localhost:3001 (default)'}
      </p>
    </section>
  );
}
