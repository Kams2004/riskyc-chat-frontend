import { faMicrophone, faPaperPlane, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useRef, useState } from 'react';

import { Icon } from './Icon';
import { uploadMedia } from '../features/media/api';

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

// Sliding window of recent amplitude readings shown live while recording —
// matches mobile's VoiceRecorder (MAX_BARS=40, same sampling idea via
// AnalyserNode here instead of expo-audio's built-in metering).
const LIVE_BAR_COUNT = 40;

/**
 * Web's counterpart to mobile's VoiceRecorder — MediaRecorder instead of
 * expo-audio's recording API. Click to start (not hold — there's no
 * reliable "hold" gesture on a mouse the way there is a touch long-press),
 * click again (or the checkmark) to stop and send, the trash icon discards
 * without sending. Replaces the composer's text input while active,
 * matching WhatsApp's own recording-bar behavior — see onRecordingChange.
 */
export function VoiceRecorderButton({
  onSend,
  onRecordingChange,
}: {
  onSend: (objectKey: string, durationMs: number) => void;
  onRecordingChange: (isRecording: boolean) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopMetering() {
    if (meterRef.current) {
      clearInterval(meterRef.current);
      meterRef.current = null;
    }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      stopMetering();
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;
      setBars([]);

      // Live oscillating waveform while recording, same idea as mobile's
      // expo-audio metering — Web Audio has no built-in metering API, so an
      // AnalyserNode reading the same stream MediaRecorder is encoding
      // stands in for it. RMS of the time-domain samples (not FFT/frequency
      // data) gives a plain loudness level per tick, which is all a single
      // bar per moment needs.
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.fftSize);
        meterRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i++) {
            const normalized = (data[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / data.length);
          const level = Math.min(1, Math.max(0.05, rms * 4));
          setBars((prev) => [...prev.slice(-(LIVE_BAR_COUNT - 1)), level]);
        }, 100);
      } catch (e) {
        // Live waveform is a nice-to-have — a browser without AnalyserNode
        // support (or a rejected/unusual getUserMedia stream shape) should
        // still record and send fine, just without the animated bars.
        console.warn('[VoiceRecorderButton] live waveform unavailable', e);
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stopMetering();
        if (cancelledRef.current || chunksRef.current.length === 0) return;
        const durationMs = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-message.${extension}`, { type: blob.type });
        setIsUploading(true);
        try {
          const objectKey = await uploadMedia(file);
          onSend(objectKey, durationMs);
        } catch {
          window.alert('Could not send the voice message — please check your connection and try again.');
        } finally {
          setIsUploading(false);
        }
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      setIsRecording(true);
      onRecordingChange(true);
    } catch {
      window.alert('Microphone access is needed to record a voice message.');
    }
  }

  function stopAndSend() {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    onRecordingChange(false);
    mediaRecorderRef.current?.stop();
  }

  function cancelRecording() {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    onRecordingChange(false);
    mediaRecorderRef.current?.stop();
  }

  if (!isRecording) {
    return (
      <button type="button" className="icon-button" title="Record a voice message" onClick={startRecording} disabled={isUploading}>
        {isUploading ? '…' : <Icon icon={faMicrophone} />}
      </button>
    );
  }

  return (
    <div className="voice-recording-bar">
      <button type="button" className="icon-button destructive" title="Discard" onClick={cancelRecording}>
        <Icon icon={faTrash} />
      </button>
      <span className="voice-recording-dot" />
      <span className="voice-recording-timer">{formatSeconds(elapsedSeconds)}</span>
      <span className="voice-recording-waveform">
        {bars.map((level, i) => (
          <span key={i} className="voice-recording-waveform-bar" style={{ height: `${4 + level * 22}px` }} />
        ))}
      </span>
      <button type="button" className="composer-send" title="Send" onClick={stopAndSend}>
        <Icon icon={faPaperPlane} />
      </button>
    </div>
  );
}
