// The song library for Music Tiles. All tunes are traditional / public-domain
// nursery melodies, transcribed here as note sequences (no audio files). Each
// note is a name; frequency is derived from equal temperament. Songs are
// ordered easy → longer so difficulty ramps gently, like the other games.

// note name (e.g. 'C4', 'F#5') -> MIDI number -> frequency (A4 = 440 Hz).
const SEMITONE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function noteToMidi(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return 60;
  return (parseInt(m[2], 10) + 1) * 12 + SEMITONE[m[1]];
}

function noteToFreq(name) {
  return 440 * Math.pow(2, (noteToMidi(name) - 69) / 12);
}

// A song: a list of notes. Each note is [name, beats]. beats is a relative
// duration (1 = a beat) used only to shape the played tone length; the board is
// self-paced so timing never punishes the player.
const SONGS = [
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle',
    notes: [
      ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    notes: [
      ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 2],
      ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['G4', 1], ['G4', 2],
      ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
      ['C4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'row',
    title: 'Row Your Boat',
    notes: [
      ['C4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 2],
      ['E4', 1], ['D4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['C5', 1], ['C5', 1], ['G4', 1], ['G4', 1], ['E4', 1], ['E4', 1], ['C4', 1], ['C4', 1],
      ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'frere',
    title: 'Are You Sleeping',
    notes: [
      ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1],
      ['E4', 1], ['F4', 1], ['G4', 2], ['E4', 1], ['F4', 1], ['G4', 2],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['C4', 1],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['C4', 1],
      ['C4', 1], ['G3', 1], ['C4', 2], ['C4', 1], ['G3', 1], ['C4', 2],
    ],
  },
  {
    id: 'london',
    title: 'London Bridge',
    notes: [
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['D4', 1], ['E4', 1], ['F4', 2], ['E4', 1], ['F4', 1], ['G4', 2],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['D4', 2], ['G4', 2], ['E4', 1], ['C4', 2],
    ],
  },
  {
    id: 'macdonald',
    title: 'Old MacDonald',
    notes: [
      ['G4', 1], ['G4', 1], ['G4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['B4', 1], ['B4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['D4', 1], ['G4', 1], ['G4', 1], ['G4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['B4', 1], ['B4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ],
  },
  {
    id: 'ode',
    title: 'Ode to Joy',
    notes: [
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 2],
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 1], ['C4', 2],
    ],
  },
  {
    id: 'jingle',
    title: 'Jingle Bells',
    notes: [
      ['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
      ['E4', 1], ['G4', 1], ['C4', 1], ['D4', 1], ['E4', 2],
      ['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
      ['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 2], ['G4', 2],
    ],
  },
];

export { SONGS, noteToFreq, noteToMidi };
