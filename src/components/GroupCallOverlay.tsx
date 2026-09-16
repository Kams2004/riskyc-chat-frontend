import { useEffect, useRef } from 'react';

import { useGroupCall, type GroupCallParticipant } from '../features/calls/GroupCallContext';
import { Avatar } from './Avatar';

/** One participant's tile — video fills it when available, otherwise an avatar placeholder (audio-only calls, or camera off). */
function ParticipantTile({ participant, isVideo }: { participant: GroupCallParticipant; isVideo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (participant.videoTrack) {
      el.srcObject = new MediaStream([participant.videoTrack]);
    } else {
      el.srcObject = null;
    }
  }, [participant.videoTrack]);

  return (
    <div className="call-tile">
      {isVideo && participant.videoTrack ? (
        <video ref={videoRef} autoPlay playsInline />
      ) : (
        <Avatar label={participant.displayName || '?'} size={56} />
      )}
      <span className="call-tile-name">{participant.displayName}</span>
    </div>
  );
}

function LocalTile({ stream, isVideo, isCameraOff, isMuted }: { stream: MediaStream | null; isVideo: boolean; isCameraOff: boolean; isMuted: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = isVideo && stream && !isCameraOff;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = showVideo ? stream : null;
  }, [showVideo, stream]);

  return (
    <div className="call-tile">
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline muted style={{ transform: 'scaleX(-1)' }} />
      ) : (
        <Avatar label="You" size={56} />
      )}
      <span className="call-tile-name">You{isMuted ? ' · muted' : ''}</span>
    </div>
  );
}

export function GroupCallOverlay() {
  const { groupCallState, groupName, callType, localStream, participants, isMuted, isCameraOff, leaveGroupCall, toggleMute, toggleCamera } =
    useGroupCall();

  if (groupCallState === 'idle') return null;

  const isVideo = callType === 'VIDEO';

  return (
    <div className="call-overlay">
      <div className="call-overlay-header">
        <div className="call-overlay-title">{groupName ?? 'Group call'}</div>
        <div className="call-overlay-subtitle">
          {groupCallState === 'connecting' ? 'Connecting…' : `${participants.length + 1} in call`}
        </div>
      </div>

      <div className="call-grid">
        <LocalTile stream={localStream} isVideo={isVideo} isCameraOff={isCameraOff} isMuted={isMuted} />
        {participants.map((p) => (
          <ParticipantTile key={p.peerId} participant={p} isVideo={isVideo} />
        ))}
      </div>

      <div className="call-controls">
        <button className={`call-control-button ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        {isVideo && (
          <button className={`call-control-button ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
            {isCameraOff ? '📷' : '🎥'}
          </button>
        )}
        <button className="call-control-button danger" onClick={leaveGroupCall} title="Leave call">
          ✕
        </button>
      </div>
    </div>
  );
}
