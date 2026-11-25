/*
 * Sound It Out - things you can change.
 *
 * PICTURES: Canva PNGs work best at 1000 x 1000 with a transparent background.
 * Put them in the images folder and add or change a line under "pictures".
 * Words without a picture still work.
 *
 * WORDS: in Teacher setup, one word on each line. For now the game uses
 * 3-letter words only (cat, dog, sun): each letter becomes a tile.
 */
window.GAME_CONFIG = {
  title: "Sound It Out",

  pictures: {
    "cat": "images/word-cat.svg",
    "dog": "images/word-dog.svg",
    "mat": "images/word-mat.svg",
    "hat": "images/word-hat.svg",
    "sun": "images/word-sun.svg",
    "pig": "images/word-pig.svg",
    "bed": "images/word-bed.svg",
    "cup": "images/word-cup.svg",
    "bus": "images/word-bus.svg"
  },

  // Quick word lists in Teacher setup.
  wordLists: [
    { name: "First words", words: ["cat", "dog", "mat", "sun", "pig"] },
    { name: "Short a", words: ["cat", "mat", "hat", "sat", "map", "pan", "bag", "jam"] },
    { name: "Short e", words: ["bed", "hen", "pet", "ten", "leg", "net", "red", "web"] },
    { name: "Short i", words: ["pig", "sit", "pin", "lid", "big", "zip", "fin", "dig"] },
    { name: "Short o", words: ["dog", "pot", "top", "hop", "log", "mop", "fox", "box"] },
    { name: "Short u", words: ["sun", "cup", "bus", "mud", "bug", "rug", "hut", "nut"] },
    { name: "s a t p i n", words: ["sat", "pin", "tap", "pat", "nap", "tip", "sip", "pan"] }
  ],

  // What the game starts with on a device that has no saved setup and no setup link.
  startSetup: {
    words: ["cat", "dog", "mat", "sun", "pig"],
    turns: 5,           // words in a game; 0 means all of them
    order: "in",        // words: "in" (in order) or "mix" (mixed up)
    tiles: "in",        // letter tiles: "in" (in the word's order) or "mix" (mixed up)
    extra: 0,           // extra letters that are not in the word: 0, 1 or 2
    place: "box",       // "box": tap a letter, then tap the box (or drag it)
                        // "auto": tap the right letter and it goes in the next box by itself
    ghost: true,        // light gray letter in each box
    sayFirst: false,    // say the word at the start (false: the word is the surprise at the end)
    picture: "end",     // show the picture: "end", "start" or "never"
    blend: "word",      // after the last letter: "word" (sounds, then the word)
                        // or "fast" (sounds slowly, sounds quickly, then the word)
    letterCase: "lower" // "lower" or "upper"
  },

  // Letters that make one sound together (like "oo" in book) can become one tile.
  // Turned off for now: the game uses 3-letter words with one letter per sound.
  teams: {},

  // RECORDINGS
  // sounds: one clip per letter sound, {key} becomes the letter. These are the
  //   Open Letter Sounds clips (CC0, see sounds/LICENSE-letter-sounds.txt).
  // words: your own voice saying a whole word, for example  "cat": "sounds/word-cat.mp3",
  //   Words without a recording use the computer voice.
  // phrases: your own voice for the instructions. Leave "" to use the computer voice.
  recordings: {
    sounds: "sounds/{key}.wav",
    words: {},
    build: "",      // "Build the word"
    tryAgain: "",   // "Try again"
    great: ""       // "You did it!"
  },

  // What the computer voice says when there is no recording.
  phrases: {
    build: "Build the word",
    buildSecret: "Build a word",
    tryAgain: "Try again.",
    great: "You did it!"
  },
  voiceRate: 0.8,

  defaults: { voice: true, voiceName: "", rate: 0.8, sounds: true, volume: 90, animation: true, highContrast: false }
};
