/*
 * SENSORY ROOM SETTINGS - this is the only file you need to edit.
 *
 * Everything you see and hear is drawn and played by the computer, so no
 * pictures or sound files are needed. You can add your own pictures later:
 * see "pictures" under Bubbles and Look and Bloom below.
 *
 * Link straight to one activity with ?activity=fish, fireworks, snow, trails, bubbles, lamp or bloom.
 * Add &calm=1 for calm mode, &dwell=1.5 to turn on eye gaze dwell, or &scan=0
 * to turn off switch scanning on the menu.
 * Example: .../sensory/?activity=bloom&dwell=1.5
 */
window.SENSORY_CONFIG = {
  title: "Sensory Room",

  // The activities, in the order they appear on the menu. Change the names
  // and hints freely; keep the "id" words as they are.
  activities: [
    /* Peek and Find is hidden for now (its page still works at peek-and-find/).
       To show it on the menu again, delete this line and the "end hidden" line below.
    {
      id: "peek",
      name: "Peek and Find",
      hint: "Tap the squares to find the surprise. Teachers can add their own pictures.",
      href: "peek-and-find/" // opens its own page
    },
    end hidden */
    {
      id: "fish",
      name: "Fish Tank",
      hint: "Touch the water and a new fish swims in.",
      label: "Fish tank. Each touch or switch press brings a new fish that swims around for a while and then swims away. The other fish wiggle and swim over to look.",
      // Optional: your own pictures to swim as fish (side view, facing right,
      // with a see-through background). Pictures added with "My pictures" are used too.
      pictures: []
    },
    {
      id: "fireworks",
      name: "Fireworks",
      hint: "Touch the sky to send up fireworks.",
      label: "Fireworks. Touch the sky to send a firework there. A switch press sends one up. The fireworks glow softly and never flash."
    },
    {
      id: "snow",
      name: "Snow Globe",
      hint: "You are inside a snow globe. Shake it to make it snow!",
      label: "Snow globe. You are inside the snow globe. Tap, press a switch, or shake the iPad to shake the globe. The more you shake, the more it snows and the wind blows. Every few shakes the sky changes or an animal comes to visit. Drag to stir the snow."
    },
    {
      id: "trails",
      name: "Light Painting",
      hint: "Move to paint with glowing light.",
      label: "Light painting. Touch and move to paint with glowing light. A switch press sends a ribbon of light across the screen."
    },
    {
      id: "bubbles",
      name: "Bubble Float",
      hint: "Make bubbles and pop them.",
      label: "Bubble float. Tap to blow bubbles. Tap or look at a bubble to pop it. A switch press blows more bubbles.",
      // Optional: your own pictures to float inside the bubbles (square PNGs
      // with see-through backgrounds look best). Example:
      // pictures: ["images/star.png", "images/fish.png"]
      pictures: []
    },
    {
      id: "lamp",
      name: "Colour Lamp",
      hint: "Touch to make glowing blobs rise and mix.",
      label: "Colour lamp. Touch to make a glowing blob that rises and mixes with the others. A switch press slowly changes the colour of the lamp."
    },
    {
      id: "bloom",
      name: "Look and Bloom",
      hint: "Flowers open where you tap or look.",
      label: "Look and bloom. Tap, or look and wait, to grow a glowing flower. A switch press grows a flower somewhere new.",
      // Optional: your own flower pictures, used instead of the drawn flowers.
      pictures: []
    }
  ],

  // Colour Lamp: each press moves to the next colour. "name" is read aloud.
  lampColours: [
    { name: "Ocean blue",   bg: "#03122b", colours: ["#1f8bff", "#16c6e8", "#4b5cff", "#2ee6c8"] },
    { name: "Purple",       bg: "#14072b", colours: ["#9b4dff", "#e05cff", "#6a3dff", "#ff7ad9"] },
    { name: "Sunset pink",  bg: "#2a0716", colours: ["#ff5f8f", "#ff9a5c", "#ff4fb0", "#ffc36b"] },
    { name: "Gold",         bg: "#241503", colours: ["#ffb020", "#ffd65c", "#ff8a1f", "#fff08a"] },
    { name: "Green",        bg: "#03200f", colours: ["#2ee67a", "#a8f060", "#14c9a0", "#62ff9e"] },
    { name: "Rainbow",      bg: "#0b0b24", colours: ["#ff5f8f", "#ffd65c", "#2ee67a", "#1f8bff"] }
  ],

  // Fish Tank creatures (SG's pictures). Fish should face right. kind "jelly"
  // pulses up and down instead of swimming. size makes one bigger or smaller.
  // weight sets how often it visits (1 is normal). rare: true means it never
  // lives in the tank and only one visits at a time.
  // Write [] to use the drawn fish. Pictures added with "My pictures" win.
  fishPictures: [
    { src: "images/fish/clownfish.webp" },
    { src: "images/fish/bannerfish.webp" },
    { src: "images/fish/discus-orange.webp" },
    { src: "images/fish/discus-spotted.webp" },
    { src: "images/fish/shark.webp", size: 1.7, weight: 1.25, rare: true },
    { src: "images/fish/jellyfish.webp", kind: "jelly", size: 1.2 }
  ],

  // Fish Tank background picture. Write "" to use the drawn tank instead.
  // Used in every mode (calm mode dims it a little).
  fishBackground: "images/fish-background.jpg",

  // Snow Globe pictures (SG's own). Leave "" to use the drawn ones.
  // Best: 1000x1000 PNG with a see-through background, standing on the bottom edge.
  // Animals visit one at a time, in this order; "say" is read aloud.
  // kind: "reindeer", "fox", "owl" or "bunny" picks the drawn one when src is "".
  snowPictures: {
    cabin: "",   // e.g. "images/snow/cabin.png"
    snowman: "", // e.g. "images/snow/snowman.png"
    animals: [
      { kind: "reindeer", name: "reindeer", say: "A reindeer came to visit.", src: "" },
      { kind: "fox",      name: "fox",      say: "A fox came to visit.",      src: "" },
      { kind: "owl",      name: "owl",      say: "An owl came to visit.",     src: "" },
      { kind: "bunny",    name: "bunny",    say: "A bunny came to visit.",    src: "" }
    ]
  },

  // Fireworks sounds in regular mode are built in (calm mode uses soft sounds).
  // To use your own recordings instead, put them in the "sounds" folder and
  // write their names here, for example bang: "sounds/bang.mp3".
  fireworksSounds: { launch: "", bang: "", crackle: "" },

  // Starting choices for the Settings panel. Each device remembers changes.
  defaults: {
    sound: true,
    volume: 70,      // 0 to 100
    calm: false,     // turned on automatically if the device is set to reduce motion
    size: 1,         // 1 normal, 1.5 big, 2 extra big
    dwell: 0,        // eye gaze dwell in seconds, 0 = off
    switchGap: 0.3,  // seconds to ignore repeat switch presses
    scan: true,      // switch scanning on the menu (activities light up in turn)
    scanSeconds: 2,  // how long each activity stays lit
    holdSeconds: 3,  // hold a switch this long inside an activity to go back to the menu (0 = off)
    snowSound: "wind", // Snow Globe sound: "wind", "music" (wind and music box) or "bells" (wind and sleigh bells)
    snowMotion: true,  // shake or tilt an iPad or tablet to shake the Snow Globe
    useMine: true,   // use pictures added with "My pictures" when there are any
    keepPictures: false // false: added pictures are forgotten when the page closes (safer on shared devices)
  }
};
