/*
 * Claw Machine - things you can change.
 *
 * TOYS: each toy needs
 *   id:     a short name used in links (letters, numbers and dashes only; don't change it once you share links)
 *   name:   what the game says for one ("red ball")
 *   plural: what it says for more than one ("red balls")
 *   image:  the picture. Canva PNGs: 1000 x 1000, transparent background, put in the images folder.
 *   color:  a colour used for the tally chart bars and outlines
 *
 * To use your own picture, put it in images and change image: for that toy, for example
 *   image: "images/red-ball.png"
 * You can add more toys to the list in the same way. The teacher setup shows all of them.
 */
window.GAME_CONFIG = {
  title: "Claw Machine",

  toys: [
    { id: "red-ball",     name: "red ball",     plural: "red balls",     image: "images/toy-red-ball.svg",     color: "#e0282e" },
    { id: "blue-block",   name: "blue block",   plural: "blue blocks",   image: "images/toy-blue-block.svg",   color: "#1f6fe0" },
    { id: "yellow-star",  name: "yellow star",  plural: "yellow stars",  image: "images/toy-yellow-star.svg",  color: "#d9a400" },
    { id: "purple-heart", name: "purple heart", plural: "purple hearts", image: "images/toy-purple-heart.svg", color: "#8a3fd1" },
    { id: "green-gem",    name: "green gem",    plural: "green gems",    image: "images/toy-green-gem.svg",    color: "#1a8a3e" },
    { id: "orange-duck",  name: "orange duck",  plural: "orange ducks",  image: "images/toy-orange-duck.svg",  color: "#e06f00" }
  ],

  // The claw. Swap in Canva PNGs (1000 x 1000, transparent) of the claw open and closed.
  // Keep the claw at the same size and spot in both pictures, with the top of the claw at the top middle.
  clawOpen: "images/claw-open.svg",
  clawClosed: "images/claw-closed.svg",

  // Machine colours
  machineColor: "#e83e8c",
  machineTrim: "#14213d",
  glassColor: "#e6f6ff",

  // What the game starts with on a device that has no saved setup and no setup link.
  // toys: how many of each toy are in the machine. A toy with 0 still shows in the
  // guesses and the tally (good for "impossible").
  startSetup: {
    toys: { "red-ball": 6, "blue-block": 3, "yellow-star": 1 },
    putBack: true,   // true: the toy goes back in the machine after each grab
    guess: true,     // true: students guess before each grab
    grabs: 10        // grabs in a game; 0 means no limit
  },

  // Quick setups the teacher can pick in Teacher setup.
  presets: [
    { name: "Equally likely", toys: { "red-ball": 5, "blue-block": 5 } },
    { name: "More likely, less likely", toys: { "red-ball": 8, "blue-block": 2 } },
    { name: "Rare prize", toys: { "red-ball": 6, "blue-block": 3, "yellow-star": 1 } },
    { name: "Certain", toys: { "red-ball": 10 } },
    { name: "Impossible", toys: { "red-ball": 6, "blue-block": 4, "yellow-star": 0 } },
    { name: "Three toys", toys: { "red-ball": 4, "blue-block": 4, "purple-heart": 4 } }
  ],

  // Most of one toy, and most toys in total, the machine can hold.
  maxEach: 20,
  maxTotal: 30,

  // Points for a right guess.
  pointsPerCorrect: 100,

  // What the voice says. {toy} becomes the toy's name.
  phrases: {
    got: "You got a {toy}!",
    guessRight: "You guessed it!",
    guessWrong: "Not this time.",
    finish: "All done! Look at your tally.",
    empty: "The machine is empty!"
  },
  voiceRate: 0.9,

  defaults: { voice: true, sounds: true, volume: 90, animation: true, highContrast: false, control: "button" }
};
