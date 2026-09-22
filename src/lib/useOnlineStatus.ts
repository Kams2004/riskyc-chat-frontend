import { useEffect, useState } from 'react';

/** navigator.onLine + the online/offline window events — a plain, reliable browser signal for "does this device currently have a network path at all" (doesn't guarantee the backend itself is reachable, just that the device isn't offline). */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function onOnline() {
      setIsOnline(true);
    }
    function onOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
