import { create } from 'zustand';

export interface ConnectionHistoryEntry {
  deviceId: string;
  timestamp: number;
  role: 'client' | 'host';
  success: boolean;
}

interface HistoryState {
  history: ConnectionHistoryEntry[];
  addEntry: (entry: Omit<ConnectionHistoryEntry, 'timestamp'>) => void;
  clearHistory: () => void;
}

const HISTORY_KEY = 'lantern-connection-history';
const MAX_HISTORY_ENTRIES = 20;

/**
 * Load history from localStorage on initialization.
 */
function loadHistory(): ConnectionHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is ConnectionHistoryEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.deviceId === 'string' &&
          typeof entry.timestamp === 'number' &&
          (entry.role === 'client' || entry.role === 'host') &&
          typeof entry.success === 'boolean',
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Save history to localStorage.
 */
function saveHistory(history: ConnectionHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Connection history store (Phase 10).
 *
 * WHY: local-only history of recent connections for quick reconnection.
 * Never persisted to the server — entirely client-side via localStorage.
 */
export const useHistoryStore = create<HistoryState>((set) => ({
  history: loadHistory(),
  addEntry: (entry) =>
    set((state) => {
      const newEntry: ConnectionHistoryEntry = {
        ...entry,
        timestamp: Date.now(),
      };
      const updated = [newEntry, ...state.history]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_HISTORY_ENTRIES);
      saveHistory(updated);
      return { history: updated };
    }),
  clearHistory: () => {
    saveHistory([]);
    return set({ history: [] });
  },
}));
