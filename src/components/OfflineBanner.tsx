import { useOnlineStatus } from '../lib/useOnlineStatus';

/** App-root banner, not a route — visible over any screen the instant the browser reports it has no network path, same idea as mobile's own offline handling. */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return <div className="offline-banner">No internet connection — messages will send once you're back online.</div>;
}
