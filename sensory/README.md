# Sensory Room (beta)

Eight calm cause-and-effect activities. There is no right or wrong, no score and no timer.
Everything is drawn and played by the computer, so no pictures or sound files are needed.

| Activity | Touch / mouse | Switch (any key, Space, Enter) | Eye gaze (look and wait) |
| --- | --- | --- | --- |
| Fish Tank (coral reef picture by SG in every mode; calm mode dims it a little) | Each touch brings a new fish that swims for 12 to 20 seconds, then swims away; the others wiggle and come to look. The shark visits about 1 touch in 5, one at a time | A new fish swims in, all the fish wiggle | A new fish appears where you look |
| Fireworks | Touch the sky to send a firework there | A firework goes up | A firework bursts where you look |
| Snow Globe (you are inside the globe) | Tap to shake the globe. Hold your finger down and within about 3 seconds it becomes a blizzard: thick snow blowing sideways, a white-out haze and a howling wind. Let go and within a few seconds it drops back to a light sprinkle and a soft whisper of wind. The snowman's top hat wobbles more the longer you hold; after 3 seconds it blows off and flies all around the screen for as long as you keep holding. Let go and it falls to the ground right where it is; once the snow has died down, the fox fetches it and the snowman puts it back on (hold again before the fox gets there and the hat flies off again). Every 3 shakes the sky changes (starry night, northern lights, pink sunset, snowy day) or an animal visits (reindeer, fox, owl, bunny). Drag to stir the snow | Hold the switch down for a blizzard; let go and it calms. Here the hold to go back to the menu is 12 seconds longer | A shake |
| Bongo Drums (pick the game in Settings, or link with `&bongo=jam`, `band`, `roll`, `animals` or `echo`) | **Bongo Jam:** tap a drum for a real bongo sound and a splash of colour (centre and rim sound a little different). **Play-along band:** a band (bass, keys, marimba, shaker) plays while you drum and stops about 2.5 seconds after you stop. **Drumroll:** hold down for a drumroll that gets faster and louder while a row of lights fills up; let go for a cymbal crash and confetti (bigger the longer you held). **Dancing animals:** every hit makes the animals jump and dance; keep drumming and more come (frog, bear, penguin, cat, bunny; up to 5, 3 in calm mode); slow down and they wave goodbye one by one. **Echo game:** a friendly monster plays 2 to 5 beats on its own little bongos, then it is your turn. Copying it (the same drums in the same order, the same number of beats; timing is not judged) gets a big cheer and confetti, then a new pattern. Otherwise the monster says a kind "Good try! Listen again." and plays the same beats again; after 3 tries it moves to an easier one. Orange dots are the big drum, blue dots the small drum; the row underneath shows what the student played, with a white ring on each beat they matched | Each press plays the drums in turn (or both together, or two switches: Space is the big drum, Enter the small one; see Settings). Arrow keys left and right always pick a drum. Drumroll: hold the switch; here the hold to go back to the menu is 10 seconds longer. A Switch Control or VoiceOver tap gives a short drumroll and crash | A drum hit where you look (Drumroll: a short roll and crash) |
| Light Painting | Move to paint glowing light, tap for a ripple | A ribbon of light swirls across the screen | Moving paints, resting makes a ripple |
| Bubble Float | Tap to blow bubbles, tap a bubble to pop it | More bubbles float up | Look at a bubble to pop it |
| Colour Lamp | A lava lamp: touch to make a glowing blob that rises and merges, with sparkles; drag to stir | The whole lamp fades to a new colour (name read aloud) | A blob grows where you look |
| Look and Bloom | Tap to grow a flower | A flower grows somewhere new | A flower grows where you look |

## Switch access

- **Menu:** switch scanning is on by default. The activities light up one at a time; press the switch to choose.
- **Inside an activity:** every switch press makes something happen. Holding the switch for 3 seconds goes back to the menu.
- iPad Switch Control and VoiceOver also work: the scene is one big button.
- Settings: scanning on/off and speed, hold time, and "ignore extra presses" for tremor.

## Calm and safe

- Nothing flashes. Fireworks are soft glows with capped brightness, never a full-screen flash, and only a few can be in the sky at once however fast the switch is pressed. In regular mode the fireworks whistle, bang and crackle (built from noise, limited so they are never painfully loud; your own recordings can be set in `fireworksSounds` in config.js). Calm mode keeps soft sounds.
- Colour changes fade over about 2.5 seconds, however fast the switch is pressed.
- **Calm mode** (Settings): slower movement, softer colours, quieter sounds, fewer things on screen. It is on automatically when the device is set to reduce motion.
- Snow Globe sounds are made by the computer (no sound files): a wind that gets stronger as the snow gets heavier, plus a choice in Settings of a music box or sleigh bells. Calm mode caps the snow at about half, with gentler movement and quieter sounds.
- Snow Globe pictures: put your own PNGs (1000x1000, see-through background, standing on the bottom edge) in `images/snow/` and name them in `snowPictures` in config.js (cabin, snowman, and the visiting animals).
- Bongo Drums sounds (drums, cymbal, band) are made by the computer, so there are no sound files to licence. Calm mode makes them softer and the movement slower.
- Sounds are soft chimes from a pentatonic scale, so every mix of notes sounds pleasant.

## My pictures

Teachers can add their own pictures from the **My pictures** button on the menu. They swim as fish (side view facing right works best), float inside the bubbles, and grow as flowers.
The file picker on a Chromebook or iPad can also open Google Drive. Pictures are never uploaded. By default they are forgotten when the page is closed or refreshed (safer on shared devices); "Keep my pictures on this device" saves them in the browser, and "Remove all my pictures" clears them. Peek and Find works the same way.

**Remove background** (optional, also on the device):

- **Plain background:** instant. Best for pictures on a plain colour, like most Canva exports. A slider sets how much to remove.
- **Busy photo:** uses a small AI model (U-2-Net small, Apache 2.0 licence, `models/u2netp.onnx`) run with ONNX Runtime Web (MIT) from jsDelivr. The first time it downloads about 15 MB. Busy photos may not come out perfectly.
- Every cut-out shows a preview first, and **Undo** brings back the original at any time.

## Links for teachers

- One activity: `?activity=fish`, `fireworks`, `snow`, `bongo`, `trails`, `bubbles`, `lamp` or `bloom`
- Calm mode: `&calm=1` · Eye gaze dwell: `&dwell=1.5` · Scanning off: `&scan=0`

Example: `https://gillyborg.github.io/accessiblegames/sensory/?activity=bloom&dwell=1.5`
Bongo example: `https://gillyborg.github.io/accessiblegames/sensory/?activity=bongo&bongo=echo`

## Change things

Edit `js/config.js` for names, hints, Colour Lamp colours, starting settings, and built-in pictures.
After changing css or js files, change the `?v=` number in `index.html` so iPads load the new version.

The Fish Tank coral reef picture (`images/fish-background.jpg`) and fish pictures (`images/fish/`) are SG's own (Canva) and are not covered by the MIT licence; do not copy them to the starter repo.
