# Shape Explorer (beta)

A calm yes / not yes game about 3D shapes, made for a student whose only reliable answer is a long blink for **yes** (any other blink = not yes).

The game cannot see blinks, so it is **partner-assisted**: the question is shown big and read aloud, the student answers in their own way, and the adult watching presses **Yes** or **Not yes** for them. The student never has to be fast.

## Games

- **Shape quiz**: "Is this a cube?", "Can it roll?", "Does it have 6 faces?"
- **Count it**: "How many edges does a cube have?" Then "Is it 10? Is it 11? Is it 12?" one number at a time, and the student says yes at their number. Afterwards the shape goes see-through and the faces, edges or vertices light up and are counted together, 1, 2, 3...
- **Build it** (coding): yes / not yes answers write a little program line by line. "Add another side?", "Make it tall, like a prism?", "Paint it blue?", "Make it spin?", then **Run your program** steps through the code and builds the shape.
- **Explore**: "Look at the cylinder?" Then he drives it himself: "Tell me about it?", "Turn it left?", "Tip it up?", "Zoom in?", "See through it?". A yes repeats the same action (so yes, yes turns it further); not yes moves to the next action. Info cards (shown big and read aloud): faces, edges and vertices with Euler's formula, volume, surface area, real-life examples and a fun fact. The shape can also be turned by dragging it, and zoomed with a mouse wheel.
- **Code lab** (real JavaScript, for experienced coders): yes / not yes answers write a real program, shown with line numbers and colours, and it really runs (the code text is run in the browser) to build a 3D scene. "Add a shape?" then "Add a prism?", "Sides: is it 7?", "Colour: green?", "Put it in a loop?", "Loop count: is it 4?", "Put them in a circle?", "Make each one bigger than the last?", "Make it spin?". While a number or colour is being offered, the code and the 3D scene change live so he can see what a yes would do.
  - **Run it step by step** highlights each line as it runs and shows `i` and how many shapes are in the scene (press Yes to skip to the end).
  - **Change a line**: "Change line 6, the colour?" then pick the new value. He can also change the loop count, take a loop away, change the layout or x position, stop the spin, or delete a shape.
  - **Save this program** keeps it on this device (up to 20); **Open a saved program** replays one. Adults can **Copy link** (anyone who opens it gets the program) or **Download code** (a .js file).
  - Shape functions: `box(width, height, depth)`, `prism(sides, radius, height)`, `pyramid(sides, radius, height)`, `cylinder(radius, height)`, `cone(radius, height)`, `sphere(radius)`, with `.color`, `.position.x/y/z`, `.scale`, `.spin` and `scene.add()`.

The games menu itself works by yes / not yes too ("Play Count it?"), or the adult can tap a game.

Video-game feel: 10 points per right answer, 5 dots per level, and each new level unlocks a new shape (4 shapes at level 1, all 11 by level 8). Progress is saved on that device. A wrong or missed answer never takes points away, and "not yes" is never called wrong; the game just shows the answer gently.

## For the adult

- **Say again** (or tap the question, or R) repeats the question.
- **Undo answer** (or Backspace) takes back the last press if you misread a blink.
- Keys: **Y** = yes, **N** = not yes. Two switches: Enter = yes, Space = not yes (swap in Settings).
- **One switch** mode (Settings): a press means yes. If nobody presses before the wait runs out (3 to 30 seconds, default 10), it counts as not yes and the next choice comes. After 8 silent turns in a row it pauses.
- Settings also has: which counts to ask about, "vertices" or "corners", use all shapes now, talking speed, sounds, how fast the shape turns (or still), high contrast, start again from level 1.
- Full screen hides the toolbar. The Yes / Not yes buttons stay, and the keys still work.

## Links for teachers

- `?mode=quiz` / `count` / `build` / `explore` / `code` opens that game straight away
- `&answer=one&wait=8` one switch, 8 second wait
- `&vword=corners` says corners instead of vertices
- `&spin=0` shape stays still (`1` slow, `2` medium)
- `&all=1` all shapes unlocked
- `&voice=0` no computer voice (for screen reader users)

Example: `https://gillyborg.github.io/accessiblegames/shapes/?mode=count&answer=one&wait=10`

Everything is drawn in the browser (no picture or sound files), so there is nothing to replace. Nothing is uploaded or recorded.
