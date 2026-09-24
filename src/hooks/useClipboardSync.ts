import { useEffect } from 'react';
import { clipboardService } from '../services/ClipboardService.js';
import { useConnectionStore } from '../stores/connectionStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

/**
 * Clipboard sync lifecycle (Phase 9).
 *
 * WHY a hook: polling must run only while the session is `connected` AND
 * the opt-in setting is on — every other combination stops and resets
 * baselines, so toggling mid-session or disconnecting can never replay
 * stale text. All teardown paths funnel through status changes, so one
 * effect covers them.
 */
export function useClipboardSync(): boolean {
  const enabled = useSettingsStore((s) => s.clipboardSync);
  const status = useConnectionStore((s) => s.status);

  useEffect(() => {
    if (enabled && status === 'connected') {
      clipboardService.start();
    } else {
      clipboardService.stop();
    }
    return () => {
      clipboardService.stop();
    };
  }, [enabled, status]);

  return enabled && status === 'connected' && clipboardService.running;
}
