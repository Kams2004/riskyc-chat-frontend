import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { config } from '../../lib/config';
import { playRingtone, stopRingtone } from '../../lib/sounds';
import { CallSignalingSocket, type CallIceCandidate, type CallInvite, type CallType } from './signaling';

// Same STUN-first, self-hosted-TURN-fallback setup as mobile's CallContext
// and web's own groupCallSignaling — turnServerUrl/turnUsername/turnCredential
// already exist in lib/config.ts from the group-calling work.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: config.turnServerUrl, username: config.turnUsername, credential: config.turnCredential },
];

export type CallQuality = 'auto' | 'low' | 'medium' | 'high';
type ResolvedQuality = 'low' | 'medium' | 'high';
const QUALITY_LEVELS: ResolvedQuality[] = ['low', 'medium', 'high'];

const QUALITY_PRESETS: Record<ResolvedQuality, { videoBitrate: number; videoScaleDown: number; audioBitrate: number }> = {
  low: { videoBitrate: 150_000, videoScaleDown: 4, audioBitrate: 20_000 },
  medium: { videoBitrate: 400_000, videoScaleDown: 2, audioBitrate: 32_000 },
  high: { videoBitrate: 1_200_000, videoScaleDown: 1, audioBitrate: 48_000 },
};

/** Same bitrate-cap/scale-down approach as mobile's applyQualityLevel — standard RTCRtpSender params, identical API shape in a browser. */
async function applyQualityLevel(pc: RTCPeerConnection, level: ResolvedQuality) {
  const preset = QUALITY_PRESETS[level];
  for (const sender of pc.getSenders()) {
    if (!sender.track) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{ active: true }];
      }
      if (sender.track.kind === 'video') {
        params.encodings[0].maxBitrate = preset.videoBitrate;
        params.encodings[0].scaleResolutionDownBy = preset.videoScaleDown;
      } else {
        params.encodings[0].maxBitrate = preset.audioBitrate;
      }
      await sender.setParameters(params);
    } catch (e) {
      console.warn('[CallContext] failed to apply quality level', e);
    }
  }
}

async function collectByteUsage(pc: RTCPeerConnection): Promise<{ bytesSent: number; bytesReceived: number }> {
  let bytesSent = 0;
  let bytesReceived = 0;
  try {
    const stats = await pc.getStats();
    stats.forEach((report: any) => {
      if (report.type === 'outbound-rtp' && typeof report.bytesSent === 'number') {
        bytesSent += report.bytesSent;
      } else if (report.type === 'inbound-rtp' && typeof report.bytesReceived === 'number') {
        bytesReceived += report.bytesReceived;
      }
    });
  } catch (e) {
    console.warn('[CallContext] failed to collect call stats', e);
  }
  return { bytesSent, bytesReceived };
}

export type CallState = 'idle' | 'outgoing-ringing' | 'incoming-ringing' | 'connected' | 'minimized';

export type IncomingCallInfo = { callId: string; fromUserId: string; type: CallType };
export type OutgoingCallInfo = { callId: string; toUserId: string; toUserName: string; type: CallType };

type CallContextValue = {
  callState: CallState;
  incomingCall: IncomingCallInfo | null;
  outgoingCall: OutgoingCallInfo | null;
  callType: CallType | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  connectedAt: number | null;
  startCall: (recipientId: string, recipientName: string, type: CallType) => Promise<void>;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  minimizeCall: () => void;
  restoreCall: () => void;
  qualityMode: CallQuality;
  effectiveQuality: ResolvedQuality;
  setQualityMode: (mode: CallQuality) => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}

/**
 * Web port of mobile's features/calls/CallContext.tsx — same state
 * machine, ICE-restart-on-failed-from-offering-side-only logic, and
 * adaptive-quality polling, using browser-native RTCPeerConnection/
 * getUserMedia instead of react-native-webrtc (near drop-in; same shapes).
 * Scope cuts vs. mobile, both deliberate (see joyful-tinkering-owl.md
 * Phase 3): no seedIncomingCallFromNotification (no OS push-notification
 * action-button system on web to seed from), no speakerphone toggle (no
 * earpiece-vs-speaker output routing exposed to a web page).
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const { userId, accessToken, displayName } = useAuth();
  const socketRef = useRef<CallSignalingSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const otherUserIdRef = useRef<string | null>(null);
  const pendingIceRef = useRef<CallIceCandidate[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  const pendingInviteRef = useRef<CallInvite | null>(null);
  const isOffererRef = useRef(false);

  const [qualityMode, setQualityModeState] = useState<CallQuality>('auto');
  const qualityModeRef = useRef<CallQuality>('auto');
  const [effectiveQuality, setEffectiveQualityState] = useState<ResolvedQuality>('medium');
  const effectiveQualityRef = useRef<ResolvedQuality>('medium');
  const prevQualityStatsRef = useRef<{ lost: number; sent: number } | null>(null);
  const consecutiveGoodPollsRef = useRef(0);

  const setEffectiveQuality = useCallback((level: ResolvedQuality) => {
    effectiveQualityRef.current = level;
    setEffectiveQualityState(level);
    if (pcRef.current) applyQualityLevel(pcRef.current, level);
  }, []);

  const setQualityMode = useCallback(
    (mode: CallQuality) => {
      qualityModeRef.current = mode;
      setQualityModeState(mode);
      if (mode !== 'auto') setEffectiveQuality(mode);
    },
    [setEffectiveQuality]
  );

  const [callState, setCallState] = useState<CallState>('idle');
  const callStateRef = useRef<CallState>('idle');
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallInfo | null>(null);
  const [callType, setCallType] = useState<CallType | null>(null);
  const callTypeRef = useRef<CallType | null>(null);
  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);

  const resetCallState = useCallback(() => {
    const pc = pcRef.current;
    const callId = activeCallIdRef.current;
    if (pc && callId) {
      collectByteUsage(pc).then(({ bytesSent, bytesReceived }) => {
        socketRef.current?.sendUsageReport({ callId, bytesSent, bytesReceived });
      });
    }
    stopRingtone();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    activeCallIdRef.current = null;
    otherUserIdRef.current = null;
    pendingIceRef.current = [];
    remoteDescriptionSetRef.current = false;
    pendingInviteRef.current = null;
    setCallState('idle');
    setIncomingCall(null);
    setOutgoingCall(null);
    setCallType(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setConnectedAt(null);
    qualityModeRef.current = 'auto';
    setQualityModeState('auto');
    effectiveQualityRef.current = 'medium';
    setEffectiveQualityState('medium');
    prevQualityStatsRef.current = null;
    consecutiveGoodPollsRef.current = 0;
  }, []);

  const attemptIceRestartRef = useRef<() => void>(() => {});

  const createPeerConnection = useCallback((toUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (!event.candidate || !activeCallIdRef.current) return;
      socketRef.current?.sendIce({
        callId: activeCallIdRef.current,
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (stream) setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (callStateRef.current !== 'minimized') {
          setCallState('connected');
        }
        setConnectedAt((prev) => prev ?? Date.now());
      } else if (pc.connectionState === 'failed') {
        attemptIceRestartRef.current();
      }
    };

    pcRef.current = pc;
    otherUserIdRef.current = toUserId;
    return pc;
  }, []);

  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const callId = activeCallIdRef.current;
    if (!pc || !callId || !isOffererRef.current) return;
    try {
      pc.restartIce();
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.sendRenegotiateOffer({ callId, sdpOffer: offer.sdp ?? '' });
    } catch (e) {
      console.warn('[CallContext] ICE restart failed', e);
    }
  }, []);
  attemptIceRestartRef.current = attemptIceRestart;

  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(
          new RTCIceCandidate({ candidate: candidate.candidate, sdpMid: candidate.sdpMid ?? undefined, sdpMLineIndex: candidate.sdpMLineIndex ?? undefined })
        );
      } catch (e) {
        console.warn('[CallContext] failed to add queued ICE candidate', e);
      }
    }
  }, []);

  const startCall = useCallback(
    async (recipientId: string, recipientName: string, type: CallType) => {
      if (!socketRef.current || callState !== 'idle') return;
      const callId = `${userId}-${Date.now()}`;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'VIDEO' });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(recipientId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      applyQualityLevel(pc, effectiveQualityRef.current);

      isOffererRef.current = true;
      activeCallIdRef.current = callId;
      setCallType(type);
      setOutgoingCall({ callId, toUserId: recipientId, toUserName: recipientName, type });
      setCallState('outgoing-ringing');
      playRingtone();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.sendInvite({ callId, toUserId: recipientId, type, sdpOffer: offer.sdp ?? '', callerName: displayName });
    },
    [callState, createPeerConnection, displayName, userId]
  );

  const acceptIncoming = useCallback(async () => {
    const invite = pendingInviteRef.current;
    if (!invite || !socketRef.current) return;
    stopRingtone();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: invite.type === 'VIDEO' });
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = createPeerConnection(invite.fromUserId);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    applyQualityLevel(pc, effectiveQualityRef.current);
    isOffererRef.current = false;

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: invite.sdpOffer }));
    remoteDescriptionSetRef.current = true;
    await flushPendingIce();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.sendAnswer({ callId: invite.callId, sdpAnswer: answer.sdp ?? '' });
    setIncomingCall(null);
    setCallState('connected');
    setConnectedAt(Date.now());
  }, [createPeerConnection, flushPendingIce]);

  const declineIncoming = useCallback(() => {
    const invite = pendingInviteRef.current;
    if (invite) {
      socketRef.current?.sendEnd({ callId: invite.callId, reason: 'declined' });
    }
    resetCallState();
  }, [resetCallState]);

  const endCall = useCallback(() => {
    if (activeCallIdRef.current) {
      socketRef.current?.sendEnd({ callId: activeCallIdRef.current, reason: 'hangup' });
    }
    resetCallState();
  }, [resetCallState]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((track) => (track.enabled = !next));
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isCameraOff;
    stream.getVideoTracks().forEach((track) => (track.enabled = !next));
    setIsCameraOff(next);
  }, [isCameraOff]);

  const minimizeCall = useCallback(() => {
    if (callStateRef.current === 'connected') setCallState('minimized');
  }, []);

  const restoreCall = useCallback(() => {
    if (callStateRef.current === 'minimized') setCallState('connected');
  }, []);

  useEffect(() => {
    if (!userId || !accessToken) return;

    const socket = new CallSignalingSocket(accessToken);
    socketRef.current = socket;

    socket.connect({
      onInvite: (invite) => {
        if (invite.callId === activeCallIdRef.current) return;
        if (callStateRef.current !== 'idle') {
          socket.sendEnd({ callId: invite.callId, reason: 'declined' });
          return;
        }
        pendingInviteRef.current = invite;
        activeCallIdRef.current = invite.callId;
        otherUserIdRef.current = invite.fromUserId;
        setCallType(invite.type);
        setIncomingCall({ callId: invite.callId, fromUserId: invite.fromUserId, type: invite.type });
        setCallState('incoming-ringing');
        playRingtone();
      },
      onAnswer: async (answer) => {
        const pc = pcRef.current;
        if (!pc || answer.callId !== activeCallIdRef.current) return;
        stopRingtone();
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer.sdpAnswer }));
        remoteDescriptionSetRef.current = true;
        await flushPendingIce();
        setOutgoingCall(null);
        setCallState('connected');
        setConnectedAt(Date.now());
      },
      onIce: async (ice) => {
        if (ice.callId !== activeCallIdRef.current) return;
        if (!remoteDescriptionSetRef.current || !pcRef.current) {
          pendingIceRef.current.push(ice);
          return;
        }
        try {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate({ candidate: ice.candidate, sdpMid: ice.sdpMid ?? undefined, sdpMLineIndex: ice.sdpMLineIndex ?? undefined })
          );
        } catch (e) {
          console.warn('[CallContext] failed to add ICE candidate', e);
        }
      },
      onEnd: (end) => {
        if (end.callId !== activeCallIdRef.current) return;
        resetCallState();
      },
      onRenegotiateOffer: async (offer) => {
        const pc = pcRef.current;
        if (!pc || offer.callId !== activeCallIdRef.current || isOffererRef.current) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer.sdpOffer }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current?.sendRenegotiateAnswer({ callId: offer.callId, sdpAnswer: answer.sdp ?? '' });
        } catch (e) {
          console.warn('[CallContext] failed to answer ICE-restart renegotiation', e);
        }
      },
      onRenegotiateAnswer: async (answer) => {
        const pc = pcRef.current;
        if (!pc || answer.callId !== activeCallIdRef.current || !isOffererRef.current) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer.sdpAnswer }));
        } catch (e) {
          console.warn('[CallContext] failed to apply ICE-restart answer', e);
        }
      },
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, userId]);

  useEffect(() => {
    if (callState !== 'connected') return;
    prevQualityStatsRef.current = null;
    consecutiveGoodPollsRef.current = 0;

    const interval = setInterval(async () => {
      if (qualityModeRef.current !== 'auto') return;
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let lost = 0;
        let sent = 0;
        stats.forEach((report: any) => {
          if (report.type === 'remote-inbound-rtp' && typeof report.packetsLost === 'number') {
            lost += report.packetsLost;
          }
          if (report.type === 'outbound-rtp' && typeof report.packetsSent === 'number') {
            sent += report.packetsSent;
          }
        });
        const prev = prevQualityStatsRef.current;
        prevQualityStatsRef.current = { lost, sent };
        if (!prev) return;

        const deltaSent = sent - prev.sent;
        const deltaLost = lost - prev.lost;
        if (deltaSent <= 0) return;
        const lossFraction = deltaLost / (deltaSent + deltaLost);

        const currentIndex = QUALITY_LEVELS.indexOf(effectiveQualityRef.current);
        if (lossFraction > 0.08 && currentIndex > 0) {
          consecutiveGoodPollsRef.current = 0;
          setEffectiveQuality(QUALITY_LEVELS[currentIndex - 1]);
        } else if (lossFraction < 0.02) {
          consecutiveGoodPollsRef.current += 1;
          if (consecutiveGoodPollsRef.current >= 3 && currentIndex < QUALITY_LEVELS.length - 1) {
            consecutiveGoodPollsRef.current = 0;
            setEffectiveQuality(QUALITY_LEVELS[currentIndex + 1]);
          }
        } else {
          consecutiveGoodPollsRef.current = 0;
        }
      } catch (e) {
        console.warn('[CallContext] quality-adapt stats poll failed', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [callState, setEffectiveQuality]);

  const value: CallContextValue = {
    callState,
    incomingCall,
    outgoingCall,
    callType,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    connectedAt,
    startCall,
    acceptIncoming,
    declineIncoming,
    endCall,
    toggleMute,
    toggleCamera,
    minimizeCall,
    restoreCall,
    qualityMode,
    effectiveQuality,
    setQualityMode,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
