// The song library for Music Tiles. Every tune is either an ORIGINAL melody
// composed for this game, or a TRADITIONAL / PUBLIC-DOMAIN piece (classical,
// folk, nursery, holiday). No copyrighted pop-song melodies are used — modern
// songs are protected as compositions, so we capture an upbeat feel with
// original tunes instead. Melodies are transcribed as note sequences (no audio
// files); frequency is derived from equal temperament.
//
// Songs are ordered easy → harder. The engine derives tempo from a song's
// position, so later songs play faster, and two-finger "chord" tiles appear in
// the later half of the list (see game.js).

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

// A song: { title, origin, notes }. origin ∈ {'original','public-domain'}.
// Each note is [name, beats]; beats is a relative duration (1 = a beat) used to
// space the falling tiles (rhythm) and shape the played tone length.
const SONGS = [
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle',
    origin: 'public-domain',
    notes: [
      ['C4', 1], ['C4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    origin: 'public-domain',
    notes: [
      ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 2],
      ['D4', 1], ['D4', 1], ['D4', 2], ['E4', 1], ['G4', 1], ['G4', 2],
      ['E4', 1], ['D4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
      ['C4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'oldman',
    title: 'This Old Man',
    origin: 'public-domain',
    notes: [
      ['G4', 1], ['E4', 1], ['G4', 1], ['G4', 1], ['E4', 1], ['G4', 1],
      ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 2],
      ['C4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['F4', 2],
      ['G4', 1], ['G4', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 1], ['C4', 2],
    ],
  },
  {
    id: 'row',
    title: 'Row Your Boat',
    origin: 'public-domain',
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
    origin: 'public-domain',
    notes: [
      ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1],
      ['E4', 1], ['F4', 1], ['G4', 2], ['E4', 1], ['F4', 1], ['G4', 2],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['C4', 1],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['C4', 1],
      ['C4', 1], ['G3', 1], ['C4', 2], ['C4', 1], ['G3', 1], ['C4', 2],
    ],
  },
  {
    id: 'yankee',
    title: 'Yankee Doodle',
    origin: 'public-domain',
    notes: [
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 1], ['E4', 1], ['D4', 2],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['C4', 2], ['B3', 2],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 1],
      ['B3', 1], ['G3', 1], ['A3', 1], ['B3', 1], ['C4', 2], ['C4', 2],
    ],
  },
  {
    id: 'london',
    title: 'London Bridge',
    origin: 'public-domain',
    notes: [
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['D4', 1], ['E4', 1], ['F4', 2], ['E4', 1], ['F4', 1], ['G4', 2],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['F4', 1], ['G4', 2],
      ['D4', 2], ['G4', 2], ['E4', 1], ['C4', 2],
    ],
  },
  {
    id: 'susanna',
    title: 'Oh! Susanna',
    origin: 'public-domain',
    notes: [
      ['C4', 1], ['D4', 1], ['E4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['E4', 1],
      ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['C4', 1], ['D4', 1], ['E4', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['E4', 1],
      ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
      ['F4', 1], ['F4', 1], ['A4', 1], ['A4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1],
      ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'macdonald',
    title: 'Old MacDonald',
    origin: 'public-domain',
    notes: [
      ['G4', 1], ['G4', 1], ['G4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['B4', 1], ['B4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
      ['D4', 1], ['G4', 1], ['G4', 1], ['G4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 2],
      ['B4', 1], ['B4', 1], ['A4', 1], ['A4', 1], ['G4', 2],
    ],
  },
  {
    id: 'sunnyskip',
    title: 'Sunny Skip',
    origin: 'original',
    notes: [
      ['C4', 1], ['E4', 1], ['G4', 1], ['E4', 1], ['C4', 1], ['E4', 1], ['G4', 2],
      ['D4', 1], ['F4', 1], ['A4', 1], ['F4', 1], ['D4', 1], ['F4', 1], ['A4', 2],
      ['E4', 1], ['G4', 1], ['C5', 1], ['G4', 1], ['E4', 1], ['G4', 1], ['C5', 2],
      ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  },
  {
    id: 'ode',
    title: 'Ode to Joy',
    origin: 'public-domain',
    notes: [
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['E4', 1], ['D4', 1], ['D4', 2],
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 1], ['C4', 1], ['D4', 1], ['E4', 1], ['D4', 1], ['C4', 1], ['C4', 2],
    ],
  },
  {
    id: 'furelise',
    title: 'Für Elise',
    origin: 'public-domain',
    notes: [
      ['E5', 1], ['D#5', 1], ['E5', 1], ['D#5', 1], ['E5', 1], ['B4', 1], ['D5', 1], ['C5', 1], ['A4', 2],
      ['C4', 1], ['E4', 1], ['A4', 1], ['B4', 2],
      ['E4', 1], ['G#4', 1], ['B4', 1], ['C5', 2],
      ['E5', 1], ['D#5', 1], ['E5', 1], ['D#5', 1], ['E5', 1], ['B4', 1], ['D5', 1], ['C5', 1], ['A4', 2],
    ],
  },
  {
    id: 'jingle',
    title: 'Jingle Bells',
    origin: 'public-domain',
    notes: [
      ['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
      ['E4', 1], ['G4', 1], ['C4', 1], ['D4', 1], ['E4', 2],
      ['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1], ['F4', 1], ['E4', 1], ['E4', 1], ['E4', 1],
      ['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 2], ['G4', 2],
    ],
  },
  {
    id: 'cancan',
    title: 'Can-Can',
    origin: 'public-domain',
    notes: [
      ['C5', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C5', 1], ['G4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['C4', 1], ['C4', 1],
      ['E4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1],
      ['D4', 1], ['D4', 1], ['E4', 1], ['F4', 1], ['G4', 1], ['F4', 1], ['E4', 1], ['D4', 1],
      ['C4', 2],
    ],
  },
  {
    id: 'starlight',
    title: 'Starlight Pop',
    origin: 'original',
    notes: [
      ['G4', 1], ['G4', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['C4', 1], ['D4', 1], ['E4', 1],
      ['F4', 1], ['F4', 1], ['G4', 1], ['F4', 1], ['D4', 1], ['B3', 1], ['C4', 1], ['D4', 1],
      ['E4', 1], ['G4', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['G4', 1],
      ['A4', 1], ['C5', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['D4', 1], ['C4', 2],
    ],
  },
];

export { SONGS, noteToFreq, noteToMidi };
