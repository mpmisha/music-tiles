# Music Tiles

A calm "play the tune" tile game for little kids, part of the
[Playground](https://mpmisha.github.io/playground/) hub.

Tiles **fall from the top** onto **4 static keys** at the bottom. Tap a key at the
moment its tile lands on it (with a generous grace window) and it plays the next
note — so hitting them in time actually **plays the song**, as if you're playing
the four keys yourself. Tiles are spaced by each note's real rhythm.

It stays gentle for small kids:

- **Unloseable** — a missed tile just slips past with a soft dim (no sound, no
  lives, no scary game-over). The song always finishes and ends softly.
- **Difficulty ramps by song**: song 1 is slow, and each next song falls a little
  faster.
- **Two-finger chords**: in the harder half of the list, some beats drop **two
  tiles at once** in different lanes — tap both keys together for a little chord.
  (Missing one is still fine — nothing punishes you.)
- Optional **note letters** on the tiles as a learning aid.
- Sounds are synthesized with the Web Audio API — no audio files, fully offline.
- Installable PWA. Shared Sound / Vibration settings with the Playground hub.
- English + Hebrew (RTL) chrome.

## Songs

15 tunes, ordered easy → harder. All are either **original** melodies written for
this game or **traditional / public-domain** pieces (nursery, folk, classical,
holiday) — e.g. Twinkle Twinkle, Mary Had a Little Lamb, This Old Man, Yankee
Doodle, Oh! Susanna, Old MacDonald, Ode to Joy, Für Elise, Jingle Bells, Can-Can,
plus originals "Sunny Skip" and "Starlight Pop". **No copyrighted pop-song
melodies are used** — those are protected as compositions.

## Play locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Add to Home Screen

Open the live site on your phone and use **Share → Add to Home Screen** to
install it as a standalone app that works offline.

## Credits

All melodies are original or traditional / public domain, transcribed as note
sequences in `js/music.js` (each tagged `origin`). No copyrighted audio is
bundled.
