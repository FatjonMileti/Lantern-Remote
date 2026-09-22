import { useState } from 'react';
import { useDeviceStore } from '../stores/deviceStore.js';

function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard unavailable'));
}

/** Displays this device's id with copy support. No business logic beyond display. */
export function DeviceIdCard() {
  const deviceId = useDeviceStore((s) => s.deviceId);
  const loading = useDeviceStore((s) => s.loading);
  const error = useDeviceStore((s) => s.error);
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await copyText(deviceId.replace(/\s/g, ''));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card" aria-label="Your device">
      <h2>Your Device</h2>
      <p className="device-id" aria-live="polite">
        {loading ? 'Resolving…' : deviceId}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="button" onClick={() => void handleCopy()} disabled={loading}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span className="pill pill-ready">Ready</span>
      </div>
      <p className="hint">Share this ID plus a temporary password (Phase 8) to allow access.</p>
    </section>
  );
}
