/*
 * GAME SETTINGS - this is the only file you need to edit.
 *
 * To use your own monster pictures (for example from Canva):
 *   1. Download each monster as a PNG with a transparent background.
 *   2. Put the files in the "images" folder.
 *   3. Change "monster" below to the file name, for example "images/round-monster.png".
 *   4. If the monster's mouth is not in the middle of the picture, change "mouth":
 *      x is how far across (0 = left edge, 0.5 = middle, 1 = right edge) and
 *      y is how far down (0 = top, 1 = bottom). Shapes fly into this point.
 *
 * To change what the voice says, edit "phrases". To use your own recordings
 * instead of the computer voice, put MP3 files in the "sounds" folder and write
 * their names in "voiceFiles".
 */
window.GAME_CONFIG = {
  // Name shown at the top of the screen and read by screen readers.
  title: "Monster Sort",

  // What the voice says.
  phrases: {
    correct: "That's right!",
    wrong: "Try again",
    finish: "Woo hoo, you did it!",
    // Said after "Woo hoo" when the LAST level is finished.
    champion: "You sorted them all! You're a Monster Sort champion!"
  },

  // Your own recordings. Leave as "" to use the computer voice.
  // Example: correct: "sounds/thats-right.mp3"
  voiceFiles: {
    correct: "sounds/thats-right.mp3",
    wrong: "sounds/try-again.mp3",
    finish: "sounds/woo-hoo.mp3",
    champion: ""   // your recording of the champion line, for example "sounds/champion.mp3"
  },

  // Points added to the score (top-left corner) for each correct answer.
  pointsPerCorrect: 100,

  // Computer voice speed: 1 is normal, 0.8 is slower.
  voiceRate: 0.9,

  // "Silly monster" voice (chosen in Settings > Voice style). It uses the
  // same computer voice with a higher pitch: pitch goes from 0 (low) to 2 (high).
  sillyVoice: { pitch: 1.9, rate: 1.05 },

  // Your own silly recordings for the Silly monster style. Leave as "" to use
  // the pitched computer voice. Example: correct: "sounds/silly-thats-right.mp3"
  sillyVoiceFiles: {
    correct: "",
    wrong: "",
    finish: ""
  },

  // "Growly monster" voice: the same computer voice, lower and slower.
  // Below about 0.3 the words get hard to understand.
  growlyVoice: { pitch: 0.4, rate: 0.8 },

  // Your own growly recordings for the Growly monster style.
  growlyVoiceFiles: {
    correct: "",
    wrong: "",
    finish: ""
  },

  // The game picks the most natural voice each device has. To choose one
  // yourself, write part of its name, for example "Ava" or "Google US English".
  voiceName: "",

  // Colours of the scene.
  pieceColor: "#f9c4d8",      // light pink shapes
  pieceOutline: "#d9789f",
  backdropColor: "#dcdcdc",   // the large light gray circle and square
  backdropOutline: "#8c8c8c", // their dotted outline. Write "none" for no outline.
  barColor: "#000000",        // the bar along the bottom

  // Named colours for shapes. "fill" is the colour, "outline" its edge.
  colors: {
    pink: { fill: "#f9c4d8", outline: "#d9789f" },
    red: { fill: "#e0282e", outline: "#8f1116" },
    blue: { fill: "#1f6fe0", outline: "#0b3a85" }
  },

  // Levels. Students start on the first one. Add more levels by copying a
  // whole { ... } block below and changing it.
  //
  //   monsterClosed: optional picture with the mouth shut. When a shape is
  //             eaten the monster goes chomp, chomp. Leave it out to skip.
  //   backdrop: the large gray shape behind a monster: "circle", "square",
  //             "rounded" (a square with soft corners), or "none" (just the
  //             monster; the drop area stays the same size).
  //   accepts:  which shapes ("circle") or colours ("red") this monster eats.
  //   pieces:   the shapes on the black bar, how many of each, and their colour.
  //             Shapes you can use: circle, square, rectangle, triangle,
  //             oval, semicircle, hexagon, star, heart, diamond, trapezoid,
  //             parallelogram, kite, right-triangle, tall-triangle,
  //             wide-triangle, slanted-triangle.
  //             Colours: pink (if you leave colour out), red, blue, or any
  //             colour added to "colors" below.
  //
  // A link can open a level directly: add ?level=2 to the end of the address.
  levels: [
    {
      name: "Curvy or straight",
      rule: "Sort by sides: curvy or straight",   // the big sentence at the top
      directions: "Feed each shape to a monster. Shapes with curvy sides go to the round monster. Shapes with straight sides go to the square monster.",
      targets: [
        {
          label: "Round monster, curvy sides",
          backdrop: "circle",
          monster: "images/monster-round.png",
          monsterClosed: "images/monster-round-closed.png", // mouth shut: shown for a quick chomp
          monsterSize: 0.85,         // size of the monster inside the gray shape (1 = same size)
          mouth: { x: 0.52, y: 0.53 },
          accepts: ["circle"]
        },
        {
          label: "Square monster, straight sides",
          backdrop: "square",
          monster: "images/monster-square.png",
          monsterClosed: "images/monster-square-closed.png",
          monsterSize: 0.85,
          mouth: { x: 0.5, y: 0.57 },
          accepts: ["square"]
        }
      ],
      pieces: [
        { shape: "circle", count: 4 },
        { shape: "square", count: 4 }
      ]
    },
    {
      name: "Red or blue",
      rule: "Sort by colour: red or blue",
      directions: "Feed each shape to a monster. Red shapes go to the red monster. Blue shapes go to the blue monster.",
      targets: [
        {
          label: "Red monster",
          backdrop: "none",
          monster: "images/monster-red.png",
          monsterSize: 0.95,
          mouth: { x: 0.5, y: 0.44 },
          accepts: ["red"]
        },
        {
          label: "Blue monster",
          backdrop: "none",
          monster: "images/monster-blue.png",
          monsterSize: 0.95,
          mouth: { x: 0.49, y: 0.51 },
          accepts: ["blue"]
        }
      ],
      pieces: [
        { shape: "square", color: "red", count: 2 },
        { shape: "triangle", color: "red", count: 2 },
        { shape: "rectangle", color: "blue", count: 2 },
        { shape: "circle", color: "blue", count: 2 }
      ]
    },
    {
      name: "3 sides or 4 sides",
      rule: "Sort by sides: 3 sides or 4 sides",
      directions: "Feed each shape to a monster. Shapes with 3 sides go to the triangle monster. Shapes with 4 sides go to the box monster.",
      targets: [
        {
          label: "Triangle monster, 3 sides",
          backdrop: "none",
          monster: "images/monster-three.svg", // placeholder until SG's picture arrives
          monsterClosed: "images/monster-three-closed.svg",
          monsterSize: 0.9,
          mouth: { x: 0.5, y: 0.68 },
          accepts: ["triangle", "right-triangle", "tall-triangle", "wide-triangle", "slanted-triangle"]
        },
        {
          label: "Box monster, 4 sides",
          backdrop: "none",
          monster: "images/monster-four.svg", // placeholder until SG's picture arrives
          monsterClosed: "images/monster-four-closed.svg",
          monsterSize: 0.9,
          mouth: { x: 0.5, y: 0.65 },
          accepts: ["square", "rectangle", "diamond", "trapezoid", "parallelogram", "kite"]
        }
      ],
      pieces: [
        { shape: "triangle", count: 1 },
        { shape: "right-triangle", count: 1 },
        { shape: "tall-triangle", count: 1 },
        { shape: "wide-triangle", count: 1 },
        { shape: "square", count: 1 },
        { shape: "rectangle", count: 1 },
        { shape: "diamond", count: 1 },
        { shape: "trapezoid", count: 1 }
      ]
    },
    {
      // A rule switch level: the shapes are sorted once for each rule, in order.
      // Each rule names the two sides of the T-chart and what each side takes.
      // "chip" is the little picture next to a side's name.
      name: "Switch the rule",
      directions: "Look at the Rule Spotlight. Feed each shape to the monster on the right side of the chart. When the rule changes, sort the shapes again with the new rule.",
      targets: [
        {
          label: "Left monster",
          backdrop: "none",
          monster: "images/monster-round.png",
          monsterClosed: "images/monster-round-closed.png",
          monsterSize: 0.95,
          mouth: { x: 0.52, y: 0.53 }
        },
        {
          label: "Right monster",
          backdrop: "none",
          monster: "images/monster-square.png",
          monsterClosed: "images/monster-square-closed.png",
          monsterSize: 0.95,
          mouth: { x: 0.5, y: 0.57 }
        }
      ],
      rules: [
        {
          name: "Colour",
          rule: "Sort by colour: red or blue",
          sides: [
            { label: "Red", chip: { shape: "circle", color: "red" }, accepts: ["red"] },
            { label: "Blue", chip: { shape: "circle", color: "blue" }, accepts: ["blue"] }
          ]
        },
        {
          name: "Corners",
          rule: "New rule! Sort by corners: 3 or 4",
          say: "New rule! Sort by corners.",
          sides: [
            { label: "3 corners", chip: { shape: "triangle", color: "#555555" },
              accepts: ["triangle", "right-triangle", "tall-triangle", "wide-triangle", "slanted-triangle"] },
            { label: "4 corners", chip: { shape: "square", color: "#555555" },
              accepts: ["square", "rectangle", "diamond", "trapezoid", "parallelogram", "kite"] }
          ]
        }
      ],
      pieces: [
        { shape: "triangle", color: "red", count: 1 },
        { shape: "right-triangle", color: "red", count: 1 },
        { shape: "square", color: "red", count: 1 },
        { shape: "rectangle", color: "red", count: 1 },
        { shape: "tall-triangle", color: "blue", count: 1 },
        { shape: "wide-triangle", color: "blue", count: 1 },
        { shape: "diamond", color: "blue", count: 1 },
        { shape: "trapezoid", color: "blue", count: 1 }
      ]
    }
  ],

  // Starting choices for the Settings panel. Each device remembers any
  // changes a student or teacher makes in Settings.
  defaults: {
    voice: true,
    voiceStyle: "regular", // "regular", "silly" or "growly"
    volume: 90,          // 0 to 100
    animation: true,     // movement effects (turned off automatically if the
                         // device is set to reduce motion)
    highContrast: false,
    scanning: false,     // switch scanning for single-switch users
    scanSeconds: 2       // how long each shape or monster stays highlighted
  }
};
