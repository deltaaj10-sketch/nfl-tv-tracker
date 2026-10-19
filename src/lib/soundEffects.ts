// Web Audio API Synthesizer for Touchdown and Bet Cashed Alerts
// 100% lightweight synthetic audio using Web Audio oscillators — zero external MP3/WAV files

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a custom synthesized audio broadcast alert
 * @param type 'touchdown' (stadium fanfare chord) | 'cashed' (cash-register casino chime)
 */
export function playBroadcastAlertSound(type: 'touchdown' | 'cashed'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === 'touchdown') {
    // Punchy 3-note stadium fanfare chord (G4 -> C5 -> E5/G5 power chord)
    const notes = [
      { freq: 392.0, start: 0, duration: 0.15, gain: 0.35 },      // G4
      { freq: 523.25, start: 0.14, duration: 0.18, gain: 0.4 },  // C5
      { freq: 659.25, start: 0.30, duration: 0.6, gain: 0.45 },   // E5 (major third)
      { freq: 783.99, start: 0.30, duration: 0.6, gain: 0.4 },    // G5 (fifth)
    ];

    notes.forEach(({ freq, start, duration, gain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Brass-like sawtooth wave with warmth filter
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + start);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now + start);
      filter.frequency.exponentialRampToValueAtTime(3200, now + start + 0.05);

      gainNode.gain.setValueAtTime(0.001, now + start);
      gainNode.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } else if (type === 'cashed') {
    // Casino / Cash-Register Chime: C5 -> E5 -> G5 -> C6 arpeggio with metallic shimmer
    const notes = [
      { freq: 523.25, time: 0.00 }, // C5
      { freq: 659.25, time: 0.08 }, // E5
      { freq: 783.99, time: 0.16 }, // G5
      { freq: 1046.5, time: 0.24 }, // C6
      { freq: 1318.5, time: 0.32 }, // E6
    ];

    notes.forEach(({ freq, time }, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      const isLast = idx >= notes.length - 2;
      const duration = isLast ? 0.65 : 0.35;
      const peakGain = isLast ? 0.38 : 0.25;

      gainNode.gain.setValueAtTime(0.001, now + time);
      gainNode.gain.linearRampToValueAtTime(peakGain, now + time + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + duration);
    });
  }
}
