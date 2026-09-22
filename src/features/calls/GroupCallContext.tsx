import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import type { Consumer, ConsumerOptions, Producer, Transport, TransportOptions } from 'mediasoup-client/types';

import { useAuth } from '../auth/AuthContext';
import { config } from '../../lib/config';
import { GroupCallSignalingSocket, type GroupCallType } from './groupCallSignaling';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: config.turnServerUrl, username: config.turnUsername, credential: config.turnCredential },
];

/** Same shape/levels as 1:1 calling's own quality control (see features/calls/CallContext.tsx) — applied to the video Producer's underlying RTCRtpSender here instead of a plain RTCPeerConnection's, since group calls go through mediasoup's SFU. */
export type GroupCallQuality = 'auto' | 'low' | 'medium' | 'high';
type ResolvedGroupQuality = 'low' | 'medium' | 'high';
const GROUP_QUALITY_LEVELS: ResolvedGroupQuality[] = ['low', 'medium', 'high'];
const GROUP_QUALITY_PRESETS: Record<ResolvedGroupQuality, { videoBitrate: number; audioBitrate: number }> = {
  low: { videoBitrate: 150_000, audioBitrate: 20_000 },
  medium: { videoBitrate: 400_000, audioBitrate: 32_000 },
  high: { videoBitrate: 1_200_000, audioBitrate: 48_000 },
};

async function applyGroupQualityLevel(producers: Producer[], level: ResolvedGroupQuality) {
  const preset = GROUP_QUALITY_PRESETS[level];
  for (const producer of producers) {
    const sender = producer.rtpSender;
    if (!sender) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{ active: true }];
      const maxBitrate = producer.kind === 'video' ? preset.videoBitrate : preset.audioBitrate;
      for (const encoding of params.encodings) encoding.maxBitrate = maxBitrate;
      await sender.setParameters(params);
    } catch (e) {
      console.warn('[GroupCallContext] failed to apply quality level', e);
    }
  }
}

export type GroupCallParticipant = {
  peerId: string;
  displayName: string;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
};

export type GroupCallState = 'idle' | 'connecting' | 'in-call';

type GroupCallContextValue = {
  groupCallState: GroupCallState;
  groupId: string | null;
  groupName: string | null;
  callType: GroupCallType | null;
  localStream: MediaStream | null;
  participants: GroupCallParticipant[];
  isMuted: boolean;
  isCameraOff: boolean;
  /** Starting client's own action — joins (creating the room if needed) AND fans out invites to the rest of the group. */
  startGroupCall: (groupId: string, groupName: string, memberIds: string[], callType: GroupCallType) => Promise<void>;
  /** Responding to an invite or tapping into an already-ongoing call — joins without re-inviting anyone. */
  joinGroupCall: (groupId: string, groupName: string, callType: GroupCallType) => Promise<void>;
  /** The in-call "Add participant" action — re-uses the same notifyInvite the initial call-start invite goes through, just fired again mid-call for whoever's newly picked. */
  inviteMoreParticipants: (memberIds: string[]) => void;
  leaveGroupCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  qualityMode: GroupCallQuality;
  effectiveQuality: ResolvedGroupQuality;
  setQualityMode: (mode: GroupCallQuality) => void;
};

const GroupCallContext = createContext<GroupCallContextValue | null>(null);

export function useGroupCall(): GroupCallContextValue {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error('useGroupCall must be used within GroupCallProvider');
  return ctx;
}

export function GroupCallProvider({ children }: { children: React.ReactNode }) {
  const { userId, accessToken, displayName } = useAuth();

  const socketRef = useRef<GroupCallSignalingSocket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const producersRef = useRef<Producer[]>([]);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const producerOwnerRef = useRef<Map<string, string>>(new Map());

  const [groupCallState, setGroupCallState] = useState<GroupCallState>('idle');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [callType, setCallType] = useState<GroupCallType | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, GroupCallParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [qualityMode, setQualityModeState] = useState<GroupCallQuality>('auto');
  const qualityModeRef = useRef<GroupCallQuality>('auto');
  const [effectiveQuality, setEffectiveQualityState] = useState<ResolvedGroupQuality>('medium');
  const effectiveQualityRef = useRef<ResolvedGroupQuality>('medium');
  const prevQualityStatsRef = useRef<{ lost: number; sent: number } | null>(null);
  const consecutiveGoodPollsRef = useRef(0);

  const setEffectiveQuality = useCallback((level: ResolvedGroupQuality) => {
    effectiveQualityRef.current = level;
    setEffectiveQualityState(level);
    void applyGroupQualityLevel(producersRef.current, level);
  }, []);

  const setQualityMode = useCallback(
    (mode: GroupCallQuality) => {
      qualityModeRef.current = mode;
      setQualityModeState(mode);
      if (mode !== 'auto') setEffectiveQuality(mode);
    },
    [setEffectiveQuality]
  );

  const upsertParticipant = useCallback((peerId: string, patch: Partial<GroupCallParticipant>) => {
    setParticipants((prev) => {
      const next = new Map(prev);
      const existing = next.get(peerId) ?? { peerId, displayName: peerId, audioTrack: null, videoTrack: null };
      next.set(peerId, { ...existing, ...patch });
      return next;
    });
  }, []);

  const resetState = useCallback(() => {
    for (const consumer of consumersRef.current.values()) consumer.close();
    consumersRef.current.clear();
    producerOwnerRef.current.clear();
    for (const producer of producersRef.current) producer.close();
    producersRef.current = [];
    sendTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current?.close();
    recvTransportRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    deviceRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
    setGroupCallState('idle');
    setGroupId(null);
    setGroupName(null);
    setCallType(null);
    setLocalStream(null);
    setParticipants(new Map());
    setIsMuted(false);
    setIsCameraOff(false);
    qualityModeRef.current = 'auto';
    setQualityModeState('auto');
    effectiveQualityRef.current = 'medium';
    setEffectiveQualityState('medium');
    prevQualityStatsRef.current = null;
    consecutiveGoodPollsRef.current = 0;
  }, []);

  const consumeProducer = useCallback(
    async (peerId: string, displayNameForPeer: string, producerId: string, kind: 'audio' | 'video') => {
      const socket = socketRef.current;
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!socket || !device || !recvTransport) return;

      producerOwnerRef.current.set(producerId, peerId);
      const response = await socket.request('consume', { producerId, rtpCapabilities: device.recvRtpCapabilities });
      const consumer = await recvTransport.consume(response as unknown as ConsumerOptions);
      consumersRef.current.set(consumer.id, consumer);
      await socket.request('resumeConsumer', { consumerId: consumer.id });

      upsertParticipant(peerId, {
        displayName: displayNameForPeer,
        ...(kind === 'audio' ? { audioTrack: consumer.track } : { videoTrack: consumer.track }),
      });
    },
    [upsertParticipant]
  );

  const doJoin = useCallback(
    async (targetGroupId: string, targetGroupName: string, targetCallType: GroupCallType, memberIdsToInvite: string[] | null) => {
      if (!userId || groupCallState !== 'idle') return;
      setGroupCallState('connecting');
      setGroupId(targetGroupId);
      setGroupName(targetGroupName);
      setCallType(targetCallType);

      const socket = new GroupCallSignalingSocket();
      socketRef.current = socket;

      await new Promise<void>((resolve, reject) => {
        socket.connect(
          accessToken,
          targetGroupId,
          displayName ?? 'Someone',
          targetCallType,
          {
            onPeerJoined: (data) => upsertParticipant(data.peerId, { displayName: data.displayName }),
            onPeerLeft: (data) => {
              setParticipants((prev) => {
                const next = new Map(prev);
                next.delete(data.peerId);
                return next;
              });
            },
            onNewProducer: (data) => {
              void consumeProducer(data.peerId, data.displayName, data.producerId, data.kind);
            },
            onProducerClosed: (data) => {
              const peerId = producerOwnerRef.current.get(data.producerId);
              producerOwnerRef.current.delete(data.producerId);
              if (!peerId) return;
              upsertParticipant(peerId, { audioTrack: null });
            },
          },
          resolve,
          (reason) => {
            console.warn('[GroupCallContext] signaling disconnected', reason);
            if (groupCallState !== 'idle') resetState();
          }
        );
        setTimeout(() => reject(new Error('Connection timed out')), 10000);
      });

      const capsResponse = await socket.request('getRouterRtpCapabilities');
      const device = new Device();
      await device.load({ routerRtpCapabilities: capsResponse.rtpCapabilities as Parameters<Device['load']>[0]['routerRtpCapabilities'] });
      deviceRef.current = device;

      const sendTransportResponse = await socket.request('createWebRtcTransport', { direction: 'send' });
      const sendTransport = device.createSendTransport({
        ...(sendTransportResponse as unknown as TransportOptions),
        iceServers: ICE_SERVERS,
      });
      sendTransportRef.current = sendTransport;
      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.request('connectWebRtcTransport', { transportId: sendTransport.id, dtlsParameters }).then(() => callback()).catch(errback);
      });
      sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        socket
          .request('produce', { transportId: sendTransport.id, kind, rtpParameters })
          .then((data) => callback({ id: data.id as string }))
          .catch(errback);
      });

      const recvTransportResponse = await socket.request('createWebRtcTransport', { direction: 'recv' });
      const recvTransport = device.createRecvTransport({
        ...(recvTransportResponse as unknown as TransportOptions),
        iceServers: ICE_SERVERS,
      });
      recvTransportRef.current = recvTransport;
      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.request('connectWebRtcTransport', { transportId: recvTransport.id, dtlsParameters }).then(() => callback()).catch(errback);
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: targetCallType === 'VIDEO' });
      localStreamRef.current = stream;
      setLocalStream(stream);

      for (const track of stream.getAudioTracks()) {
        const producer = await sendTransport.produce({ track });
        producersRef.current.push(producer);
      }
      if (targetCallType === 'VIDEO') {
        for (const track of stream.getVideoTracks()) {
          // Basic simulcast (see backend/sfu-service's mediasoupConfig.ts
          // comment) so weaker-connection participants get a lower layer
          // instead of everyone being forced to the sender's own bitrate.
          const producer = await sendTransport.produce({
            track,
            encodings: [
              { maxBitrate: 100_000, scalabilityMode: 'S1T3' },
              { maxBitrate: 300_000, scalabilityMode: 'S1T3' },
              { maxBitrate: 900_000, scalabilityMode: 'S1T3' },
            ],
          });
          producersRef.current.push(producer);
        }
      }

      await applyGroupQualityLevel(producersRef.current, effectiveQualityRef.current);

      const existing = await socket.request('getExistingProducers');
      const existingProducers = (existing.producers as Array<{ peerId: string; displayName: string; producerId: string; kind: 'audio' | 'video' }>) ?? [];
      for (const p of existingProducers) {
        await consumeProducer(p.peerId, p.displayName, p.producerId, p.kind);
      }

      if (memberIdsToInvite && memberIdsToInvite.length > 0) {
        socket
          .request('notifyInvite', { memberIds: memberIdsToInvite, callerName: displayName ?? 'Someone', callType: targetCallType })
          .catch((e) => console.warn('[GroupCallContext] notifyInvite failed', e));
      }

      setGroupCallState('in-call');
    },
    [accessToken, consumeProducer, displayName, groupCallState, resetState, upsertParticipant, userId]
  );

  const startGroupCall = useCallback(
    (targetGroupId: string, targetGroupName: string, memberIds: string[], targetCallType: GroupCallType) =>
      doJoin(targetGroupId, targetGroupName, targetCallType, memberIds),
    [doJoin]
  );

  const joinGroupCall = useCallback(
    (targetGroupId: string, targetGroupName: string, targetCallType: GroupCallType) =>
      doJoin(targetGroupId, targetGroupName, targetCallType, null),
    [doJoin]
  );

  const inviteMoreParticipants = useCallback((memberIds: string[]) => {
    const socket = socketRef.current;
    if (!socket || memberIds.length === 0 || !groupId) return;
    socket
      .request('notifyInvite', { memberIds, callerName: displayName ?? 'Someone', callType: callType ?? 'AUDIO' })
      .catch((e) => console.warn('[GroupCallContext] inviteMoreParticipants failed', e));
  }, [callType, displayName, groupId]);

  const leaveGroupCall = useCallback(() => {
    resetState();
  }, [resetState]);

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

  useEffect(() => {
    return () => {
      resetState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same auto-adaptive approach as 1:1 calling (features/calls/CallContext.tsx)
  // — per-interval packet-loss delta across every outgoing producer, fast
  // downgrade / slow upgrade, no-ops once the user picks a fixed level.
  useEffect(() => {
    if (groupCallState !== 'in-call') return;
    prevQualityStatsRef.current = null;
    consecutiveGoodPollsRef.current = 0;

    const interval = setInterval(async () => {
      if (qualityModeRef.current !== 'auto') return;
      let lost = 0;
      let sent = 0;
      try {
        for (const producer of producersRef.current) {
          const stats = await producer.getStats();
          stats.forEach((report: any) => {
            if (report.type === 'remote-inbound-rtp' && typeof report.packetsLost === 'number') lost += report.packetsLost;
            if (report.type === 'outbound-rtp' && typeof report.packetsSent === 'number') sent += report.packetsSent;
          });
        }
        const prev = prevQualityStatsRef.current;
        prevQualityStatsRef.current = { lost, sent };
        if (!prev) return;

        const deltaSent = sent - prev.sent;
        const deltaLost = lost - prev.lost;
        if (deltaSent <= 0) return;
        const lossFraction = deltaLost / (deltaSent + deltaLost);

        const currentIndex = GROUP_QUALITY_LEVELS.indexOf(effectiveQualityRef.current);
        if (lossFraction > 0.08 && currentIndex > 0) {
          consecutiveGoodPollsRef.current = 0;
          setEffectiveQuality(GROUP_QUALITY_LEVELS[currentIndex - 1]);
        } else if (lossFraction < 0.02) {
          consecutiveGoodPollsRef.current += 1;
          if (consecutiveGoodPollsRef.current >= 3 && currentIndex < GROUP_QUALITY_LEVELS.length - 1) {
            consecutiveGoodPollsRef.current = 0;
            setEffectiveQuality(GROUP_QUALITY_LEVELS[currentIndex + 1]);
          }
        } else {
          consecutiveGoodPollsRef.current = 0;
        }
      } catch (e) {
        console.warn('[GroupCallContext] quality-adapt stats poll failed', e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [groupCallState, setEffectiveQuality]);

  const value: GroupCallContextValue = {
    groupCallState,
    groupId,
    groupName,
    callType,
    localStream,
    participants: [...participants.values()],
    isMuted,
    isCameraOff,
    startGroupCall,
    joinGroupCall,
    inviteMoreParticipants,
    leaveGroupCall,
    toggleMute,
    toggleCamera,
    qualityMode,
    effectiveQuality,
    setQualityMode,
  };

  return <GroupCallContext.Provider value={value}>{children}</GroupCallContext.Provider>;
}
