# Home page (games launcher)

The site's front page (`../index.html`) shows one big picture card per game.

- **Touch / mouse:** tap a card.
- **Keyboard:** Tab to a card, then Enter.
- **Switch:** turn on **Switch scanning**. The cards light up one at a time; any switch press (Space, Enter, or any key) opens the lit game. iPad Switch Control and Chromebook Switch Access also work, because every card is a normal link.
- **Read names aloud:** says each game's name when it is lit, focused or pointed at.
- Both buttons are remembered on that device.

## Links for teachers

- `?scan=1` turns scanning on, `?scan=0` turns it off
- `&speed=3` sets seconds per card (0.5 to 10, default 2)
- `&talk=1` reads names aloud

Example: `https://gillyborg.github.io/accessiblegames/?scan=1&speed=3&talk=1`

## Add a game

Copy one `<li>` block in `index.html` and change the link, picture, accent colour, name and the short line.
Pictures are 800 x 600 JPEGs in `home/thumbs/` (screenshots of each game with its toolbar hidden).

`icon.svg` / `icon-*.png` are the Home Screen icon for the whole site. It opens in the browser (not as a full-screen app) on purpose, so the Back button still works.
