/*
 * GAME SETTINGS - this is the only file you need to edit.
 *
 * To use your own pictures:
 *   1. Put your picture files in the "images" folder (PNG, JPG, GIF, SVG or WEBP).
 *   2. Change the "src" below to the file name, for example "images/dog.png".
 *   3. Change the "alt" text to a short description. Screen readers say this
 *      word aloud when a student opens a square, so keep it short ("Dog").
 *
 * Square pictures look best. Other shapes are fitted inside the square.
 */
window.GAME_CONFIG = {
  // Name shown at the top of the screen and read by screen readers.
  title: "Peek and Find",

  // Size of the grid.
  rows: 5,
  columns: 5,

  // Image A: the cover every square shows at the start.
  coverImage: { src: "images/flamingo.png", alt: "Pink flamingo" },

  // Image B: what most squares show when opened.
  revealImage: { src: "images/blue-flamingo.png", alt: "Blue flamingo" },

  // Image C: the special picture hidden under one random square.
  // It moves to a new square every time you press "New game".
  specialImage: { src: "images/surprise.png", alt: "Surprise" },

  // What the game says when the special picture is found.
  specialMessage: "You found the surprise!",

  // Sounds. Leave as "" to use the built-in chimes, or put a sound file in the
  // "sounds" folder and write its name here, for example "sounds/pop.mp3".
  revealSound: "",
  specialSound: "",
  coverSound: "",      // plays when a square flips back to the cover

  // true: pressing an open square flips it back to the cover.
  // false: open squares stay open until New game.
  flipBack: true,

  // Starting choices for the Settings panel. Each device remembers any
  // changes a student or teacher makes in Settings.
  defaults: {
    sound: true,
    volume: 80,          // 0 to 100
    animation: true,     // flip animation (turned off automatically if the
                         // device is set to reduce motion)
    highContrast: false,
    scanning: false,     // switch scanning for single-switch users
    scanSeconds: 2       // how long each row or square stays highlighted
  }
};
