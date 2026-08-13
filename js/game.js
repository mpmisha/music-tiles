// Game rules & state for Music Tiles — a real-time "falling tiles" board.
//
// Tiles fall from the top onto 4 static keys at the bottom; the player taps a
// key at the moment its tile lands (with grace). It stays calm for small kids:
// there is NO failure — a missed tile just slips past silently, and the song
// keeps going. Difficulty ramps by SONG: later songs fall faster, and the later
// half of the ladder sprinkles in two-finger "chord" tiles (a harmony tile in a
// second lane at the same instant) that get a little more frequent toward the
// fastest songs.
//
// This module owns the SCHEDULE (when/where each tile must be hit) and song
// progression. The real-time clock, falling animation and hit/miss detection
// live in scene.js, which mutates each tile's `resolved` / `missed` flags.
import { SONGS, noteToFreq, noteToMidi } from './music.js';
import { ProgressStore } from './storage.js';

const LANES = 4;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Tempo / fall-speed ramp across the whole song list (index 0 = slowest).
const SPB_SLOW = 0.60;   // seconds per beat, first song
const SPB_FAST = 0.34;   // seconds per beat, last song
const TRAVEL_SLOW = 2.40; // seconds a tile is visible falling, first song
const TRAVEL_FAST = 1.55; // ...last song
const LEAD_EXTRA = 0.35;  // extra pre-roll before the first tile's hit

// Two-finger double tiles: appear from the middle of the ladder onward.
const DOUBLE_BASE = 0.08; // chance at the midpoint song
const DOUBLE_MAX = 0.34;  // chance at the last song
const HARMONY_SEMITONES = -7; // a perfect fifth below — consonant in any key

const Phase = Object.freeze({
  ready: 'ready',            // waiting for the first tap (also unlocks audio)
  playing: 'playing',
  songComplete: 'songComplete',
  victory: 'victory',
});

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Build the fall schedule for a song at position `songIndex` within `songCount`.
// Returns { tiles, spb, travelTime, leadIn, duration, hasDoubles }.
// Each tile: { lane, freq, beats, label, hitTime, kind, pairId, resolved, missed }.
function buildSchedule(song, songIndex, songCount) {
  const frac = songCount > 1 ? songIndex / (songCount - 1) : 0;
  const spb = lerp(SPB_SLOW, SPB_FAST, frac);
  const travelTime = lerp(TRAVEL_SLOW, TRAVEL_FAST, frac);
  const leadIn = travelTime + LEAD_EXTRA;

  // Lane mapping: spread the song's pitch range across the 4 lanes so falling
  // tiles trace the melody's shape (low notes left, high notes right).
  const midis = song.notes.map((n) => noteToMidi(n[0]));
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  const span = Math.max(1, hi - lo);
  const laneOf = (midi) => {
    const l = Math.round(((midi - lo) / span) * (LANES - 1));
    return Math.max(0, Math.min(LANES - 1, l));
  };

  // Double-tile chance for this song (0 before the midpoint).
  const doubleStart = Math.floor(songCount / 2);
  let doubleChance = 0;
  if (songIndex >= doubleStart) {
    const denom = Math.max(1, songCount - 1 - doubleStart);
    const dfrac = (songIndex - doubleStart) / denom;
    doubleChance = lerp(DOUBLE_BASE, DOUBLE_MAX, Math.max(0, Math.min(1, dfrac)));
  }

  const tiles = [];
  let cumBeats = 0;
  let lastDoubleAt = -99;
  let pairSeq = 0;
  const n = song.notes.length;

  for (let i = 0; i < n; i++) {
    const [name, beats] = song.notes[i];
    const midi = midis[i];
    const lane = laneOf(midi);
    const hitTime = leadIn + cumBeats * spb;

    const melody = {
      lane,
      freq: noteToFreq(name),
      beats,
      label: name.replace(/\d/, ''),
      hitTime,
      kind: 'melody',
      pairId: null,
      resolved: false,
      missed: false,
    };
    tiles.push(melody);

    // Maybe add a harmony tile for a two-finger chord. Keep them off the first
    // and last couple of notes, and never back-to-back, so they read clearly.
    const eligible = i >= 2 && i < n - 2 && (i - lastDoubleAt) >= 2;
    if (doubleChance > 0 && eligible && Math.random() < doubleChance) {
      const hMidi = midi + HARMONY_SEMITONES;
      let hLane = laneOf(hMidi);
      if (hLane === lane) {
        // Nudge to a distinct lane so both keys are visibly separate.
        hLane = lane > 0 ? lane - 1 : lane + 1;
      }
      const pairId = ++pairSeq;
      melody.pairId = pairId;
      tiles.push({
        lane: hLane,
        freq: midiToFreq(hMidi),
        beats,
        label: NOTE_NAMES[((hMidi % 12) + 12) % 12],
        hitTime,
        kind: 'harmony',
        pairId,
        resolved: false,
        missed: false,
      });
      lastDoubleAt = i;
    }

    cumBeats += beats;
  }

  const lastHit = tiles.length ? Math.max(...tiles.map((t) => t.hitTime)) : leadIn;
  const duration = lastHit + travelTime + 0.4; // tail so the last tile falls fully
  const hasDoubles = tiles.some((t) => t.kind === 'harmony');

  return { tiles, spb, travelTime, leadIn, duration, hasDoubles };
}

class MusicGame {
  constructor() {
    this.songCount = SONGS.length;
    this.lanes = LANES;
    this.songIndex = 0;
    this.tiles = [];
    this.travelTime = TRAVEL_SLOW;
    this.leadIn = 0;
    this.duration = 0;
    this.hasDoubles = false;
    this.phase = Phase.ready;
  }

  get song() { return SONGS[this.songIndex % this.songCount]; }
  get songNumber() { return (this.songIndex % this.songCount) + 1; }
  get total() { return this.tiles.length; }
  get noteCount() { return this.song.notes.length; }

  reset(fromStart) {
    this.songIndex = fromStart ? 0 : ProgressStore.song;
    if (this.songIndex >= this.songCount) this.songIndex = 0;
    this.loadSong();
  }

  loadSong() {
    const sched = buildSchedule(this.song, this.songIndex, this.songCount);
    this.tiles = sched.tiles;
    this.travelTime = sched.travelTime;
    this.leadIn = sched.leadIn;
    this.duration = sched.duration;
    this.hasDoubles = sched.hasDoubles;
    this.phase = Phase.ready;
    ProgressStore.song = this.songIndex % this.songCount;
  }

  // Begin the falling clock (called from the first tap of the ready state).
  start() {
    if (this.phase === Phase.ready) this.phase = Phase.playing;
  }

  // The nearest still-unresolved tile in `lane` whose hit time is within `grace`
  // seconds of `elapsed`. Returns the tile or null. Used by scene.js on a tap.
  hittableTile(lane, elapsed, grace) {
    let best = null;
    let bestDelta = Infinity;
    for (const t of this.tiles) {
      if (t.lane !== lane || t.resolved || t.missed) continue;
      const delta = Math.abs(t.hitTime - elapsed);
      if (delta <= grace && delta < bestDelta) { best = t; bestDelta = delta; }
    }
    return best;
  }

  // Mark tiles whose hit window has fully passed as missed (silent, no penalty).
  sweepMissed(elapsed, missAfter) {
    for (const t of this.tiles) {
      if (!t.resolved && !t.missed && elapsed > t.hitTime + missAfter) t.missed = true;
    }
  }

  // Song is over once the clock passes the tail.
  isComplete(elapsed) { return elapsed >= this.duration; }

  // Transition to the end phase; returns 'victory' | 'songComplete'.
  finish() {
    const last = this.songIndex + 1 >= this.songCount;
    this.phase = last ? Phase.victory : Phase.songComplete;
    return last ? 'victory' : 'songComplete';
  }

  advanceSong() {
    this.songIndex = (this.songIndex + 1) % this.songCount;
    this.loadSong();
  }

  restartFromStart() { this.reset(true); }

  restartSong() { this.loadSong(); }
}

export { MusicGame, Phase, LANES, buildSchedule };
