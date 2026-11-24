# Claw Machine

A probability game. The teacher fills a claw machine with toys (for example 6 red balls,
3 blue blocks and 1 yellow star). Students guess which toy the claw will grab, press **Grab!**,
and watch the claw lower, close, lift and drop the toy down the prize chute. A tally chart
fills in after every grab.

The pick is fair: every toy in the machine has the same chance, so a toy there are 6 of is
6 times as likely as a toy there is 1 of. The game picks the toy first, then the claw goes and
gets it.

## Teacher setup

Press **Teacher setup** to:

- Pick a quick setup (Equally likely, More likely/less likely, Rare prize, Certain, Impossible, Three toys).
- Turn toys on and set how many of each (up to 20 of one toy, 30 in all). A toy that is on with 0
  still shows in the guesses and tally, for "impossible".
- Choose **Put each toy back** (with replacement) or not (without replacement: the chances change
  as toys come out, and the game ends when the machine is empty).
- Turn guessing on or off, and set how many grabs are in a game.
- **Copy link**: students who open the link get the same machine. Turn on **Hide Teacher setup**
  first if students should not change it.

Links look like this (you can also edit them by hand):
`claw-machine/?toys=red-ball.6,blue-block.3,yellow-star.1&back=1&guess=1&grabs=10`

## Access

- One big **Grab!** button: one tap, one key (Space or Enter) or one switch.
- Settings > **Claw control** > **Move the claw, then drop it** adds left/right buttons (or the
  arrow keys). The claw drops where the student puts it and reaches for the picked toy nearby,
  so the chances stay fair.
- Number keys 1 to 9 pick a guess. Choosing a guess moves focus to Grab.
- VoiceOver and ChromeVox hear what is in the machine, each result, and the tally.
- Settings: Voice, Claw sounds, Volume, Movement effects (off = calm mode), High contrast.
- Full screen hides everything except an Exit full screen button. On iPhone, Add to Home Screen
  for true full screen (a link with a setup keeps its setup).

## Swap in your own pictures

All pictures are set in `js/config.js`. Make each in Canva as a **1000 x 1000 PNG with a
transparent background**, put it in `images`, and change the file name in `js/config.js`.

- Toys: `images/toy-red-ball.svg` and friends. Each toy in `toys:` has a name, a plural, a
  picture and a colour (for the tally marks). Add more toys to the list the same way.
- Claw (optional): `clawOpen` and `clawClosed`, the same claw open and shut, at the same size and
  spot, with the top of the claw at the top middle of the picture.
- Machine colours: `machineColor`, `machineTrim`, `glassColor`.

After changing css or js files, change the `?v=` number in `index.html` so iPads load the new version.
