import { useMemo, useRef, useState } from 'react';

import { useMediaUrl } from '../features/media/useMediaUrl';

const BAR_COUNT = 28;
const SPEEDS = [1, 1.5, 2] as const;
type Speed = (typeof SPEEDS)[number];

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/** Same deterministic per-message "waveform" as mobile (a seeded pseudo-random bar pattern, not a real waveform analysis — see mobile's VoiceMessageBubble for the original) — same look for the same message on either platform. */
function pseudoWaveform(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = (h * 1103515245 + 12345) | 0;
    bars.push(0.25 + (Math.abs(h % 1000) / 1000) * 0.75);
  }
  return bars;
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
  const url = useMediaUrl(objectKey);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const bars = useMemo(() => pseudoWaveform(objectKey), [objectKey]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);
  const [speed, setSpeed] = useState<Speed>(1);

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
    <div className="voice-player">
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
        <div
          className="voice-waveform"
          ref={waveformRef}
          onClick={(e) => seekToClientX(e.clientX)}
        >
          {bars.map((height, i) => (
            <div key={i} className={`voice-bar ${i < playedBars ? 'played' : ''}`} style={{ height: `${4 + height * 16}px` }} />
          ))}
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
