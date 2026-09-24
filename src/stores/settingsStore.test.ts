import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from './settingsStore.js';

/** Settings: clipboard defaults OFF, values persist across reloads. */
describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults clipboard sync to off', () => {
    expect(useSettingsStore.getState().clipboardSync).toBe(false);
  });

  it('toggles clipboard sync', () => {
    useSettingsStore.getState().setClipboardSync(true);
    expect(useSettingsStore.getState().clipboardSync).toBe(true);
    useSettingsStore.getState().setClipboardSync(false);
    expect(useSettingsStore.getState().clipboardSync).toBe(false);
  });

  it('persists values to localStorage', () => {
    useSettingsStore.getState().setClipboardSync(true);
    useSettingsStore.getState().setSignalingUrl('http://example:4000');
    useSettingsStore.getState().setStunServers('stun:example:3478');
    expect(localStorage.getItem('lantern-setting-clipboardSync')).toBe('true');
    expect(localStorage.getItem('lantern-setting-signalingUrl')).toBe('http://example:4000');
    expect(localStorage.getItem('lantern-setting-stunServers')).toBe('stun:example:3478');
  });
});
