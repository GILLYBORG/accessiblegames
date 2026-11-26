/*
 * Symbol Stamps - things you can change.
 *
 * A stamp is written as  library:id  and can have a name to say after a ~
 *   "m:dog"            a Mulberry symbol (built in, in symbols/mulberry/)
 *   "m:dog~my puppy"   the same picture, but the game says "my puppy"
 *   "a:2517~dog"       an ARASAAC pictogram (loaded from arasaac.org while you play)
 *
 * The Teacher setup button makes these for you, so you rarely need to edit this file.
 */
window.STAMPS_CONFIG = {
  title: "Symbol Stamps",

  // The stamps a new student sees before any teacher setup.
  defaultStamps: ["m:dog", "m:cat", "m:fish", "m:bird", "m:butterfly", "m:flower"],

  // Most stamps in one set.
  maxStamps: 12,

  // Most stamps on the paper at once (the oldest one goes when the paper is full).
  maxOnPaper: 250,

  // Quick sets in Teacher setup (Mulberry symbols).
  presets: [
    { name: "Pets",      stamps: ["dog", "cat", "rabbit", "fish", "bird", "hamster"] },
    { name: "Farm",      stamps: ["cow", "sheep", "horse", "piglet~pig", "chicken_live~chicken", "duck", "tractor"] },
    { name: "Wild animals", stamps: ["lion", "elephant", "giraffe", "zebra", "tiger", "hippopotamus"] },
    { name: "Bugs",      stamps: ["butterfly", "bee_bumble~bee", "caterpillar", "spider", "ant", "dragonfly"] },
    { name: "Sea",       stamps: ["fish_tropical~fish", "dolphin", "seahorse", "killer_whale~whale", "crab", "seal"] },
    { name: "Fruit",     stamps: ["apple", "banana", "orange", "grapes", "strawberry", "pear", "watermelon"] },
    { name: "Feelings",  stamps: ["happy_lady~happy", "sad_lady~sad", "angry_lady~angry", "afraid_lady~scared", "surprised_lady~surprised", "excited_lady~excited"] },
    { name: "Weather",   stamps: ["sun", "cloudy~cloud", "rain", "snow", "rainbow", "thunder_storm~storm"] },
    { name: "Vehicles",  stamps: ["car", "bus_double_decker~bus", "bicycle", "fire_engine", "tractor", "aeroplane", "boat"] },
    { name: "Space",     stamps: ["moon", "star", "earth", "saturn", "rocket", "comet"] },
    { name: "Shapes",    stamps: ["circle", "square", "triangle_equilateral~triangle", "rectangle", "heart_shape~heart", "star"] },
    { name: "Garden",    stamps: ["flower", "tree", "tulip", "daisy", "leaf", "butterfly", "bee_bumble~bee"] },
    { name: "Party",     stamps: ["balloon", "birthday_cake", "present", "party_popper", "candle_2~candle", "fireworks"] }
  ],

  // Online library. ARASAAC pictograms are free for non-commercial use (CC BY-NC-SA).
  arasaac: {
    search: "https://api.arasaac.org/v1/pictograms/en/search/",
    image: function (id) { return "https://static.arasaac.org/pictograms/" + id + "/" + id + "_500.png"; }
  },

  // Speaking speed for the computer voice (1 is normal).
  voiceRate: 0.9
};
