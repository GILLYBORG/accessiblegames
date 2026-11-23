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
    finish: "Woo hoo, you did it!"
  },

  // Your own recordings. Leave as "" to use the computer voice.
  // Example: correct: "sounds/thats-right.mp3"
  voiceFiles: {
    correct: "",
    wrong: "",
    finish: ""
  },

  // Computer voice speed: 1 is normal, 0.8 is slower.
  voiceRate: 0.9,

  // Colours of the scene.
  pieceColor: "#f9c4d8",      // light pink shapes
  pieceOutline: "#d9789f",
  backdropColor: "#dcdcdc",   // the large light gray circle and square
  backdropOutline: "#8c8c8c", // their dotted outline. Write "none" for no outline.
  barColor: "#000000",        // the bar along the bottom

  // Levels. Students start on the first one. Add more levels by copying a
  // whole { ... } block below and changing it.
  //
  //   backdrop: the large gray shape behind a monster: "circle" or "square".
  //   accepts:  which shapes this monster eats.
  //   pieces:   the shapes on the black bar, and how many of each.
  //             Shapes you can use: circle, square, rectangle, triangle,
  //             oval, semicircle, hexagon, star, heart, diamond.
  levels: [
    {
      name: "Curvy or straight",
      directions: "Feed each shape to a monster. Shapes with curvy sides go to the round monster. Shapes with straight sides go to the square monster.",
      targets: [
        {
          label: "Round monster, curvy sides",
          backdrop: "circle",
          monster: "images/monster-curvy.svg",
          monsterSize: 0.8,          // size of the monster inside the gray shape (1 = same size)
          mouth: { x: 0.5, y: 0.68 },
          accepts: ["circle"]
        },
        {
          label: "Square monster, straight sides",
          backdrop: "square",
          monster: "images/monster-straight.svg",
          monsterSize: 0.8,
          mouth: { x: 0.5, y: 0.69 },
          accepts: ["square"]
        }
      ],
      pieces: [
        { shape: "circle", label: "Circle", count: 4 },
        { shape: "square", label: "Square", count: 4 }
      ]
    }
  ],

  // Starting choices for the Settings panel. Each device remembers any
  // changes a student or teacher makes in Settings.
  defaults: {
    voice: true,
    volume: 90,          // 0 to 100
    animation: true,     // movement effects (turned off automatically if the
                         // device is set to reduce motion)
    highContrast: false,
    scanning: false,     // switch scanning for single-switch users
    scanSeconds: 2       // how long each shape or monster stays highlighted
  }
};
