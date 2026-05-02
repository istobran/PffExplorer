# DF1 Menu Audio

These WAV files were extracted from `/Users/BangZ/Downloads/Delta Force/Dfbase.pff`.

All files are RIFF PCM, mono, 8-bit, 22050 Hz.

- `menubtn1.wav`: package/resource selection sound.
- `click9.wav`: generic UI hover and press sound.
- `beep1.wav`: mission map/briefing link selection sound.
- `beep2.wav`: mission/campaign task switch sound.
- `menumono.wav`: mono main/menu background music.
- `whoosh2.wav`: horizontal menu/resource transition sound.
- `ttclick1.wav` through `ttclick9.wav`: randomized typewriter character ticks.
- `ttretur1.wav` through `ttretur3.wav`: randomized typewriter line/scroll returns.
- `ttreturn.wav`, `ttspace1.wav`, `ttspace2.wav`: adjacent original typewriter resources; currently kept for completeness.

Music notes:

- The game initializes menu music through `dfmusic.bin` and external `Dfmusic.sbf`.
- `dfmusic.bin` contains the `DFMenu` music script.
- `Dfmusic.sbf` is an `SBF0` streaming archive with 82 entries; entry 0 is `Dmaltgit`.
