# Peek and Find

A 5 x 5 picture reveal game. Every square starts with the cover picture. Tapping a
square flips it to the reveal picture and plays a sound. Tapping it again flips it back
(set `flipBack: false` in `js/config.js` to keep squares open). One random square hides a
special picture instead, and it moves to a new square every time you press **New game**.

## Change the pictures and sounds

1. Copy your pictures into the `images` folder.
2. Open `js/config.js` in any text editor and change the file names and the `alt`
   words. The `alt` word is what VoiceOver and ChromeVox say aloud.
3. For your own sounds, put MP3 files in `sounds` and add their names to
   `revealSound` and `specialSound`. Leave them empty to keep the built-in chimes.

You can also change the title, the grid size, and the starting settings in the same file.

## Accessibility built in

- Every square is a real button that VoiceOver (iPad) and ChromeVox (Chromebook) read
  as "Row 2, column 3, Covered", then the picture name once it opens.
- A spoken message says what was revealed, and a different sound plays for the special picture.
- Keyboard: Tab to the board, arrow keys to move, Enter or Space to open.
- Switch scanning (Settings): highlights one row, then one square. Press a switch
  (sending Space or Enter) or tap anywhere on the board to choose. Speed is adjustable.
  iPad Switch Control also works without turning this on.
- High contrast mode, sound and volume controls, and a flip animation that turns off
  automatically when the device is set to reduce motion.
- No timers or time limits. Large buttons (at least 56 px).
- Settings are remembered on each device.

## Full screen

- Chromebook: the **Full screen** button works directly.
- iPad: the button works in recent Safari versions. If it does not, the game shows how
  to **Add to Home Screen**. Opened from the Home Screen, it always runs full screen.
  Guided Access keeps a student inside the game.

## Put it online with GitHub Pages

1. Create a new public repository on github.com (for example `peek-and-find`).
2. Upload everything in this folder (Add file > Upload files), keeping the folders.
3. In the repository, go to Settings > Pages, choose "Deploy from a branch",
   pick `main` and `/ (root)`, and save.
4. After a minute the game is live at `https://YOUR-NAME.github.io/peek-and-find/`.

## Try it on your own computer

Open `index.html` in a browser. Everything works offline except the Atkinson
Hyperlegible font, which falls back to a system font.
