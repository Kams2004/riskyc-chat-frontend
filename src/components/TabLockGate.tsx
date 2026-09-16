import { useEffect, useRef, useState } from 'react';

import { CHANNEL_NAME, isTabLockSupported, newTabId, type TabLockMessage } from '../lib/tabLock';

type Status = 'active' | 'choosing' | 'locked';

const CLAIM_RESPONSE_WINDOW_MS = 350;

/**
 * Wraps the whole app: if RiskyC Chat is opened in a second browser tab
 * while already open in another, the new tab asks the user to choose
 * ("Continue here" vs "keep the other tab open") rather than silently
 * running two live WebSocket sessions side by side. See lib/tabLock.ts for
 * the wire protocol. No-ops harmlessly on a browser without BroadcastChannel.
 */
export function TabLockGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('active');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef(newTabId());
  const heardResponseRef = useRef(false);

  useEffect(() => {
    if (!isTabLockSupported()) return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    const myId = tabIdRef.current;

    channel.onmessage = (event: MessageEvent<TabLockMessage>) => {
      const msg = event.data;
      if (msg.from === myId) return;
      if (msg.type === 'claim') {
        // Someone else just opened a tab and is asking if anyone's already
        // active — reply only if I'm not myself sitting in a locked state.
        setStatus((current) => {
          if (current !== 'locked') channel.postMessage({ type: 'here', from: myId } satisfies TabLockMessage);
          return current;
        });
      } else if (msg.type === 'here') {
        heardResponseRef.current = true;
      } else if (msg.type === 'takeover') {
        setStatus('locked');
      }
    };

    channel.postMessage({ type: 'claim', from: myId } satisfies TabLockMessage);
    const timer = setTimeout(() => {
      if (heardResponseRef.current) setStatus('choosing');
    }, CLAIM_RESPONSE_WINDOW_MS);

    return () => {
      clearTimeout(timer);
      channel.close();
    };
  }, []);

  function continueHere() {
    channelRef.current?.postMessage({ type: 'takeover', from: tabIdRef.current } satisfies TabLockMessage);
    setStatus('active');
  }

  function keepOtherTab() {
    setStatus('locked');
  }

  function useThisTabInstead() {
    channelRef.current?.postMessage({ type: 'takeover', from: tabIdRef.current } satisfies TabLockMessage);
    setStatus('active');
  }

  if (status === 'choosing') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>RiskyC Chat is open in another tab</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Using it in two tabs at once can cause messages and calls to behave oddly. Which one do you want to keep active?
          </p>
          <button className="button" onClick={continueHere}>
            Continue here
          </button>
          <button className="link-button secondary" onClick={keepOtherTab}>
            Keep using the other tab
          </button>
        </div>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>This tab is paused</h2>
          <p style={{ color: 'var(--text-muted)' }}>RiskyC Chat is active in another tab right now.</p>
          <button className="button" onClick={useThisTabInstead}>
            Use RiskyC Chat here instead
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--surface)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 20,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 380,
  textAlign: 'center',
};
