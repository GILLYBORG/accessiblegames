/*
 * Monster Keys - things you can change.
 *
 * PICTURES: Canva PNGs work best at 1000 x 1000 with a transparent background.
 * Put them in the images folder and change the file names below.
 *
 *   monster / monsterClosed: the monster with its mouth open, and the same monster
 *   with its mouth shut (shown for a quick chomp). Keep them the same size and spot.
 *
 *   pictures: a picture for a word. When a student types a word on this list, its
 *   picture shows. Words without a picture still work (they get a star).
 *   Add a word like this:   "fish": "images/fish.png",
 */
window.GAME_CONFIG = {
  title: "Monster Keys",

  monster: "images/monster.png",
  monsterClosed: "images/monster-closed.png",

  pictures: {
    "cat": "images/word-cat.svg",
    "dog": "images/word-dog.svg",
    "sun": "images/word-sun.svg",
    "hat": "images/word-hat.svg",
    "cup": "images/word-cup.svg",
    "bus": "images/word-bus.svg",
    "pig": "images/word-pig.svg",
    "bed": "images/word-bed.svg"
  },

  // Quick letter sets in Teacher setup.
  letterSets: [
    { name: "s a t p i n", keys: "satpin" },
    { name: "Vowels", keys: "aeiou" },
    { name: "All letters", keys: "abcdefghijklmnopqrstuvwxyz" },
    { name: "Top row", keys: "qwertyuiop" },
    { name: "Middle row", keys: "asdfghjkl" },
    { name: "Bottom row", keys: "zxcvbnm" },
    { name: "Numbers", keys: "1234567890" }
  ],

  // Quick word lists in Teacher setup. A line with spaces is a short sentence.
  wordLists: [
    { name: "Short words", words: ["cat", "dog", "sun", "hat", "cup", "bus", "pig", "bed"] },
    { name: "Sight words", words: ["the", "and", "is", "it", "in", "to", "we", "see", "can", "my", "go", "look"] },
    { name: "Colours", words: ["red", "blue", "green", "pink", "black", "white", "brown", "yellow"] },
    { name: "Family", words: ["mom", "dad", "baby", "sister", "brother", "nana"] },
    { name: "Short sentences", words: ["I can go", "I see a cat", "I like my dog", "We can run", "Look at me"] }
  ],

  // What the game starts with on a device that has no saved setup and no setup link.
  startSetup: {
    mode: "letters",      // "letters" or "words"
    keys: "satpin",       // letters to practise (letters mode)
    words: ["cat", "dog", "sun", "hat", "cup", "bus", "pig", "bed"], // words mode
    turns: 10,            // letters or words in a game; 0 means no limit
    order: "mix",         // "mix" or "in" (in order)
    hint: "always",       // light up the key: "always", "wrong" (after a wrong try), "ask" (only with Where is it?)
    others: "show",       // keys not in the lesson: "show", "dim" or "hide"
    letterCase: "lower",  // letters to find: "lower", "upper" or "asis" (as written in the word list)
    keyCase: "upper",     // on-screen keys: "upper" (like a real keyboard) or "match" (same as letterCase)
    wait: 0               // ignore extra presses for this many milliseconds (0 = off)
  },

  // The monster can say one of these when it eats a letter, for example
  //   yums: ["Yum!", "Crunch!", "Tasty!"],
  // Empty means it says nothing (just the letter, if "Say each key I press" is on).
  yums: [],

  // RECORDINGS: your own voice. Leave a name empty ("") to use the computer voice for it.
  // letters: one clip per letter, {key} becomes the letter (sounds/letter-a.mp3 ... letter-z.mp3).
  // numbers: the same for 0 to 9, for example "sounds/number-{key}.mp3".
  // words: a clip for a word, for example  "cat": "sounds/word-cat.mp3",
  recordings: {
    letters: "sounds/letter-{key}.mp3",
    numbers: "",
    find: "sounds/find.mp3",           // "Find"
    tryAgain: "sounds/try-again.mp3",  // "Try again"
    type: "sounds/type.mp3",           // "Type" (before a word)
    full: "sounds/monster-full.mp3",   // "The monster is full!"
    words: {}
  },

  // What the computer voice says when there is no recording.
  phrases: {
    find: "Find",
    tryAgain: "Try again.",
    type: "Type",
    full: "The monster is full!"
  },
  voiceRate: 0.8,   // how fast the voice talks at first (teachers can change it in Settings)

  defaults: { voice: true, recorded: true, voiceName: "", rate: 0.8, echo: true, sounds: true, volume: 90, animation: true, highContrast: false, deviceKeyboard: false }
};
