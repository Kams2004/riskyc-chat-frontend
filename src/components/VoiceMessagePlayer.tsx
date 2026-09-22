import { useEffect, useRef, useState } from 'react';

import { useMediaUrl } from '../features/media/useMediaUrl';
import { useInView } from '../lib/useInView';

const BAR_COUNT = 46;
const SPEEDS = [1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/** Used only while the real waveform is loading, and as a last-resort fallback if decoding ever fails (e.g. an unsupported codec) — never shown once real data is available. */
function pseudoWaveform(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) | 0;
    bars.push(0.15 + (Math.abs(h % 1000) / 1000) * 0.5);
  }
  return bars;
}

/**
 * Real per-message waveform — decodes the actual audio and takes the peak
 * amplitude per bucket, the same idea WhatsApp's own dense/thin waveform is
 * built from, instead of a fake per-message pattern. Cached by objectKey
 * (module-level, shared across every mounted player for the same message)
 * so re-mounting on scroll/list re-render never re-fetches or re-decodes.
 */
const waveformCache = new Map<string, number[]>();
const waveformInFlight = new Map<string, Promise<number[]>>();

async function loadRealWaveform(url: string, objectKey: string): Promise<number[]> {
  const cached = waveformCache.get(objectKey);
  if (cached) return cached;
  const inFlight = waveformInFlight.get(objectKey);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const AudioContextClass: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioContext.close().catch(() => {});

      const channel = audioBuffer.getChannelData(0);
      const bucketSize = Math.max(1, Math.floor(channel.length / BAR_COUNT));
      const bars: number[] = [];
      let peakOverall = 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        const start = i * bucketSize;
        const end = i === BAR_COUNT - 1 ? channel.length : start + bucketSize;
        let peak = 0;
        for (let j = start; j < end; j++) {
          const abs = Math.abs(channel[j]);
          if (abs > peak) peak = abs;
        }
        bars.push(peak);
        if (peak > peakOverall) peakOverall = peak;
      }

      const normalized =
        peakOverall > 0.001 ? bars.map((v) => 0.12 + (v / peakOverall) * 0.88) : pseudoWaveform(objectKey);
      waveformCache.set(objectKey, normalized);
      return normalized;
    } catch {
      const fallback = pseudoWaveform(objectKey);
      waveformCache.set(objectKey, fallback);
      return fallback;
    } finally {
      waveformInFlight.delete(objectKey);
    }
  })();
  waveformInFlight.set(objectKey, promise);
  return promise;
}

/** Web port of mobile's VoiceMessageBubble — HTML5 <audio> instead of expo-audio, click-to-seek on the waveform instead of a pan gesture. */
export function VoiceMessagePlayer({
  objectKey,
  durationMs,
  isMine,
}: {
  objectKey: string;
  durationMs: number | null;
  isMine: boolean;
}) {
  const { ref: containerRef, inView } = useInView<HTMLDivElement>();
  const url = useMediaUrl(inView ? objectKey : null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [bars, setBars] = useState<number[]>(() => waveformCache.get(objectKey) ?? pseudoWaveform(objectKey));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadRealWaveform(url, objectKey).then((real) => {
      if (!cancelled) setBars(real);
    });
    return () => {
      cancelled = true;
    };
  }, [url, objectKey]);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const remaining = isPlaying ? duration - currentTime : duration;
  const playedBars = Math.round(progress * BAR_COUNT);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  function seekToClientX(clientX: number) {
    const audio = audioRef.current;
    const el = waveformRef.current;
    if (!audio || !el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  return (
    <div className="voice-player" ref={containerRef}>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            if (isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}
      <button type="button" className={`voice-play-button ${isMine ? 'mine' : ''}`} onClick={togglePlay} disabled={!url}>
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="voice-track">
        <div className="voice-waveform" ref={waveformRef} onClick={(e) => seekToClientX(e.clientX)}>
          {bars.map((height, i) => (
            <div key={i} className={`voice-bar ${i < playedBars ? 'played' : ''}`} style={{ height: `${3 + height * 15}px` }} />
          ))}
          <div className={`voice-scrubber ${isMine ? 'mine' : ''}`} style={{ left: `${progress * 100}%` }} />
        </div>
        <div className="voice-meta">
          <span>{formatSeconds(remaining)}</span>
          <button type="button" className="voice-speed" onClick={cycleSpeed}>
            x{speed}
          </button>
        </div>
      </div>
    </div>
  );
}
