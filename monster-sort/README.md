# Monster Sort

A drag-and-drop shape sorting game. Students feed pink shapes from the black bar to
the monster that matches. Level 1 sorts by sides: circles (curvy) go to the round
monster on the gray circle, squares (straight) go to the square monster on the gray square.

- A correct shape flies into the monster's mouth and a voice says "That's right!"
- A wrong shape goes back to the black bar and the voice says "Try again".
- When all 8 shapes are sorted, the voice says "Woo hoo, you did it!" and a
  **Play again** button appears. Every new game shuffles the shapes.

## Change the monsters, words and colours

Everything is in `js/config.js`:

1. Download each monster from Canva as a PNG with a transparent background and put it in `images`.
2. Change `monster:` for each target to the file name, for example `"images/round-monster.png"`.
3. If the mouth is not near the middle, change `mouth:` (x across, y down, from 0 to 1).
   Shapes fly into that point.
4. `phrases` holds what the voice says. To use your own recordings, put MP3 files in
   `sounds` and add them to `voiceFiles`.

The monsters that ship with the game are placeholders until the Canva pictures arrive.

## Adding levels

`levels` in `js/config.js` is a list. Copy the whole Level 1 block, change the
monsters, what each one `accepts`, and the `pieces`. Built-in shapes: circle, square,
rectangle, triangle, oval, semicircle, hexagon, star, heart, diamond (or use a picture
with `image:`). With more than one level, a Level menu appears in Settings and a
**Next level** button appears after a win.

## Choices made where the spec was open

- A shape counts as sorted when it is dropped anywhere on the monster or its gray
  shape (the mouth is where it is drawn going in). The gray shapes have a dotted outline.
  Drop zones are generous for students with motor impairments.
- The voice is the device's built-in speech (iPad and Chromebook both have it). The game picks the most
  natural English voice the device has (Google voices on Chromebook; Premium or Enhanced voices on
  iPad, then Samantha) and skips novelty voices. Set `voiceName` in `js/config.js` to choose one.
  On iPad, download a better voice in Settings > Accessibility > Spoken Content > Voices > English.
  Recordings in `voiceFiles` replace it.

## Accessibility built in

- Three ways to play: drag, **tap a shape then tap a monster**, or keyboard
  (Tab to a shape, Enter, then Enter on a monster; arrow keys move between shapes or monsters,
  Escape puts a chosen shape back).
- VoiceOver (iPad) and ChromeVox (Chromebook) read "Pink circle", "Round monster, curvy sides",
  and every result. Turn off **Voice** in Settings for screen reader users if hearing both is too much.
- Switch scanning (Settings): shapes light up one at a time, then the monsters. Press a
  switch (Space or Enter) or tap anywhere on the game. Speed is adjustable.
- High contrast, volume, and movement effects (off automatically when the device asks for reduced motion).
- No timers. Settings are remembered on each device.

## Full screen

The **Full screen** button hides everything except an **Exit full screen** button.
On an iPad where Safari can't go full screen, the game explains **Add to Home Screen**,
which always opens full screen.

## Live address

https://gillyborg.github.io/accessiblegames/monster-sort/
