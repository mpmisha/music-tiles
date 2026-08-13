// Game rules & state for Music Tiles. Self-paced "play the tune" board: each
// note of the song is one tile in one of 4 lanes; tapping the correct lane for
// the current tile plays that note and advances. There is no failure — a wrong
// tap just wobbles and plays a soft cue — so it stays calm for small kids.
import { SONGS, noteToFreq, noteToMidi } from './music.js';
import { ProgressStore } from './storage.js';

const LANES = 4;

const Phase = Object.freeze({
  playing: 'playing',
  songComplete: 'songComplete',
  victory: 'victory',
});

// Map a note's pitch to a lane. We spread the song's pitch range across the 4
// lanes (low notes left, high notes right) so the falling tiles trace the
// melody's shape — pretty and a little bit musical/educational.
function buildRows(song) {
  const midis = song.notes.map((n) => noteToMidi(n[0]));
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  const span = Math.max(1, hi - lo);
  return song.notes.map((n, i) => {
    const midi = midis[i];
    let lane = Math.round(((midi - lo) / span) * (LANES - 1));
    lane = Math.max(0, Math.min(LANES - 1, lane));
    return {
      lane,
      name: n[0],
      label: n[0].replace(/\d/, ''), // letter only, e.g. 'C', 'F#'
      beats: n[1],
      freq: noteToFreq(n[0]),
    };
  });
}

class MusicGame {
  constructor() {
    this.songCount = SONGS.length;
    this.lanes = LANES;
    this.songIndex = 0;
    this.rows = [];
    this.pointer = 0;
    this.phase = Phase.playing;
  }

  get song() { return SONGS[this.songIndex % this.songCount]; }
  get songNumber() { return (this.songIndex % this.songCount) + 1; }
  get total() { return this.rows.length; }

  reset(fromStart) {
    this.songIndex = fromStart ? 0 : ProgressStore.song;
    if (this.songIndex >= this.songCount) this.songIndex = 0;
    this.loadSong();
  }

  loadSong() {
    this.rows = buildRows(this.song);
    this.pointer = 0;
    this.phase = Phase.playing;
    ProgressStore.song = this.songIndex % this.songCount;
  }

  get currentRow() { return this.rows[this.pointer] || null; }

  // Attempt a tap in a lane. Returns:
  //   'hit'   — correct lane, advanced (row = the note just played)
  //   'wrong' — wrong lane, nothing advanced
  //   'songComplete' / 'victory' — the hit that finished the song
  tap(lane) {
    if (this.phase !== Phase.playing) return null;
    const row = this.currentRow;
    if (!row) return null;
    if (lane !== row.lane) return 'wrong';

    this.pointer += 1;
    if (this.pointer >= this.rows.length) {
      const last = this.songIndex + 1 >= this.songCount;
      this.phase = last ? Phase.victory : Phase.songComplete;
      return last ? 'victory' : 'songComplete';
    }
    return 'hit';
  }

  advanceSong() {
    this.songIndex = (this.songIndex + 1) % this.songCount;
    this.loadSong();
  }

  restartFromStart() {
    this.reset(true);
  }

  restartSong() {
    this.loadSong();
  }
}

export { MusicGame, Phase, LANES };
