import { create } from 'zustand';

interface DeviceState {
  deviceId: string;
  loading: boolean;
  error: string | null;
  setDeviceId: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/** Own device identity + bootstrap status. Populated via preload bridge. */
export const useDeviceStore = create<DeviceState>((set) => ({
  deviceId: '··· ··· ···',
  loading: true,
  error: null,
  setDeviceId: (deviceId) => set({ deviceId, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
