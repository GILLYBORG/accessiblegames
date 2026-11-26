# Sensory Room (beta)

Five calm cause-and-effect activities. There is no right or wrong, no score and no timer.
Everything is drawn and played by the computer, so no pictures or sound files are needed.

| Activity | Touch / mouse | Switch (any key, Space, Enter) | Eye gaze (look and wait) |
| --- | --- | --- | --- |
| Fish Tank | Touch the water: every fish wiggles and the nearby ones swim over to look | All the fish wiggle and dart to new spots, bubbles rise | The fish come to where you look |
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

- Nothing flashes. Colour changes fade over about 2.5 seconds, however fast the switch is pressed.
- **Calm mode** (Settings): slower movement, softer colours, quieter sounds, fewer things on screen. It is on automatically when the device is set to reduce motion.
- Sounds are soft chimes from a pentatonic scale, so every mix of notes sounds pleasant.

## My pictures

Teachers can add their own pictures from the **My pictures** button on the menu. They swim as fish (side view facing right works best), float inside the bubbles, and grow as flowers.
The file picker on a Chromebook or iPad can also open Google Drive. Pictures stay on that device only (browser storage); nothing is uploaded.

**Remove background** (optional, also on the device):

- **Plain background:** instant. Best for pictures on a plain colour, like most Canva exports. A slider sets how much to remove.
- **Busy photo:** uses a small AI model (U-2-Net small, Apache 2.0 licence, `models/u2netp.onnx`) run with ONNX Runtime Web (MIT) from jsDelivr. The first time it downloads about 15 MB. Busy photos may not come out perfectly.
- Every cut-out shows a preview first, and **Undo** brings back the original at any time.

## Links for teachers

- One activity: `?activity=fish`, `trails`, `bubbles`, `lamp` or `bloom`
- Calm mode: `&calm=1` · Eye gaze dwell: `&dwell=1.5` · Scanning off: `&scan=0`

Example: `https://gillyborg.github.io/accessiblegames/sensory/?activity=bloom&dwell=1.5`

## Change things

Edit `js/config.js` for names, hints, Colour Lamp colours, starting settings, and built-in pictures.
After changing css or js files, change the `?v=` number in `index.html` so iPads load the new version.
