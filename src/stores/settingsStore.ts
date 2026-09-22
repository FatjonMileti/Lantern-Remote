import { create } from 'zustand';

interface SettingsState {
  clipboardSync: boolean;
  setClipboardSync: (enabled: boolean) => void;
}

/** User settings (Phase 1 skeleton; clipboard defaults OFF per spec). */
export const useSettingsStore = create<SettingsState>((set) => ({
  clipboardSync: false,
  setClipboardSync: (clipboardSync) => set({ clipboardSync }),
}));
