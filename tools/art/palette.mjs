/**
 * The Remastered palette. Every value is sampled from Akiko Robinson's own hand-drawn
 * pieces in assets/classic (the file it was sampled from is in the comment). New art uses
 * these names, not raw hex, so a consistency pass can retune a family in one place.
 * See docs/art/style-guide.md.
 */
export const P = {
  // Ink and surrounds
  black: "#000000", // every picture's surround (the SWF stage)
  ink: "#1a1410", // object outlines (warm near-black; buildings, furniture)
  inkSoft: "#333333", // secondary outlines, glasses frames (people/m_old)

  // Night (closed.svg, people/man_prowl.svg)
  night0: "#0b1018",
  night1: "#182838",
  night2: "#1d283f",
  night3: "#302858",
  moon: "#fff8d0",

  // Skin, pale (people/m_old)
  skinPaleHi: "#eaad9c",
  skinPale: "#df8664",
  skinPaleLo: "#b9644a",
  skinPaleLine: "#b35e44",
  // Skin, medium (people/f_adult)
  skinMedHi: "#d88870",
  skinMed: "#c08868",
  skinMedLo: "#8b5c42",
  skinMedLine: "#5a3727",
  // Skin, dark (people/m_adult_3)
  skinDarkHi: "#a47155",
  skinDark: "#855b45",
  skinDarkLo: "#5a3524",
  // Blush and lips (people/f_adult)
  blush: "#e0907c",
  lip: "#9c3c39",
  lipLo: "#702a26",
  lipRed: "#990000",

  // Eyes
  eyeWhite: "#e8e4dc",
  eyeWhiteLo: "#b8b0a8",
  irisBlue: "#336699", // people/m_old
  irisBlue2: "#386090",
  irisTeal: "#2a6f6f", // people/m_adult_3
  irisBrown: "#6b4423",
  pupil: "#101010",

  // Hair
  hairWhite: "#ffffff",
  hairGrey: "#cccccc",
  hairGreyLo: "#999999",
  hairBrown: "#683800", // people/f_adult
  hairBrown2: "#643600",
  hairBrownLo: "#281810",
  hairBlack: "#2e2e2e", // people/m_adult_3
  hairRed: "#8a3a1a",

  // Cloth
  olive: "#b89040", // people/m_old cardigan
  oliveLo: "#707028",
  maroon: "#9c3c39", // people/f_adult top
  maroonLo: "#702a26",
  suit: "#4e4f49", // people/m_adult_3
  suitLo: "#2e2e2e",
  suitHi: "#7a7b75",
  shirt: "#f0f0f0",
  shirtLo: "#cccccc",
  tieBlue: "#386090",
  scrubs: "#4a9a9a", // people/m_doctor
  nurseWhite: "#d0d8e0", // places/hospital_desk
  nurseWhiteLo: "#a8b0c0",

  // Wood (places/desk, bar)
  woodHi: "#cc9933",
  wood: "#9b712b",
  woodMid: "#8d692c",
  woodLo: "#683800",
  woodDark: "#413014",
  woodDeep: "#30240f",
  boards: "#663300", // places/funeral_home(sucky)

  // Brick (places/creamation_oven)
  brick: "#7f3220",
  brickHi: "#875b42",
  brickLo: "#342311",
  brickDeep: "#1a0800",

  // Stone and greys (ui/building-*, places/funeral_home(black))
  white: "#ffffff",
  grey1: "#e8e8e0",
  grey2: "#cccccc",
  grey3: "#999999",
  grey4: "#666666",
  grey5: "#333333",
  stoneBlue: "#6d7283", // ui/building-funeral-home
  stoneBlueHi: "#9ca4ae",
  stoneBlueLo: "#493d3f",
  tomb: "#7c8696", // people/man_prowl stones, warmed
  tombHi: "#a8b4c4",
  tombLo: "#4a5260",

  // Earth (places/funeral_home(sucky), map)
  earth: "#644a2a",
  earthLo: "#3d2c1a",
  sand: "#d0a878",
  sandLo: "#c09868",
  mud: "#705020",

  // Greens (ui/deathville-map-base, places/funeral-ceremony)
  grassHi: "#a2b66d",
  grass: "#93ae60",
  grassMid: "#698d1c",
  grassLo: "#558311",
  moss: "#61772f",
  leafDark: "#284828",
  leafDeep: "#184030",
  leafNight: "#0e1d11",
  shackRoof: "#586838",
  feltGreen: "#205038",

  // Cold steel (places/embalming-room)
  steel0: "#203030",
  steel1: "#405860",
  steel2: "#486870",
  steel3: "#689098",
  steel4: "#a8b0b8",
  steel5: "#d0d0d8",

  // Warm light (places/hospital_room, ui/building-church)
  lamp0: "#fff8d0",
  lamp1: "#ffe9b9",
  lamp2: "#ffdc93",
  gold: "#ffcc33",
  goldHi: "#ffff99",
  goldLo: "#b08020",
  orange: "#ff9900", // places/yangs lanterns
  flame: "#c65139",

  // Reds (places/yangs, bar)
  red: "#cc0000",
  redDark: "#990000",
  redDeep: "#330000",
  blood: "#bb3100",

  // Walls (places/desk, places/hospital_desk)
  wallPink: "#cc9999",
  wallPinkHi: "#ead0c8",
  wallCream: "#e0d0b8",
  wallTaupe: "#b8b0a0",
  wallGreen: "#bcc7bc", // places/hospital_room
  sky: "#c6ffff", // places/yangs
  skyBlue: "#38a0ff", // places/desk window
  fog: "#c8ccd0",
};

/** Families for the style guide's swatch sheet. */
export const FAMILIES = {
  "Ink and night": ["black", "ink", "inkSoft", "night0", "night1", "night2", "night3", "moon"],
  Skin: [
    "skinPaleHi",
    "skinPale",
    "skinPaleLo",
    "skinMedHi",
    "skinMed",
    "skinMedLo",
    "skinDarkHi",
    "skinDark",
    "skinDarkLo",
    "blush",
    "lip",
  ],
  "Eyes and hair": [
    "eyeWhite",
    "irisBlue",
    "irisTeal",
    "irisBrown",
    "hairGrey",
    "hairBrown",
    "hairBrownLo",
    "hairBlack",
  ],
  Cloth: [
    "olive",
    "oliveLo",
    "maroon",
    "maroonLo",
    "suit",
    "suitHi",
    "shirt",
    "scrubs",
    "nurseWhite",
  ],
  "Wood and brick": [
    "woodHi",
    "wood",
    "woodLo",
    "woodDark",
    "woodDeep",
    "brick",
    "brickHi",
    "brickLo",
  ],
  "Stone and grey": [
    "grey1",
    "grey2",
    "grey3",
    "grey4",
    "grey5",
    "stoneBlue",
    "tomb",
    "tombHi",
    "tombLo",
  ],
  "Earth and green": [
    "sand",
    "earth",
    "earthLo",
    "grassHi",
    "grass",
    "grassMid",
    "moss",
    "leafDark",
    "leafDeep",
    "shackRoof",
  ],
  "Steel and light": [
    "steel0",
    "steel1",
    "steel3",
    "steel4",
    "steel5",
    "lamp0",
    "lamp2",
    "gold",
    "orange",
  ],
  "Reds and walls": [
    "red",
    "redDark",
    "redDeep",
    "blood",
    "wallPink",
    "wallPinkHi",
    "wallCream",
    "wallGreen",
    "fog",
  ],
};
