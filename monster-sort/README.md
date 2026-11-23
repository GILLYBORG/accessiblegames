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
4. Optional: add `monsterClosed:` with the same monster's mouth shut (same size and position).
   The monster then goes chomp, chomp whenever it eats a shape.
5. `phrases` holds what the voice says. To use your own recordings, put MP3 files in
   `sounds` and add them to `voiceFiles`.

All four monsters are SG's Canva pictures. The round monster also has a closed-mouth picture.

## Score

A star score in the top-left corner of the game adds 100 points for each correct answer
(change `pointsPerCorrect` in `js/config.js`). New game and Play again start it at 0;
Next level keeps the score going. Screen readers hear the score after each correct answer.

## Levels

1. **Curvy or straight**: pink circles go to the round monster, pink squares to the square monster.
2. **Red or blue**: 2 red squares and 2 red triangles go to the red monster, 2 blue rectangles and
   2 blue circles go to the blue monster. Both monsters sit on the same gray rounded square, so the
   backing shape gives no hint. The monsters are placeholders until SG's red and blue monsters arrive.

Moving between levels:
- After finishing a level, a **Next level** button appears next to **Play again**.
- Settings has a **Level** menu.
- A link can open a level directly: `.../monster-sort/?level=2`.
- Each device remembers the last level played.

To add a level, copy a whole level block in `js/config.js` and change the monsters, what each
one `accepts` (shapes like `"circle"` or colours like `"red"`), and the `pieces` (shape, colour,
count). Built-in shapes: circle, square, rectangle, triangle, oval, semicircle, hexagon, star,
heart, diamond (or use a picture with `image:`). Colours live in `colors`.

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
