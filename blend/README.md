# Sound It Out (beta)

A blending game. Students tap a letter tile to hear its sound, put it in the next box, and
fill the boxes from left to right. When every box is full, the game plays each sound in turn
(lighting up its box) and then says the whole word. No timer, nothing taken away for a wrong try.

## Putting letters in the boxes

- **Tap a letter, then tap the glowing box** (the default). Dragging the tile to the box works too.
- **Tap the right letter and it goes in by itself**: the fewest taps, best for switch users.
- Any tile can be tapped any time to hear its sound. A wrong tile goes back with a gentle "Try again".
  After a couple of wrong tries the right tile glows.
- Real keyboards: type a letter to pick its tile, Enter to put it in the box.

Switch access: the game comes before the toolbar in the page, so switch scanning, Tab and screen
readers reach the letters first. Only the box that can be used right now is a button, and used
tiles drop out of the scan, so each step needs as few switch presses as possible.

## Teacher setup

On the game screen, **Mix letters** mixes up the letter tiles (off: they are in the word's order).
It is remembered on that device. It is hidden for students who open a link with Teacher setup hidden.


- **Words**, one per line, plus quick lists (short a, e, i, o, u, s a t p i n, oo and ea).
- "oo", "ea", "ee", "sh" and "ck" become one tile with one sound. To choose the tiles yourself,
  use dashes: `b-oo-k`, `sh-i-p`, `c-a-t`. Setup shows how each word will split.
- Words in a game, word order, letter tiles in order (default) or mixed up, 0 to 2 extra letters,
  lowercase or UPPERCASE.
- **Light gray letter in each box** (on by default).
- **Say the word at the start** (off by default, so the word is the surprise at the end).
- **Show the picture**: at the end, from the start, or never.
- **When all the boxes are full**: each sound then the word, or slowly, quickly, then the word.
- **Copy link**: students who open it get the same setup. Turn on **Hide Teacher setup** first
  if students should not change it.

Example link: `blend/?words=cat|dog|b-oo-k|mat|h-ea-d&n=5&place=box&ghost=1&say=0&pic=end`

## Sounds

Letter sounds are the **Open Letter Sounds** clips (CC0, no credit needed; see
`sounds/LICENSE-letter-sounds.txt`), levelled to the same loudness. The whole word uses the
computer voice until there is a recording.

Two-letter tiles: "ea" plays the short e sound (as in head), "ck" plays k. "oo", "ee" and "sh"
use the computer voice for now, which is only close. Record them and set `rec` under `teams`
in `js/config.js`, for example `"oo": { rec: "sounds/team-oo.mp3" }`.

Your own voice for whole words: put `word-cat.mp3` in `sounds` and add `"cat": "sounds/word-cat.mp3"`
under `recordings.words` in `js/config.js`. Instructions ("Build the word", "Try again",
"You did it!") can be recorded the same way.

## Pictures

Set in `js/config.js` under `pictures`. Canva PNGs work best at **1000 x 1000 with a transparent
background**. The current ones are placeholders (`images/word-*.svg`).

After changing css or js files, change the `?v=` number in `index.html` so iPads load the new version.
