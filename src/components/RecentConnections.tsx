import { useHistoryStore } from '../stores/historyStore.js';

interface RecentConnectionsProps {
  onConnectToRemote: (deviceId: string) => void;
}

/**
 * Recent connections panel showing local connection history.
 *
 * WHY: quick reconnection to previously connected devices.
 * History is stored locally in localStorage and never sent to the server.
 */
export function RecentConnections({ onConnectToRemote }: RecentConnectionsProps) {
  const history = useHistoryStore((s) => s.history);
  const clearHistory = useHistoryStore((s) => s.clearHistory);

  const handleConnect = (deviceId: string) => {
    onConnectToRemote(deviceId);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (history.length === 0) {
    return (
      <section className="card" aria-label="Recent connections">
        <h2>Recent Connections</h2>
        <p className="hint">No recent connections yet. History is stored locally.</p>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Recent connections">
      <div className="card-header">
        <h2>Recent Connections</h2>
        <button className="button-secondary" onClick={clearHistory}>
          Clear
        </button>
      </div>
      <ul className="history-list">
        {history.map((entry) => (
          <li key={`${entry.deviceId}-${entry.timestamp}`} className="history-item">
            <div className="history-info">
              <span className="history-device">{entry.deviceId}</span>
              <span className="history-meta">
                {entry.role === 'client' ? 'Connected to' : 'Connected from'} • {formatDate(entry.timestamp)}
              </span>
            </div>
            {entry.success && entry.role === 'client' && (
              <button
                className="tool-button"
                onClick={() => handleConnect(entry.deviceId)}
                aria-label={`Reconnect to ${entry.deviceId}`}
              >
                Connect
              </button>
            )}
            {!entry.success && <span className="history-failed">Failed</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
