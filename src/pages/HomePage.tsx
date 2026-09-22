import { ConnectionInput } from '../components/ConnectionInput.js';
import { ConnectionStatus } from '../components/ConnectionStatus.js';
import { DeviceIdCard } from '../components/DeviceIdCard.js';
import { RecentConnections } from '../components/RecentConnections.js';
import { SettingsPanel } from '../components/SettingsPanel.js';

/** Main screen composition. Page-level layout only; no business logic. */
export function HomePage() {
  return (
    <main className="layout">
      <header className="header">
        <h1>Lantern Remote</h1>
        <p>Open-source remote desktop — explicit consent required for every session.</p>
      </header>
      <div className="grid">
        <DeviceIdCard />
        <ConnectionInput />
        <ConnectionStatus />
        <RecentConnections />
        <SettingsPanel />
      </div>
      <footer className="footer">
        <span>Phase 1 skeleton — signaling, WebRTC, and remote input arrive in later phases.</span>
      </footer>
    </main>
  );
}
