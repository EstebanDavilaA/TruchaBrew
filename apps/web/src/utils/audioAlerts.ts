// M15_P1 spec §2.2 / §3.3 — Web Audio API synthesizer generating clean,
// pleasant alert tones without any external MP3/WAV network dependency.
// Pure browser API usage; no React, no side effects at import time.

export interface AudioAlertOptions {
  muted?: boolean;
  volume?: number; // 0..1, default 0.3
}

type AlertType = 'warning' | 'completion' | 'chime';

// One AudioContext is created lazily and reused — creating a new
// AudioContext per alert leaks resources and some browsers cap the number
// that may exist concurrently.
let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (sharedContext === null) {
    try {
      sharedContext = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedContext;
}

/** One tone: frequency (Hz), start offset (seconds from now), duration (seconds). */
interface ToneSpec {
  freqHz: number;
  startOffsetSec: number;
  durationSec: number;
}

// Distinct, pleasant tone sequences per alert type — no external assets.
const TONE_SEQUENCES: Record<AlertType, ToneSpec[]> = {
  // A single short, attention-getting beep for an upcoming/timed step (e.g. a hop addition).
  warning: [{ freqHz: 880, startOffsetSec: 0, durationSec: 0.18 }],
  // A short two-note descending "done" tone for a completed timer.
  completion: [
    { freqHz: 660, startOffsetSec: 0, durationSec: 0.15 },
    { freqHz: 440, startOffsetSec: 0.16, durationSec: 0.25 },
  ],
  // A gentle three-note ascending chime for stage transitions / start cues.
  chime: [
    { freqHz: 523.25, startOffsetSec: 0, durationSec: 0.12 },
    { freqHz: 659.25, startOffsetSec: 0.13, durationSec: 0.12 },
    { freqHz: 783.99, startOffsetSec: 0.26, durationSec: 0.3 },
  ],
};

/**
 * Plays a synthesized alert tone. Gracefully handles browser autoplay
 * restrictions and the absence of Web Audio entirely — never throws, since a
 * missed sound cue must never break the brew day flow.
 */
export function playStepAlert(type: AlertType, options?: AudioAlertOptions): void {
  if (options?.muted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Autoplay-restricted browsers start contexts 'suspended' until a user
    // gesture resumes them — resume best-effort, ignore rejection.
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const volume = options?.volume ?? 0.3;
    const tones = TONE_SEQUENCES[type];

    for (const tone of tones) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = tone.freqHz;

      const startAt = ctx.currentTime + tone.startOffsetSec;
      const endAt = startAt + tone.durationSec;

      // Short attack/release envelope avoids audible clicks.
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
      gain.gain.linearRampToValueAtTime(0, endAt);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(startAt);
      oscillator.stop(endAt);
    }
  } catch {
    // Never let a sound-cue failure break the brew day flow.
  }
}
