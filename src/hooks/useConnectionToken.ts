import { useEffect, useState } from 'react';
import {
  clearConnectionToken,
  getConnectionToken,
  regenerateConnectionToken,
} from '../services/lanternBridge.js';
import { useConnectionStore } from '../stores/connectionStore.js';

/** Host connection-code state: live code, ticking countdown, issue/revoke. */
export function useConnectionToken(): {
  code: string | null;
  remainingMs: number | null;
  blockedAttempts: number;
  ensure: () => void;
  regenerate: () => void;
  revoke: () => void;
} {
  const code = useConnectionStore((s) => s.tokenCode);
  const expiresAt = useConnectionStore((s) => s.tokenExpiresAt);
  const blockedAttempts = useConnectionStore((s) => s.blockedAttempts);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!code) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  // Expired codes vanish from the UI on their own; main enforces expiry too.
  useEffect(() => {
    if (code && expiresAt && expiresAt <= now) {
      useConnectionStore.getState().setToken(null, null);
    }
  }, [code, expiresAt, now]);

  function sync(info: { code: string; expiresAt: number }): void {
    useConnectionStore.getState().setToken(info.code, info.expiresAt);
    setNow(Date.now());
  }

  function ensure(): void {
    void getConnectionToken()
      .then(sync)
      .catch(() => {
        // Bridge unavailable (e.g. tests); UI simply shows no code.
      });
  }

  function regenerate(): void {
    void regenerateConnectionToken()
      .then(sync)
      .catch(() => undefined);
  }

  function revoke(): void {
    useConnectionStore.getState().setToken(null, null);
    void clearConnectionToken().catch(() => undefined);
  }

  const remainingMs = code && expiresAt ? Math.max(0, expiresAt - now) : null;
  return { code, remainingMs, blockedAttempts, ensure, regenerate, revoke };
}
