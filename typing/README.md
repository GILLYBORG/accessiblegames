# Monster Keys (beta)

A typing game that teaches students to **find the right key**, not to touch type. There is no
home row, no timer and no speed score. Students can use any finger, a pointer, a head stick, the
big keys on the screen, or a switch. Every key they find feeds the monster. When its belly is
full, the game is done.

## Teacher setup

Press **Teacher setup** to choose:

- **Letters** (type the letters to practise, or type a student's name to use the letters in it;
  quick sets: s a t p i n, vowels, all letters, each keyboard row, numbers), or
- **Words** (one per line: names, family words, sight words, or short sentences like "I can go").
  Students never need Shift: capitals are matched by the plain key.
- How many letters or words in a game, mixed up or in order, and lowercase / UPPERCASE / as written.
- **Light up the key to press**: always, after a wrong try, or only when **Where is it?** is pressed.
- **Keys not in this lesson**: show, fade, or hide (fewer keys = fewer steps for switch users).
- **Ignore extra presses** (0.3 to 2 seconds) for students with tremors. Holding a key down
  always counts as one press.
- **Copy link**: students who open the link get the same lesson. Turn on **Hide Teacher setup**
  first if students should not change it.

Links look like this (you can also edit them by hand):
`typing/?mode=letters&keys=satpin&n=10&order=mix&hint=always&others=show&case=lower&wait=0`
`typing/?mode=words&words=cat|dog|I%20can%20go&n=5&order=in`

## Access

- Wrong keys get a gentle "Try again" and nothing is taken away. After three wrong tries the
  game says where the key is ("T is in the top letter row, the fifth key from the left").
- **Where is it?** lights up the key and says where it is, including the bumps on F and J.
- VoiceOver and ChromeVox hear each target, each key pressed, and what is done in a word.
  Keys typed on a real keyboard go into a hidden typing box over the big letter, so screen
  readers pass the keys through.
- Settings: Voice, Say each key I press, Sounds, Volume, Movement effects (off = calm mode),
  High contrast, Use the iPad's own keyboard.
- The end screen shows how many keys were found on the first try, and which keys to practise.
- Full screen hides everything except an Exit full screen button.

## Swap in your own pictures

All pictures are set in `js/config.js`. Make each in Canva as a **1000 x 1000 PNG with a
transparent background**, put it in `images`, and change the file name in `js/config.js`.

- Monster: `monster` (mouth open) and `monsterClosed` (mouth shut).
- Word pictures: `pictures`, for example `"cat": "images/cat.png"`. The placeholders are
  `images/word-*.svg`.

After changing css or js files, change the `?v=` number in `index.html` so iPads load the new version.
