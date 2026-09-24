import { beforeEach, describe, expect, it } from 'vitest';
import { useHistoryStore } from './historyStore.js';

/** History: capped, validated on load, local-only. */
describe('historyStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useHistoryStore.getState().clearHistory();
  });

  it('starts empty', () => {
    expect(useHistoryStore.getState().history).toEqual([]);
  });

  it('adds entries newest-first', () => {
    const { addEntry } = useHistoryStore.getState();
    addEntry({ deviceId: '111 111 111', role: 'client', success: true });
    addEntry({ deviceId: '222 222 222', role: 'host', success: false });
    const history = useHistoryStore.getState().history;
    expect(history).toHaveLength(2);
    expect(history[0]?.deviceId).toBe('222 222 222');
    expect(history[1]?.role).toBe('client');
  });

  it('caps entries at 20', () => {
    const { addEntry } = useHistoryStore.getState();
    for (let i = 0; i < 25; i += 1) {
      addEntry({ deviceId: `100 000 0${String(i).padStart(2, '0')}`, role: 'client', success: true });
    }
    expect(useHistoryStore.getState().history).toHaveLength(20);
  });

  it('clearHistory empties the store and storage', () => {
    const store = useHistoryStore.getState();
    store.addEntry({ deviceId: '111 111 111', role: 'client', success: true });
    store.clearHistory();
    expect(useHistoryStore.getState().history).toEqual([]);
    expect(localStorage.getItem('lantern-connection-history')).toBe('[]');
  });
});
