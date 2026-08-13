// Synthesized sound for Music Tiles. Web Audio only — nothing loaded from disk.
// Besides the short UI cues, this exposes noteFreq() playback so tapping a tile
// plays the next note of the melody (a soft piano-ish tone).

const CUES = {
  wrong: { notes: [[196, 0.10]], volume: 0.18 },
  button: { notes: [[880, 0.05]], volume: 0.3 },
  levelUp: {
    notes: [[523.25, 0.09], [659.25, 0.09], [783.99, 0.09], [1046.5, 0.1], [1318.51, 0.24]],
    volume: 0.5,
  },
  win: {
    notes: [[523.25, 0.12], [659.25, 0.12], [783.99, 0.12], [1046.5, 0.14],
      [1318.51, 0.14], [1567.98, 0.28]],
    volume: 0.5,
  },
};

class SoundPlayer {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
  }

  // Must be called from a user gesture to satisfy autoplay policies.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name) {
    if (!this.settings.isSoundEnabled) return;
    this.unlock();
    if (!this.ctx) return;
    const cue = CUES[name];
    if (!cue) return;
    let when = this.ctx.currentTime;
    for (const [freq, duration] of cue.notes) {
      this.scheduleNote(freq, duration, when, cue.volume, 'sine');
      when += duration;
    }
  }

  // Play a single melody note (used when a tile is tapped). A triangle wave with
  // a little octave gives a soft, bell/piano-ish timbre that's gentle on ears.
  playNote(freq, duration = 0.5) {
    if (!this.settings.isSoundEnabled) return;
    this.unlock();
    if (!this.ctx || !freq) return;
    this.scheduleNote(freq, Math.max(0.18, duration), this.ctx.currentTime, 0.5, 'triangle');
  }

  scheduleNote(freq, duration, startTime, volume, type = 'sine') {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const attack = 0.006;
    const peak = volume * 0.85;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + Math.min(attack, duration));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    const fundamental = ctx.createOscillator();
    fundamental.type = type;
    fundamental.frequency.setValueAtTime(freq, startTime);

    const octave = ctx.createOscillator();
    octave.type = 'sine';
    octave.frequency.setValueAtTime(freq * 2, startTime);
    const octaveGain = ctx.createGain();
    octaveGain.gain.setValueAtTime(0.22, startTime);

    fundamental.connect(gain);
    octave.connect(octaveGain).connect(gain);

    fundamental.start(startTime);
    octave.start(startTime);
    fundamental.stop(startTime + duration + 0.03);
    octave.stop(startTime + duration + 0.03);
  }
}

// Light haptic feedback via the Vibration API (Android/Chrome; iOS ignores it).
class Haptics {
  constructor(settings) {
    this.settings = settings;
  }
  vibrate(pattern) {
    if (!this.settings.areHapticsEnabled) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }
  tap() { this.vibrate(10); }
  wrong() { this.vibrate([0, 18, 40, 18]); }
  levelUp() { this.vibrate(24); }
  win() { this.vibrate([0, 30, 60, 30, 60, 40]); }
}

export { SoundPlayer, Haptics };
