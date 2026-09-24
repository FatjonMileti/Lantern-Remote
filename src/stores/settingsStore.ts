import { create } from 'zustand';

interface SettingsState {
  clipboardSync: boolean;
  signalingUrl: string;
  stunServers: string;
  setClipboardSync: (enabled: boolean) => void;
  setSignalingUrl: (url: string) => void;
  setStunServers: (servers: string) => void;
}

const DEFAULT_SIGNALING_URL = 'http://localhost:3001';
const DEFAULT_STUN_SERVERS = 'stun:stun.l.google.com:19302';

/**
 * Load settings from localStorage on initialization.
 */
function loadStoredSetting(key: string, defaultValue: string): string {
  try {
    const stored = localStorage.getItem(`lantern-setting-${key}`);
    if (stored === null) return defaultValue;
    return stored;
  } catch {
    return defaultValue;
  }
}

/**
 * Save settings to localStorage.
 */
function saveStoredSetting(key: string, value: string): void {
  try {
    localStorage.setItem(`lantern-setting-${key}`, value);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/** User settings (Phase 10: signaling URL, STUN servers, clipboard toggle). */
export const useSettingsStore = create<SettingsState>((set) => ({
  clipboardSync: loadStoredSetting('clipboardSync', 'false') === 'true',
  signalingUrl: loadStoredSetting('signalingUrl', DEFAULT_SIGNALING_URL),
  stunServers: loadStoredSetting('stunServers', DEFAULT_STUN_SERVERS),
  setClipboardSync: (clipboardSync) => {
    saveStoredSetting('clipboardSync', clipboardSync ? 'true' : 'false');
    set({ clipboardSync });
  },
  setSignalingUrl: (signalingUrl) => {
    saveStoredSetting('signalingUrl', signalingUrl);
    set({ signalingUrl });
  },
  setStunServers: (stunServers) => {
    saveStoredSetting('stunServers', stunServers);
    set({ stunServers });
  },
}));
