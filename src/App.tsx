import { useEffect } from 'react';
import { HomePage } from './pages/HomePage.js';
import { getDeviceId, getAppInfo } from './services/lanternBridge.js';
import { useDeviceStore } from './stores/deviceStore.js';

/**
 * Root component: owns no business logic beyond bootstrapping
 * device/app info from the secure preload bridge into Zustand.
 */
export function App() {
  const setDeviceId = useDeviceStore((s) => s.setDeviceId);
  const setLoading = useDeviceStore((s) => s.setLoading);
  const setError = useDeviceStore((s) => s.setError);

  useEffect(() => {
    let cancelled = false;
    async function boot(): Promise<void> {
      setLoading(true);
      try {
        const [deviceId, info] = await Promise.all([getDeviceId(), getAppInfo()]);
        if (cancelled) return;
        setDeviceId(deviceId);
        // App info is currently display-only; stored for Phase 10 diagnostics.
        console.log(`[renderer] ${info.version} on ${info.platform}`);
      } catch (error) {
        if (cancelled) return;
        setError(error instanceof Error ? error.message : 'Failed to initialize');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [setDeviceId, setLoading, setError]);

  return <HomePage />;
}
