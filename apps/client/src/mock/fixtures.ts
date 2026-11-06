import type { ChatLine, Hud, RichText, TextColor, View } from "@fq/protocol";

/**
 * Hand-written Views for the mock transport and the tests. They cover every scene and
 * every overlay kind. Nothing here is game logic: the numbers are just plausible.
 */

const sp = (text: string, color?: TextColor): RichText[number] =>
  color ? { text, color } : { text };
const para = (...parts: RichText): RichText => parts;
const say = (who: string, line: string): RichText => [
  sp(`${who}: `, "white"),
  sp(`"${line}"`, "yellow"),
];
const lines = (...items: RichText[]): RichText =>
  items.flatMap((item, i) => (i === 0 ? item : [sp("\n\n"), ...item]));

export const HUD: Hud = {
  turns: 13,
  bpToday: 16,
  bpTotal: 1850,
  luck: 58,
  tags: { wood: 0, silver: 1, gold: 0 },
};

export const PLACES = [
  { id: "funeral-home", label: "Your Funeral Home" },
  { id: "bank", label: "Bank" },
  { id: "store", label: "Di-Mart" },
  { id: "cafe", label: "Pale Horse Cafe" },
  { id: "yangs", label: "Yang's Takeout" },
  { id: "competitors", label: "Rival Parlors" },
  { id: "church", label: "Church" },
  { id: "hospital", label: "Hospital" },
  { id: "spirit-university", label: "Spirit University" },
];

const MOOD_LEVEL: Record<string, number> = { Happy: 2, Calm: 4, Annoyed: 6, Angry: 8, Mad: 9 };

const customer = (
  mood: string,
  total: number,
  resistancePercent?: number,
  income = "Poor",
): NonNullable<View["customer"]> =>
  resistancePercent === undefined
    ? { incomeLabel: income, moodLabel: mood, moodLevel: MOOD_LEVEL[mood] ?? 5, total }
    : {
        incomeLabel: income,
        moodLabel: mood,
        moodLevel: MOOD_LEVEL[mood] ?? 5,
        total,
        resistancePercent,
      };

const NEG_BUTTONS = [
  { id: "guilt", label: "Guilt" },
  { id: "sympathy", label: "Sympathy" },
  { id: "hardsell", label: "Hard Sell" },
  { id: "softsell", label: "Soft Sell" },
  { id: "done", label: "Done" },
];

const NEG_PICTURE = { bg: "background/background_3", fg: "people/m_teen" };

const negotiation = (n: number): View => {
  const steps = [
    {
      mood: "Nervous",
      total: 400,
      resist: 62,
      text: lines(
        say("Skelly", "Cremation is quick and cheap, but think of the neighbors."),
        say("Teenage boy", "I just want something simple. I do not have much."),
        para(
          sp("Total: $400 ", "yellow"),
          sp("(Resistance: ", "yellow"),
          sp("62%", "purple"),
          sp(")", "yellow"),
        ),
      ),
    },
    {
      mood: "Annoyed",
      total: 800,
      resist: 45,
      text: lines(
        say(
          "Skelly",
          "I would stay away from cremation. Your loved one deserves better than 'bake and shake' - people would talk.",
        ),
        say("Teenage boy", "You've got a point there.. It makes me mad but you're right."),
        para(
          sp("Total: $800 ", "yellow"),
          sp("(Resistance: ", "yellow"),
          sp("45%", "purple"),
          sp(")", "yellow"),
        ),
      ),
    },
    {
      mood: "Angry",
      total: 950,
      resist: 45,
      text: lines(
        say("Skelly", "A silver casket says how much you cared."),
        say("Teenage boy", "That is a lot of money. Are you trying to rip me off?"),
        para(
          sp("Total: $950 ", "yellow"),
          sp("(Resistance: ", "yellow"),
          sp("45%", "purple"),
          sp(")", "yellow"),
        ),
      ),
    },
  ] as const;
  const step = steps[n % steps.length] ?? steps[0];
  const lastStep = n % steps.length === 2;
  return {
    scene: "location",
    title: "Customer",
    text: step.text,
    picture: NEG_PICTURE,
    hud: { ...HUD, turns: 13 - Math.min(n, 1) },
    customer: customer(step.mood, step.total, n === 0 ? undefined : step.resist),
    buttons: NEG_BUTTONS.map((b) =>
      lastStep && b.id === "hardsell"
        ? { ...b, enabled: false, hint: "The customer will not stand for a harder sell right now." }
        : b,
    ),
    music: "negotiation",
  };
};

const news = (section: "front" | "crime", isYesterday: boolean): View => ({
  scene: "news",
  title: "Funeral Times",
  text: [],
  news: {
    day: 16,
    section,
    isYesterday,
    body:
      section === "front"
        ? lines(
            para(sp("ENTIRE SOCCER TEAM KICKS COLLECTIVE BUCKET", "darkGrey")),
            para(
              sp("Some funeral parlor is going to be in for a busy week. The coach called it "),
              sp("a tragic loss of defense", "red"),
              sp(", and the mayor has asked every parlor to stay calm and keep their prices fair."),
            ),
            para(sp("A new parlor by "), sp("Skelly", "purple"), sp(" has been opened!")),
          )
        : lines(
            para(sp("CROOKED UNDERTAKER SPOTTED NEAR HOSPITAL", "darkGrey")),
            para(
              sp(
                "Witnesses say a hearse idled outside the emergency room for most of the night. Police have no suspects, only a lot of questions.",
              ),
            ),
          ),
    topToday: para(sp("Sadly, no one has managed to sell anything yet today.")),
    topYesterday: para(
      sp("Mylener", "purple"),
      sp(" from Playin' God with "),
      sp("1850", "purple"),
      sp(" Bury Points."),
    ),
  },
  buttons: [
    { id: "yesterday", label: isYesterday ? "Today" : "Yesterday" },
    {
      id: section === "front" ? "crime" : "front",
      label: section === "front" ? "Crime" : "Front Page",
    },
    { id: "announce", label: "Make Announcement" },
    { id: "continue", label: "Continue" },
  ],
  music: "town",
});

export const CHAT_SEED: ChatLine[] = [
  { text: [sp("Skelly", "white"), sp(": anyone selling silver tags today?", "yellow")] },
  {
    text: [
      sp("Mylener", "white"),
      sp(": my wood tags are going to fall out of my pocket", "yellow"),
    ],
  },
  { text: [sp("* Gravy enters the cafe *", "cyan")] },
];

export const FIXTURES = {
  lobby: {
    scene: "lobby",
    title: "Welcome",
    note: para(
      sp(
        "Welcome to Deathville, where business is always dying to come in. Log in to run your own funeral parlor.",
      ),
    ),
    text: para(
      sp("The sign over the door reads: "),
      sp("Open for Business.", "white"),
      sp("\nThe town of Deathville has room for one more parlor."),
    ),
    picture: { bg: "places/funeral_home(black)" },
    buttons: [
      { id: "login", label: "Log In" },
      { id: "guest", label: "Play As Guest" },
      { id: "new", label: "New Player" },
    ],
    music: "intro",
  },

  news: news("front", false),
  newsCrime: news("crime", false),
  newsYesterday: news("front", true),

  desk: {
    scene: "desk",
    title: "Your Desk",
    text: lines(
      para(sp("You sit at your desk. The phone is quiet and the coffee is cold.")),
      para(sp("You have "), sp("13", "purple"), sp(" turns left today.")),
    ),
    picture: { bg: "places/desk" },
    hud: HUD,
    buttons: [
      { id: "wait", label: "Wait For Customer" },
      { id: "map", label: "Visit Town" },
      { id: "cafe", label: "Cafe" },
      { id: "stats", label: "Stats" },
      { id: "rankings", label: "Rankings" },
    ],
    music: "parlor",
  },

  wait: {
    scene: "location",
    title: "Waiting",
    text: para(
      sp(
        "You stand by the front door and watch the street. Footsteps, a shadow, then the bell on the door rings...",
      ),
    ),
    picture: { bg: "wait" },
    hud: HUD,
    buttons: [
      { id: "meet", label: "Greet Customer" },
      { id: "leave", label: "Leave" },
    ],
  },

  negotiation: negotiation(0),

  shop: {
    scene: "location",
    title: "Di-Mart",
    note: para(
      sp(
        "Di-Mart sells everything a funeral parlor needs, from lilies to lottery tickets. A clerk eyes your wallet.",
      ),
    ),
    text: para(
      sp("You look at your watch, you have time to visit "),
      sp("2", "white"),
      sp(" more parlors today."),
    ),
    picture: { bg: "places/store", fg: "people/store_guy" },
    hud: HUD,
    buttons: [
      { id: "buy", label: "Buy Casket Tag" },
      { id: "look", label: "Look" },
      { id: "leave", label: "Leave" },
    ],
    music: "shop",
  },

  map: {
    scene: "map",
    title: "Deathville Map",
    text: [],
    map: PLACES,
    buttons: [{ id: "home", label: "Back To Desk" }],
    music: "town",
  },

  cafe: {
    scene: "cafe",
    title: "Morning Coffee Cafe",
    note: para(sp("Steam curls up from the cups. Everyone here is either grieving or gossiping.")),
    text: para(sp("The cafe hums with quiet talk.")),
    picture: { bg: "bar" },
    hud: HUD,
    chat: CHAT_SEED,
    buttons: [{ id: "leave", label: "Leave" }],
    music: "cafe",
  },

  stats: {
    scene: "stats",
    title: "Your Stats",
    text: lines(
      para(sp("Parlor Report", "brown")),
      para(sp("Bury Points today: "), sp("16", "purple")),
      para(sp("Bury Points total: "), sp("1,850", "purple")),
      para(sp("Caskets sold: "), sp("42", "purple"), sp("\nHearse: "), sp("Rusty Wagon", "green")),
      para(sp("Cash on hand: "), sp("$5,310", "green")),
    ),
    stats: [
      { id: "turns", label: "Turns left", value: "9" },
      { id: "bpTotal", label: "Total Bury Points", value: "1,850" },
      { id: "money", label: "Money", value: "5,310" },
      { id: "wood", label: "Wood tags", value: "2" },
      { id: "silver", label: "Silver tags", value: "1" },
      { id: "gold", label: "Gold tags", value: "0" },
      { id: "plots", label: "Plots", value: "42" },
      { id: "bpToday", label: "Bury Points today", value: "16" },
      { id: "psych", label: "Psychology", value: "Level 2" },
      { id: "rating", label: "Rating", value: "#2 - A respectable name in dying." },
      { id: "ride", label: "Ride", value: "Rusty Wagon" },
    ],
    buttons: [{ id: "back", label: "Back" }],
  },

  rankings: {
    scene: "rankings",
    title: "Rankings",
    text: lines(
      para(sp("Top Parlors", "brown")),
      para(sp("1. ", "purple"), sp("Mylener", "white"), sp(" (Playin' God): 1850 BP")),
      para(sp("2. ", "purple"), sp("Skelly", "white"), sp(" (Bone Voyage): 1620 BP")),
      para(sp("3. ", "purple"), sp("Gravy", "white"), sp(" (Six Feet Under Par): 1204 BP")),
      para(sp("4. ", "purple"), sp("You", "white"), sp(" (Eternal Rest Stop): 980 BP")),
    ),
    rankings: [
      {
        place: 1,
        playerId: 4,
        name: "Mylener",
        parlor: "Playin' God",
        male: false,
        bp: 1850,
        title: "The undertaker other undertakers call when they need one.",
        status: "on now",
        online: true,
      },
      {
        place: 2,
        playerId: 7,
        name: "Skelly",
        parlor: "Bone Voyage",
        male: true,
        bp: 1620,
        title: "Known for quick service.",
        status: "in cafe",
        online: true,
      },
      {
        place: 3,
        playerId: 2,
        name: "Gravy",
        parlor: "Six Feet Under Par",
        male: true,
        bp: 1204,
        title: "Nobody has complained. Nobody can.",
        status: "",
        online: false,
      },
      {
        place: 4,
        playerId: 0,
        name: "You",
        parlor: "Eternal Rest Stop",
        male: true,
        bp: 980,
        title: "Still working on a reputation.",
        status: "on now",
        online: true,
      },
    ],
    buttons: [
      { id: "attack", label: "Attack A Rival" },
      { id: "back", label: "Back" },
    ],
  },

  battle: {
    scene: "location",
    title: "Fight",
    text: para(
      sp(
        "You and Skelly circle each other behind the parlor. He smells of lilies and bad intentions.",
      ),
    ),
    picture: { bg: "places/funeral_enemy" },
    hud: HUD,
    battle: { me: { name: "You", hp: 42, hpMax: 60 }, them: { name: "Skelly", hp: 51, hpMax: 60 } },
    buttons: [
      { id: "strike", label: "Strike" },
      { id: "dodge", label: "Dodge" },
      { id: "flee", label: "Flee" },
    ],
    music: "fight",
  },
} satisfies Record<string, View>;

export type FixtureKey = keyof typeof FIXTURES;

/** One View per overlay kind, built on the desk. */
export const OVERLAY_FIXTURES = {
  message: {
    ...FIXTURES.desk,
    overlay: {
      kind: "message",
      id: "sale",
      text: lines(
        para(
          sp("You sold a silver casket for "),
          sp("$950", "purple"),
          sp(" and earned "),
          sp("14", "purple"),
          sp(" Bury Points."),
        ),
      ),
      picture: { fg: "stuff/money_bag" },
    },
    sounds: ["cash"],
  },
  textInput: {
    ...FIXTURES.news,
    overlay: {
      kind: "textInput",
      id: "announce",
      prompt: "Please enter your text.",
      maxLength: 120,
      multiline: true,
    },
  },
  textInputSingle: {
    ...FIXTURES.lobby,
    overlay: { kind: "textInput", id: "name", prompt: "What is your name?", maxLength: 24 },
  },
  playerPicker: {
    ...FIXTURES.rankings,
    overlay: {
      kind: "playerPicker",
      id: "attack",
      prompt: "Whom will you attack?",
      players: [
        { id: 2, name: "Skelly" },
        { id: 3, name: "Gravy" },
        { id: 4, name: "Mylener" },
      ],
    },
  },
  confirm: {
    ...FIXTURES.shop,
    overlay: {
      kind: "confirm",
      id: "buy",
      text: para(sp("Buy a silver casket tag for "), sp("$1,200", "purple"), sp("?")),
    },
  },
} satisfies Record<string, View>;

/** The Solo host's own lobby (the player is logged off between days), as it builds it. */
const SOLO_LOBBY: View = {
  scene: "lobby",
  title: "Funeral Quest",
  text: para(sp("Your parlor is closed for the night. Your rivals are not sleeping.")),
  picture: { bg: "places/funeral_home(black)" },
  buttons: [
    { id: "solo:resume", label: "Open the Parlor" },
    { id: "solo:end-day", label: "Sleep Until Tomorrow" },
  ],
};

export const ALL_FIXTURES: Record<string, View> = {
  ...FIXTURES,
  "solo.lobby": SOLO_LOBBY,
  negotiation1: negotiation(1),
  negotiation2: negotiation(2),
  ...Object.fromEntries(Object.entries(OVERLAY_FIXTURES).map(([k, v]) => [`overlay.${k}`, v])),
};

export { negotiation, news };
