/**
 * Web port of mobile's lib/sounds.ts — same bundled ringtone.wav (copied
 * into public/sounds/), a single reused looping <audio> element rather
 * than a fresh one per call so it can be paused/rewound when a call is
 * answered/declined instead of letting a loop iteration finish.
 * No speakerphone-toggle equivalent exists on web (browsers don't expose
 * earpiece-vs-speaker output routing to a page) — CallContext's web port
 * omits isSpeakerOn/toggleSpeaker entirely rather than faking a no-op.
 */
let ringtoneEl: HTMLAudioElement | null = null;

export function playRingtone() {
  if (!ringtoneEl) {
    ringtoneEl = new Audio('/sounds/ringtone.wav');
    ringtoneEl.loop = true;
  }
  ringtoneEl.currentTime = 0;
  ringtoneEl.play().catch(() => {});
}

export function stopRingtone() {
  ringtoneEl?.pause();
}
