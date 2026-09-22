import { faMicrophone, faMicrophoneSlash, faPhoneSlash, faUserPlus, faVideo, faVideoSlash } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { useGroupCall, type GroupCallParticipant, type GroupCallQuality } from '../features/calls/GroupCallContext';
import { getGroup } from '../features/groups/api';
import { getUser } from '../features/users/api';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

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

const QUALITY_LABEL: Record<'low' | 'medium' | 'high', string> = { low: 'Low', medium: 'Medium', high: 'High' };

/** "Add participant" — lists the group's own members who aren't already on the call (by peerId === userId, see GroupCallContext's own doc comment on that equivalence), lets the host pick several, then fires them all through the same notifyInvite channel the initial call-start invite used. */
function AddParticipantModal({
  groupId,
  userId,
  participants,
  onClose,
  onInvite,
}: {
  groupId: string;
  userId: string | null;
  participants: GroupCallParticipant[];
  onClose: () => void;
  onInvite: (memberIds: string[]) => void;
}) {
  const [candidates, setCandidates] = useState<{ userId: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const inCall = new Set([userId, ...participants.map((p) => p.peerId)]);
    getGroup(groupId)
      .then(async (group) => {
        const missing = group.members.filter((m) => !inCall.has(m.userId));
        const resolved = await Promise.all(
          missing.map(async (m) => ({ userId: m.userId, name: (await getUser(m.userId).catch(() => null))?.displayName || 'Unknown' }))
        );
        setCandidates(resolved);
      })
      .finally(() => setIsLoading(false));
  }, [groupId, userId, participants]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Add participant</h3>
        {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}
        {!isLoading && candidates.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Everyone in this group is already on the call.</p>}
        {candidates.map((c) => (
          <div key={c.userId} className="conversation-row" style={{ borderBottom: 'none', borderRadius: 10, cursor: 'pointer' }} onClick={() => toggle(c.userId)}>
            <Avatar label={c.name} size={36} />
            <div className="conversation-row-title" style={{ flex: 1 }}>{c.name}</div>
            {selected.has(c.userId) && <span>✓</span>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="link-button secondary" onClick={onClose}>Cancel</button>
          <button
            className="link-button"
            disabled={selected.size === 0}
            onClick={() => {
              onInvite([...selected]);
              onClose();
            }}
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupCallOverlay() {
  const {
    groupCallState,
    groupId,
    groupName,
    callType,
    localStream,
    participants,
    isMuted,
    isCameraOff,
    leaveGroupCall,
    toggleMute,
    toggleCamera,
    inviteMoreParticipants,
    qualityMode,
    effectiveQuality,
    setQualityMode,
  } = useGroupCall();
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  if (groupCallState === 'idle') return null;

  const isVideo = callType === 'VIDEO';

  return (
    <div className="call-overlay">
      <div className="call-overlay-header">
        <div className="call-overlay-title">{groupName ?? 'Group call'}</div>
        <div className="call-overlay-subtitle">
          {groupCallState === 'connecting' ? 'Connecting…' : `${participants.length + 1} in call`}
        </div>
        <div className="call-overlay-header-actions">
          {groupId && (
            <button className="call-overlay-icon-button" title="Add participant" onClick={() => setAddOpen(true)}>
              <Icon icon={faUserPlus} />
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button type="button" className="call-overlay-quality-button" onClick={() => setQualityMenuOpen((v) => !v)}>
              {qualityMode === 'auto' ? `Auto (${QUALITY_LABEL[effectiveQuality]})` : QUALITY_LABEL[effectiveQuality]}
            </button>
            {qualityMenuOpen && (
              <div className="bubble-menu" style={{ top: '110%', right: 0 }} onMouseLeave={() => setQualityMenuOpen(false)}>
                {(['auto', 'low', 'medium', 'high'] as GroupCallQuality[]).map((q) => (
                  <button key={q} onClick={() => { setQualityMode(q); setQualityMenuOpen(false); }}>
                    {q === 'auto' ? `Auto (${QUALITY_LABEL[effectiveQuality]})` : QUALITY_LABEL[q as 'low' | 'medium' | 'high']}
                  </button>
                ))}
              </div>
            )}
          </div>
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
          <Icon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
        </button>
        {isVideo && (
          <button className={`call-control-button ${isCameraOff ? 'active' : ''}`} onClick={toggleCamera} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
            <Icon icon={isCameraOff ? faVideoSlash : faVideo} />
          </button>
        )}
        <button className="call-control-button danger" onClick={leaveGroupCall} title="Leave call">
          <Icon icon={faPhoneSlash} />
        </button>
      </div>

      {addOpen && groupId && (
        <AddParticipantModal
          groupId={groupId}
          userId={null}
          participants={participants}
          onClose={() => setAddOpen(false)}
          onInvite={inviteMoreParticipants}
        />
      )}
    </div>
  );
}
