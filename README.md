# Music Tiles

A calm "play the tune" tile game for little kids, part of the
[Playground](https://mpmisha.github.io/playground/) hub.

Tap the glowing candy tile in each row and it plays the next note of a song —
work your way up and you play the whole melody. It's **self-paced**: nothing
falls on a timer and there's no scary game-over, so small kids can go as slow or
as fast as they like. A wrong tap just gives a gentle wobble.

- 8 traditional, public-domain nursery songs (Twinkle Twinkle, Mary Had a Little
  Lamb, Ode to Joy, Jingle Bells, and more), ordered short → longer.
- 4 lanes; each note sits in a lane by its pitch, so the tiles trace the tune.
- Optional **note letters** assist for early music learners.
- Sounds are synthesized with the Web Audio API — no audio files, fully offline.
- Installable PWA. Shared Sound / Vibration settings with the Playground hub.
- English + Hebrew (RTL) chrome.

## Play locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Add to Home Screen

Open the live site on your phone and use **Share → Add to Home Screen** to
install it as a standalone app that works offline.

## Credits

All melodies are traditional / public domain, transcribed as note sequences in
`js/music.js`. No copyrighted audio is bundled.
