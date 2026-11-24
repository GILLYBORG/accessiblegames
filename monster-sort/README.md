# Monster Sort

A drag-and-drop shape sorting game. Students feed pink shapes from the black bar to
the monster that matches. Level 1 sorts by sides: circles (curvy) go to the round
monster on the gray circle, squares (straight) go to the square monster on the gray square.

- A correct shape flies into the monster's mouth and a voice says "That's right!"
- A wrong shape goes back to the black bar and the voice says "Try again".
- When all 8 shapes are sorted, the voice says "Woo hoo, you did it!" and a big gold message shows the score and a
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

SG's own recordings of "That's right!" (`sounds/thats-right.mp3`), "Try again" (`sounds/try-again.mp3`) and "Woo hoo, you did it!" (`sounds/woo-hoo.mp3`) play with the Regular voice style; Silly and Growly still use the computer voice.

All four monsters are SG's Canva pictures. The round and square monsters also have closed-mouth pictures.

## Voice style

Settings has a **Voice style** menu: **Regular** (the most natural voice on the device),
**Silly monster** (the same voice, pitched way up so the words stay clear) or **Growly monster**
(the same voice, lower and slower). Each device remembers the choice. To use your own recordings,
put MP3s in `sounds` and add them to `sillyVoiceFiles` or `growlyVoiceFiles` in `js/config.js`;
`sillyVoice` and `growlyVoice` set the pitch and speed.

## Score

A star score in the top-left corner of the game adds 100 points for each correct answer
(change `pointsPerCorrect` in `js/config.js`). Play again and Start over set it to 0;
Scramble shapes and Next level keep the score going. Screen readers hear the score after each correct answer.

## Levels

Each level shows its rule in a big gold banner centred at the top (it stays in full screen). Change
the words with `rule:` in each level in `js/config.js` (on Level 4, each rule has its own `rule:`).

1. **Curvy or straight**: pink circles go to the round monster, pink squares to the square monster.
2. **Red or blue**: 2 red squares and 2 red triangles go to the red monster, 2 blue rectangles and
   2 blue circles go to the blue monster. There are no gray shapes on this level, so
   only the colour matters (`backdrop: "none"`). The drop area around each monster is the same size,
   and lights up while a shape is chosen or dragged. A background picture can be added later.
3. **3 sides or 4 sides**: 8 pink shapes. Four triangles (regular, right, tall, wide) go to the
   triangle monster; four four-sided shapes (square, rectangle, diamond, trapezoid) go to
   the box monster. Both monsters (orange triangle, teal box) have open and closed-mouth pictures, so they chomp.
4. **Switch the rule**: a T-chart with a heading over each column and the big rule banner at the top. 8 shapes (red and blue, 3 and 4 corners) are sorted
   by colour first. When they are all sorted the rule changes to corners, the voice says
   "New rule! Sort by corners." and the same shapes come back to sort again. The win comes after both
   rules. A drop anywhere in a column counts. The pink round and square monsters are reused here.

   To make another rule switch level, copy this level in `js/config.js` and change its `rules`
   (each rule names its two sides, a `chip` picture for each, and what each side `accepts`).

Moving between levels:
- After finishing a level, a **Next level** button appears next to **Play again**.
- Settings has a **Level** menu.
- A link can open a level directly: `.../monster-sort/?level=2`.
- Each device remembers the last level played. **Start over** (top bar, and on the win message
  after Level 2) goes back to Level 1 with the score at 0.

To add a level, copy a whole level block in `js/config.js` and change the monsters, what each
one `accepts` (shapes like `"circle"` or colours like `"red"`), and the `pieces` (shape, colour,
count). Built-in shapes: circle, square, rectangle, triangle, oval, semicircle, hexagon, star,
heart, diamond, trapezoid, parallelogram, kite, right-triangle, tall-triangle, wide-triangle,
slanted-triangle (or use a picture with `image:`). Colours live in `colors`.


### Finishing the last level

Finishing the last level starts a champion party instead of the usual win message.
1. Every monster from every level dances in with confetti and a short fanfare.
2. A "Monster Sorting Champion!" certificate pops up with the final score, today's date, and a star for each level. The stars pop in one at a time, each with a chime.
3. The voice plays "Woo hoo" and then the champion line (`phrases.champion`). To use your own recording, put it in `sounds/` and set `voiceFiles.champion`.
4. **Print certificate** prints just the certificate, with a line to write the student's name.

With Animation off, nothing moves: the sparkles stay still and everything shows at once. The fanfare and chimes follow the Voice and Volume settings.

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
Safari on iPhone can't make a web page full screen, so there the button hides the game's own
buttons the same way (Safari's address bar stays), and the first time it explains
**Add to Home Screen**, which always opens full screen. The same happens in any other browser
that refuses full screen.
Opened from the Home Screen, the game starts with its buttons hidden; **Exit full screen** brings them back.

## Live address

https://gillyborg.github.io/accessiblegames/monster-sort/
