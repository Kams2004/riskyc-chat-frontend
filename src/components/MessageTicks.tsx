import type { MessageStatus } from '../features/messaging/api';

/** Same three-state tick as mobile: single check (sent), double check (delivered), double check in blue (read). */
export function MessageTicks({ status }: { status?: MessageStatus }) {
  if (!status) return null;
  if (status === 'SENT') {
    return (
      <svg width="14" height="10" viewBox="0 0 16 11" fill="none" className="bubble-ticks">
        <path d="M1 5.5L5 9.5L15 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const isRead = status === 'READ';
  return (
    <svg width="18" height="10" viewBox="0 0 20 11" fill="none" className={`bubble-ticks ${isRead ? 'read' : ''}`}>
      <path d="M1 5.5L5 9.5L15 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5.5L10 9.5L20 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
