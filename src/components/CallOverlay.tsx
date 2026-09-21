import { useEffect, useRef, useState } from 'react';

import { useCall, type CallQuality } from '../features/calls/CallContext';
import { UNRESOLVED_PERSON_PLACEHOLDER } from '../features/messaging/conversationId';
import { getUser } from '../features/users/api';
import { Avatar } from './Avatar';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function VideoEl({ stream, mirror, className }: { stream: MediaStream | null; mirror?: boolean; className: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} className={className} style={mirror ? { transform: 'scaleX(-1)' } : undefined} autoPlay playsInline muted={mirror} />;
}

function CallIconButton({ onClick, active, danger, children, title }: { onClick: () => void; active?: boolean; danger?: boolean; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      className={`call-control-button ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const QUALITY_LABEL: Record<'low' | 'medium' | 'high', string> = { low: 'Low', medium: 'Medium', high: 'High' };

/**
 * Web port of mobile's CallOverlay.tsx (1:1 calling UI) — full-screen
 * fixed overlay, same control set minus the speakerphone toggle (no web
 * equivalent, see CallContext's own note). Distinct component from the
 * existing group-call GroupCallOverlay.tsx.
 */
export function CallOverlay() {
  const {
    callState,
    incomingCall,
    outgoingCall,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectedAt,
    acceptIncoming,
    declineIncoming,
    endCall,
    toggleMute,
    toggleCamera,
    minimizeCall,
    qualityMode,
    effectiveQuality,
    setQualityMode,
  } = useCall();

  const [callerName, setCallerName] = useState<string | null>(null);
  const [callerAvatar, setCallerAvatar] = useState<string | null>(null);
  const [outgoingAvatar, setOutgoingAvatar] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

  useEffect(() => {
    if (!incomingCall) {
      setCallerName(null);
      setCallerAvatar(null);
      return;
    }
    getUser(incomingCall.fromUserId)
      .then((user) => {
        setCallerName(user.displayName || UNRESOLVED_PERSON_PLACEHOLDER);
        setCallerAvatar(user.avatarObjectKey);
      })
      .catch(() => setCallerName(UNRESOLVED_PERSON_PLACEHOLDER));
  }, [incomingCall]);

  useEffect(() => {
    if (!outgoingCall) {
      setOutgoingAvatar(null);
      return;
    }
    getUser(outgoingCall.toUserId)
      .then((user) => setOutgoingAvatar(user.avatarObjectKey))
      .catch(() => setOutgoingAvatar(null));
  }, [outgoingCall]);

  useEffect(() => {
    if (!connectedAt) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  if (callState === 'idle' || callState === 'minimized') return null;

  const otherName = incomingCall ? callerName : outgoingCall?.toUserName ?? '';
  const otherAvatar = incomingCall ? callerAvatar : outgoingAvatar;
  const isVideo = callType === 'VIDEO';
  const showRemoteVideo = isVideo && callState === 'connected' && !!remoteStream;

  return (
    <div className="call-overlay">
      {callState === 'connected' && (
        <div className="call-overlay-topbar">
          <button type="button" className="call-overlay-icon-button" onClick={minimizeCall} title="Minimize">
            ▾
          </button>
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <button type="button" className="call-overlay-quality-button" onClick={() => setQualityMenuOpen((v) => !v)}>
              {qualityMode === 'auto' ? `Auto (${QUALITY_LABEL[effectiveQuality]})` : QUALITY_LABEL[effectiveQuality]}
            </button>
            {qualityMenuOpen && (
              <div className="bubble-menu" style={{ top: '110%', right: 0 }} onMouseLeave={() => setQualityMenuOpen(false)}>
                {(['auto', 'low', 'medium', 'high'] as CallQuality[]).map((q) => (
                  <button key={q} onClick={() => { setQualityMode(q); setQualityMenuOpen(false); }}>
                    {q === 'auto' ? `Auto (${QUALITY_LABEL[effectiveQuality]})` : QUALITY_LABEL[q as 'low' | 'medium' | 'high']}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRemoteVideo && <VideoEl stream={remoteStream} className="call-overlay-remote-video" />}

      {isVideo && callState === 'connected' && localStream && !isCameraOff && (
        <div className="call-overlay-pip">
          <VideoEl stream={localStream} mirror className="call-overlay-pip-video" />
        </div>
      )}

      {!showRemoteVideo && (
        <div className="call-overlay-center">
          <Avatar objectKey={otherAvatar} label={otherName || ''} size={110} />
          <div className="call-overlay-name">{otherName}</div>
          <div className="call-overlay-status">
            {callState === 'incoming-ringing' && (isVideo ? 'Incoming video call' : 'Incoming voice call')}
            {callState === 'outgoing-ringing' && 'Ringing…'}
            {callState === 'connected' && formatDuration(elapsed)}
          </div>
        </div>
      )}

      {callState === 'connected' && showRemoteVideo && <div className="call-overlay-timer">{formatDuration(elapsed)}</div>}

      <div className="call-overlay-controls">
        {callState === 'incoming-ringing' && (
          <>
            <CallIconButton onClick={declineIncoming} danger title="Decline">
              ✕
            </CallIconButton>
            <CallIconButton onClick={acceptIncoming} title="Accept">
              📞
            </CallIconButton>
          </>
        )}

        {callState === 'outgoing-ringing' && (
          <CallIconButton onClick={endCall} danger title="Cancel">
            ✕
          </CallIconButton>
        )}

        {callState === 'connected' && (
          <>
            <CallIconButton onClick={toggleMute} active={isMuted} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? '🔇' : '🎙'}
            </CallIconButton>
            {isVideo && (
              <CallIconButton onClick={toggleCamera} active={isCameraOff} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
                {isCameraOff ? '📷' : '🎥'}
              </CallIconButton>
            )}
            <CallIconButton onClick={endCall} danger title="End call">
              ✕
            </CallIconButton>
          </>
        )}
      </div>
    </div>
  );
}
