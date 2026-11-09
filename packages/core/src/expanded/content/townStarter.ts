// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" here is a dollar sign before a {price} placeholder, not a template.
/**
 * ============================================================================
 *  EXPANDED STARTER CONTENT: THE TOWN
 * ============================================================================
 * The graveyard, the church, City Hall, the hospital, the Reaper Club, the
 * bank, the daily news, the weather, the ordinances, the black market and
 * two story arcs (docs/expanded-rules.md section 25). Shapes are in
 * `./townTypes.ts`. Writers: multiply everything. Ids that rules refer to
 * are the injury ids in `rules.town` ("dog-bite", "sprained-ankle",
 * "cracked-skull", "pickled-liver", "kneecapped") and the permit ids
 * ("signage", "zoning", "crematory"); everything else is free.
 *
 * Voice: the original's. Deadpan, crude, everybody in town is on the take.
 * No slurs, nothing about minors, no real brands or people.
 * ============================================================================
 */
import type { ExpandedTownContent } from "./townTypes.js";

export const TOWN_STARTER: ExpandedTownContent = {
  cast: {
    mayor: "Mayor Wilma Boggs",
    clubOwner: "Lucius Vane",
    nurse: "Nurse Gertie",
    inspector: "Inspector Pratt",
    teller: "the teller",
    coroner: "Dr. Ignatius Grimble",
    mourne: "Augustus Mourne",
    sons: "Ned and Rollo",
    mournes: "Mourne & Sons",
  },

  // The Remastered pack's art (assets/remastered/manifest.json, docs/art/remastered-notes.md).
  pictures: {
    graveyard: { bg: "places/graveyard" },
    church: { fg: "people/churchguy_h", bg: "background/background_church" },
    bingo: { bg: "places/bingo-night" },
    cityHall: { fg: "people/mayor-grubb", bg: "places/mayor-office" },
    cityHallOutside: { bg: "places/city-hall" },
    inspection: { fg: "people/inspector-mudge", bg: "places/mayor-office" },
    hospital: { bg: "places/sick-room" },
    hospitalDesk: { fg: "people/nurse-gertie", bg: "places/hospital_desk" },
    club: { fg: "people/lucius-vane", bg: "places/reaper-club" },
    clubDoor: { bg: "places/reaper-club-door" },
    clubTables: { bg: "places/reaper-tables" },
    blackMarket: { bg: "places/black-market" },
    bank: { bg: "places/bank" },
    vault: { fg: "people/teller-prudence", bg: "places/bank-vault" },
    duel: { bg: "places/graveyard-duel" },
  },

  monuments: [
    "A Tasteful Granite Bench",
    "The Weeping Angel (Slightly Cross-Eyed)",
    "A Marble Obelisk With Your Name On It",
    "The Eternal Flame (Gas Bill Included)",
    "A Bronze Statue of Yourself, Pointing at Something Important",
  ],

  permits: {
    signage: {
      name: "Signage Permit",
      description: "Lets you put your face on a billboard. The town has suffered worse.",
    },
    zoning: {
      name: "Zoning Variance",
      description: "Lets you build a garden on land the town swears is not a landfill.",
    },
    crematory: {
      name: "Crematory Emissions Permit",
      description: "The smoke is now legally somebody else's problem.",
    },
  },

  injuries: [
    {
      id: "dog-bite",
      causes: ["rob"],
      name: "Dog Bite",
      text: "`$The groundskeeper's dog got a good piece of you. It looked proud.",
      days: 2,
      hp: 3,
      treatPrice: 400,
    },
    {
      id: "sprained-ankle",
      causes: ["duel", "fight"],
      name: "Sprained Ankle",
      text: "`$You fell into an open grave. The occupant did not get up to help.",
      days: 2,
      hp: 4,
      turns: 1,
      treatPrice: 800,
    },
    {
      id: "cracked-skull",
      causes: ["duel", "fight"],
      name: "Cracked Skull",
      text: "`$Something cracked. You hope it was the headstone.",
      days: 3,
      hp: 8,
      patience: 1,
      treatPrice: 1500,
    },
    {
      id: "pickled-liver",
      causes: ["roulette"],
      name: "Pickled Liver",
      text: "`$That was not vodka. Your liver will be very well preserved.",
      days: 2,
      hp: 2,
      patience: 1,
      treatPrice: 600,
    },
    {
      id: "kneecapped",
      causes: ["hit"],
      name: "Busted Kneecaps",
      text: "`$Two men with a tire iron explained things to your knees.",
      days: 4,
      hp: 10,
      patience: 1,
      turns: 1,
      treatPrice: 3000,
    },
  ],

  news: [
    {
      id: "small-quake",
      title: "SHAKEUP IN DEATHVILLE",
      message:
        'Small earthquake today. Some casualties. "I barely felt it, actually," comments the Mayor from her basement.',
      effect: "+1 turn today, fewer empty waits",
      weight: 2,
      modifiers: [
        { key: "turns.daily", op: "add", value: 1 },
        { key: "wait.eventOdds", op: "mul", value: 0.5 },
      ],
    },
    {
      id: "big-quake",
      title: "MORTUARIES DO ROCKIN' BUSINESS",
      message:
        "Huge earthquake hits downtown! \"I'm glad we have so many funeral parlors in this town. We're gonna need 'em today,\" says a man trapped under a bus.",
      effect: "+2 turns today, families spend 10% more",
      weight: 0.5,
      minDay: 4,
      modifiers: [
        { key: "turns.daily", op: "add", value: 2 },
        { key: "customer.limitMult", op: "mul", value: 1.1 },
      ],
    },
    {
      id: "dimart-sale",
      title: "DEATH WITH DIGNITY",
      message:
        "20 percent off all caskets at Di-Mart! For a comfortable eternal lay, come see us today!",
      effect: "Di-Mart caskets 20% off today",
      modifiers: [{ key: "store.stockPrice", op: "mul", value: 0.8 }],
    },
    {
      id: "burger",
      title: "A BURGER TO DIE FOR",
      message:
        "E. coli outbreak hits Bill's Big Burger, leaving many dead or just puking a lot. The puking ones are in a mood.",
      effect: "+1 turn today, customers arrive crankier",
      modifiers: [
        { key: "turns.daily", op: "add", value: 1 },
        { key: "customer.mood", op: "add", value: 0.5 },
      ],
    },
    {
      id: "heatwave-news",
      title: "HEAT WAVE: THE DEAD WON'T KEEP",
      message:
        '"Get them in the ground by lunch or you\'ll smell them by dinner," warns the county coroner.',
      effect: "More bodies to prepare, customers less patient",
      modifiers: [
        { key: "prep.chance", op: "mul", value: 1.5 },
        { key: "customer.patience", op: "add", value: -1 },
      ],
    },
    {
      id: "pizza",
      title: "LOCAL PIZZA COMPANY SCREWS UP BIG TIME",
      message:
        '"If they didn\'t eat the pizza in under 30 minutes they would die. Bad cheese indeed," reports some dude. Guilty families are paying for nice funerals.',
      effect: "Families spend 10% more today",
      modifiers: [{ key: "customer.limitMult", op: "mul", value: 1.1 }],
    },
    {
      id: "zoo",
      title: "ZOO ANIMALS ESCAPE, SEEK REVENGE ON HUMANS AND COTTON CANDY",
      message: '"Now their rage is out of the cage," says the local zookeeper, from a tree.',
      effect: "Twice the unusual customers today",
      modifiers: [{ key: "customer.specialChance", op: "mul", value: 2 }],
    },
    {
      id: "crash",
      title: "MARKET CRASH: BANKERS JUMP, DON'T TIP",
      message:
        "Stocks fell 40 percent. So did several investors, from the tenth floor. Di-Mart is dumping inventory.",
      effect: "Poorer customers, caskets 10% off",
      minDay: 3,
      modifiers: [
        { key: "customer.incomeShift", op: "add", value: -10 },
        { key: "store.stockPrice", op: "mul", value: 0.9 },
      ],
    },
    {
      id: "lottery",
      title: "LOCAL MAN WINS LOTTERY, DIES OF EXCITEMENT",
      message:
        "His family is rich now, and so are their friends, who all seem to be dropping dead in sympathy.",
      effect: "Richer customers today",
      modifiers: [{ key: "customer.incomeShift", op: "add", value: 10 }],
    },
    {
      id: "police-strike",
      title: "POLICE ON STRIKE",
      message:
        '"We want dental," says the Police Commissioner. Crime is up. So is the dental plan.',
      effect: "Fights pay 20% more today",
      minDay: 3,
      modifiers: [{ key: "pvp.gainMult", op: "mul", value: 1.2 }],
    },
    // Stories that remember how an arc ended, or that need a mayor (section 22.5).
    {
      id: "steeple-bells",
      title: "BELLS RING AGAIN AT ST. MORTIMER'S",
      message:
        "The rebuilt steeple's bells rang for the first time today. Father Smyth says they are a little flat. Nobody minds.",
      effect: "Calmer customers today",
      when: { arcs: [{ id: "steeple", endings: ["rebuilt"] }] },
      modifiers: [{ key: "customer.mood", op: "add", value: -0.2 }],
    },
    {
      id: "garage-opens",
      title: "LUCIUS VANE CUTS RIBBON ON PARKING GARAGE",
      message:
        "Where St. Mortimer's steeple once stood, Level 3 now offers validated parking for the Reaper Club. The first car was towed within the hour.",
      effect: "The club's cover is 1 wood less today",
      when: { arcs: [{ id: "steeple", endings: ["paved"] }] },
      modifiers: [{ key: "club.cover", op: "add", value: -1 }],
    },
    {
      id: "mayor-ribbon",
      title: "{mayor} OPENS NEW BENCH",
      message:
        "The Mayor cut the ribbon on a bench outside City Hall today and sat on it for the cameras. Business owners report a good mood all round.",
      effect: "Customers a little richer today",
      when: { mayor: true },
      modifiers: [{ key: "customer.limitMult", op: "mul", value: 1.03 }],
    },
  ],

  weather: [
    {
      id: "clear",
      label: "Clear",
      morning: [
        "A clear, crisp morning. Perfect weather for a funeral, or for causing one.",
        "The sun is out. Somewhere a bird is singing. You find this suspicious.",
      ],
      effect: "no effect",
      weight: 3,
      modifiers: [],
    },
    {
      id: "rain",
      label: "Rain",
      morning: [
        "It's pouring. Rain makes people sad, and sad people buy flowers.",
        "A grey drizzle. The mourners will cry harder and haggle less.",
      ],
      effect: "customers a little less cheap",
      weight: 2,
      modifiers: [{ key: "customer.cheapness", op: "add", value: -0.3 }],
    },
    {
      id: "fog",
      label: "Fog",
      morning: [
        "A dense fog covers the mounds and headstones. A good night to dig where you shouldn't.",
        "Fog so thick you can't see your own hearse. The groundskeeper can't see you either.",
      ],
      effect: "+15 luck robbing graves, more risky offers",
      weight: 1.5,
      modifiers: [
        { key: "graveyard.robLuck", op: "add", value: 15 },
        { key: "wait.riskOdds", op: "mul", value: 1.5 },
      ],
    },
    {
      id: "storm",
      label: "Thunderstorm",
      morning: [
        "Thunder. Every customer jumps at each crack and wants to get this over with.",
        "Lightning hit the church again. Father Smyth is taking it personally.",
      ],
      effect: "customers 1 patience shorter",
      weight: 1,
      modifiers: [{ key: "customer.patience", op: "add", value: -1 }],
    },
    {
      id: "heat",
      label: "Scorcher",
      morning: [
        "It's a hundred and four in the shade, and the shade is in the cooler with the bodies.",
      ],
      effect: "customers arrive a little angrier",
      weight: 1,
      modifiers: [{ key: "customer.mood", op: "add", value: 0.3 }],
    },
    {
      id: "snow",
      label: "Snow",
      morning: ["Snow. The ground is too hard to dig, so families are paying extra for the crypt."],
      effect: "families spend 5% more",
      weight: 1,
      modifiers: [{ key: "customer.limitMult", op: "mul", value: 1.05 }],
    },
  ],

  ordinances: [
    {
      id: "speed-limit",
      title: "Raise the Speed Limit to 85",
      text: "\"Get where you're going faster, or don't get there at all.\"",
      effect: "+1 turn a day, customers spend 5% less",
      modifiers: [
        { key: "turns.daily", op: "add", value: 1 },
        { key: "customer.limitMult", op: "mul", value: 0.95 },
      ],
    },
    {
      id: "open-carry",
      title: "Open Carry for Morticians",
      text: '"A shovel is a tool. A tool is a right."',
      effect: "fights pay 25% more",
      modifiers: [{ key: "pvp.gainMult", op: "mul", value: 1.25 }],
    },
    {
      id: "quiet-hours",
      title: "Graveyard Quiet Hours",
      text: '"Let the dead rest, and let the neighbors sleep."',
      effect: "no graveyard duels, robbing graves -15 luck, calmer customers",
      modifiers: [
        { key: "graveyard.duels", op: "mul", value: 0 },
        { key: "graveyard.robLuck", op: "add", value: -15 },
        { key: "customer.mood", op: "add", value: -0.2 },
      ],
    },
    {
      id: "tax-holiday",
      title: "Small Business Tax Holiday",
      text: "\"The town can't afford it, so let's do it twice as hard.\"",
      effect: "parlor upgrades 10% off, permits half price",
      modifiers: [
        { key: "parlor.upgradePrice", op: "mul", value: 0.9 },
        { key: "city.permitPrice", op: "mul", value: 0.5 },
      ],
    },
    {
      id: "embalming-act",
      title: "Mandatory Embalming Act",
      text: "\"Everybody gets the works. It's the law now. Don't ask who lobbied.\"",
      effect: "families spend 5% more but haggle harder",
      modifiers: [
        { key: "customer.limitMult", op: "mul", value: 1.05 },
        { key: "customer.cheapness", op: "add", value: 0.3 },
      ],
    },
    {
      id: "sin-tax",
      title: "Sin Tax on Nightlife",
      text: '"If you can afford to dance, you can afford to pay for the potholes."',
      effect: "Reaper Club cover +2 tags, bingo pays the whole pot, savings +0.2% a day",
      modifiers: [
        { key: "club.cover", op: "add", value: 2 },
        { key: "church.bingoCut", op: "mul", value: 0 },
        { key: "bank.savingsRate", op: "add", value: 0.002 },
      ],
    },
  ],

  market: [
    {
      id: "rabbit-foot",
      name: "Rabbit's Foot (Still Twitching)",
      text: "Lucky for you. Less lucky for the rabbit, who is around here somewhere.",
      price: 2000,
      reward: { luck: 5 },
    },
    {
      id: "vest",
      name: "Kevlar Vest, One Small Hole",
      text: "Stops the next injury. The previous owner says it works, mostly.",
      price: 3000,
      reward: {},
      grant: "armor",
    },
    {
      id: "hot-casket",
      name: "Gold Casket That Fell Off a Truck",
      text: "Half the Di-Mart price. Don't ask whose truck. Goes in your storeroom.",
      price: 2000,
      reward: { karma: -1 },
      grant: "gold-casket",
    },
    {
      id: "coroner-list",
      name: "The Coroner's Morning List",
      text: "Names, addresses, time of death. A sure customer, if you knock first.",
      price: 1500,
      reward: { karma: -1 },
      grant: "lead",
    },
    {
      id: "forged-permit",
      name: "Forged Permit",
      text: "The cheapest City Hall permit you don't have, signed by a mayor who may not exist.",
      price: 1500,
      reward: { karma: -3 },
      grant: "permit",
      weight: 0.7,
    },
    {
      id: "filed-tag",
      name: "A Gold Tag, Numbers Filed Off",
      text: "One gold tag. It came off somebody's casket. Possibly with them still in it.",
      price: 5000,
      reward: { gold: 1, karma: -1 },
      weight: 0.7,
    },
    {
      id: "tap-water",
      name: "Holy Water (Tap)",
      text: "One bottle. It's as holy as you believe it is. Bless a customer with it.",
      price: 400,
      reward: {},
      grant: "holy-water",
    },
    {
      id: "tiny",
      name: "A Large Man Named Tiny",
      text: "Sleeps on your porch tonight. Nobody gets past Tiny. Tiny gets past everybody.",
      price: 2500,
      reward: {},
      grant: "bodyguard",
    },
  ],

  arcs: [
    {
      id: "steeple",
      title: "The Steeple of St. Mortimer's",
      earliest: 5,
      latest: 12,
      start: "crack",
      beats: [
        {
          id: "crack",
          headline: "LIGHTNING SPLITS ST. MORTIMER'S STEEPLE",
          story:
            'Father Smyth blames the lightning; the lightning has no comment. The church needs money for repairs. Meanwhile Reaper Club owner Lucius Vane has offered to buy the lot for a parking garage. "People die in parking garages all the time," Vane said. "Everybody here wins." Give at the church or at the club; the bigger pile decides in four days.',
          appeals: [
            {
              place: "church",
              side: "good",
              label: "Give to the Steeple Fund",
              thanks: "`$Father Smyth counts your `w${money}`$ twice and blesses you once.",
              amount: 1000,
              karma: 1,
            },
            {
              place: "reaper-club",
              side: "evil",
              label: "Chip In for the Bulldozer",
              thanks:
                '`$Lucius Vane pockets your `w${money}`$ and calls you "partner." Nobody has ever called you partner.',
              amount: 1000,
              karma: -1,
            },
          ],
          after: 4,
          next: { test: { kind: "sideLeads", side: "good" }, ifTrue: "rebuilt", ifFalse: "paved" },
        },
        {
          id: "rebuilt",
          headline: "BELLS RING AGAIN OVER DEATHVILLE",
          story:
            "The steeple is back, a foot taller than before out of spite. The town is calmer for it. {top} gave the most and gets a brass plaque that nobody will read.",
          modifiers: [{ key: "customer.mood", op: "add", value: -0.3 }],
          days: 5,
          rewards: [
            { to: "good", reward: { reviews: 2, karma: 1 } },
            { to: "top", reward: { bp: 50 } },
          ],
          ending: "rebuilt",
        },
        {
          id: "paved",
          headline: "ST. MORTIMER'S IS NOW LEVEL 2, ROW C",
          story:
            "The bulldozers came at dawn. Bingo is cancelled until somebody finds the cards under the rubble. The Reaper Club is celebrating with cheap cover. {top} gave the most and gets a reserved space.",
          modifiers: [
            { key: "church.bingo", op: "mul", value: 0 },
            { key: "club.cover", op: "add", value: -1 },
            { key: "prep.chance", op: "mul", value: 1.3 },
          ],
          days: 5,
          rewards: [
            { to: "evil", reward: { bp: 30 } },
            { to: "top", reward: { bp: 50 } },
          ],
          ending: "paved",
        },
      ],
    },
    {
      id: "cough",
      title: "The Grey Cough",
      earliest: 10,
      latest: 20,
      start: "outbreak",
      beats: [
        {
          id: "outbreak",
          headline: "MYSTERY COUGH SWEEPS DEATHVILLE",
          story:
            'The coroner calls it "a cough with ambitions." Business is booming, and the families are frantic. If too many of them storm out of our parlors, the papers say they\'ll take their dead to Bigtown.',
          modifiers: [
            { key: "turns.daily", op: "add", value: 1 },
            { key: "customer.mood", op: "add", value: 0.5 },
          ],
          days: 4,
          appeals: [
            {
              place: "city-hall",
              side: "good",
              label: "Fund the Cough Clinic",
              thanks:
                "`$The Mayor's office takes your `w${money}`$. A clinic will be built, or at least discussed.",
              amount: 1000,
              karma: 1,
            },
          ],
          after: 4,
          next: { test: { kind: "walkouts", perPlayer: 3 }, ifTrue: "flee", ifFalse: "hailed" },
        },
        {
          id: "flee",
          headline: "FAMILIES FLEE TO BIGTOWN FOR FUNERALS",
          story:
            "\"At least in Bigtown the undertakers don't throw you out,\" said one mourner, loading grandma into a station wagon. Deathville's morticians are poorer for a week.",
          modifiers: [{ key: "customer.incomeShift", op: "add", value: -8 }],
          days: 5,
          ending: "fled",
        },
        {
          id: "hailed",
          headline: "DEATHVILLE'S MORTICIANS HAILED AS HEROES",
          story:
            "Not one grieving family turned away, or not many. The cough is passing, and families are paying a little extra out of gratitude.",
          modifiers: [{ key: "customer.limitMult", op: "mul", value: 1.1 }],
          days: 5,
          rewards: [{ to: "good", reward: { reviews: 2 } }],
          after: 3,
          next: { test: { kind: "hasMayor" }, ifTrue: "credit", ifFalse: "statue" },
        },
        {
          id: "credit",
          headline: "MAYOR {mayor} TAKES CREDIT FOR CURE",
          story:
            'At a press conference the Mayor thanked "the brave morticians, and also me, mostly me." Every parlor in town got a certificate. The Mayor got a parade.',
          rewards: [
            { to: "mayor", reward: { bp: 100 } },
            { to: "all", reward: { bp: 10 } },
          ],
          ending: "credit",
        },
        {
          id: "statue",
          headline: "TOWN ERECTS STATUE OF THE UNKNOWN UNDERTAKER",
          story:
            "With nobody in charge to take the credit, the town gave it to all of you: a statue in the square of a man in a black suit holding out his hand, palm up.",
          rewards: [{ to: "all", reward: { bp: 30 } }],
          ending: "statue",
        },
      ],
    },
  ],

  text: {
    hints: {
      noTurns: "No turns left",
      notEnoughCash: "Not enough cash",
      notEnoughTags: "Not enough wood tags",
      doneToday: "Done for today",
      karmaTooHigh: "Your karma is too clean for this",
      karmaTooLow: "Your karma isn't good enough",
      noRivals: "Nobody to pick",
      soldOut: "Sold out",
      limitReached: "Limit {limit}",
      costsTurns: "{turns} turn",
      needsPermit: "Needs a {name} from City Hall",
      closedToday: "Closed today",
      alreadyHave: "Already have it",
      notNow: "Not now",
      yourVote: "Your vote",
    },

    graveyard: {
      title: "Town Graveyard",
      note: "A dense fog covers the many mounds and headstones that make up the town graveyard. You see other morticians dancing through the memorials as they clean, adjust and make room for new occupants.",
      intro:
        "`$Nothing relaxes you like a visit to the town grave site.\n\nYour parlor has `w{plots}`$ plots out here. Your row is marked by `w{monument}`$.\n`$You have time for `w{duels}`$ more duel today.",
      noMonument: "a wooden stake with your name in crayon",
      buttons: {
        monuments: "Monuments",
        tend: "Tend the Graves",
        rob: "Rob a Fresh Grave",
        duel: "Challenge a Rival",
        look: "Look Around",
        leave: "Leave",
        back: "Back",
        swing: "Swing",
        shove: "Shove",
        yield: "Yield",
        continue: "Continue",
      },
      monumentsIntro:
        '`wA stonecutter with a cigarette: `$"Your row\'s got {current}. People judge a parlor by its dead, you know. Bigger stone, better reputation."\n\n',
      monumentLine:
        "`$Next up: `w{name}`$ for `w${price}`$. The town will talk about it for days (`5+{bp} BP`$, and a better rating while it stands).\n",
      monumentBought:
        "`$The stonecutter unveils `w{name}`$. A small crowd gathers to look at it and at you. `5(+{bp} BP)`$",
      allBuilt:
        "`$You already have the biggest thing in the graveyard. The stonecutter suggests a moat. You decline.\n",
      tended: [
        "`$You pull weeds, straighten flowers and apologize to a few headstones. You feel lucky. `5(+{luck} luck)`$",
        "`$You rake the paths and wipe the bird mess off old Mrs. Hubble. Mourners nod at you. `5(+{luck} luck)`$",
      ],
      tendedLead:
        '`$A widow watering a grave asks for your card. Her husband "isn\'t looking well." `5(a customer lead)`$',
      tendedAssociate:
        "`$Father Smyth sees you at work and mentions you in Sunday's sermon. `5(extra reputation)`$",
      robFound: [
        "`$You dig up a fresh one and relieve the deceased of `w${money}`$ in jewelry. He won't miss it. He won't miss anything.",
        "`$Gold fillings, a pocket watch and a ring add up to `w${money}`$. You fill the hole back in. Mostly.",
      ],
      robSilver:
        "`$You find a silver casket tag still wired to the handle. Nobody tags caskets this nice for nothing. `w+1 silver tag`$.",
      robCaught:
        "`4The groundskeeper catches you elbow-deep in Mr. Pruitt. His dog catches the rest of you. You pay a `w${fine}`4 fine and the whole town hears about it.`$",
      look: [
        "`$Two morticians argue over who gets the plot by the oak tree. The oak tree has seen this before.",
        "`$A fresh grave has been dug and filled three times today. Somebody can't make up their mind.",
        "`$A raven lands on a headstone, looks at you, and leaves without a word. Rude.",
      ],
      lookRows: "`$The biggest rows of headstones belong to: `w{list}`$.",
      duel: {
        prompt: "Who do you want to meet among the headstones?",
        youFirst:
          "`$You meet `w{name}`$ between the rows. You have more plots out here, so you know the ground. You strike first.",
        theyFirst:
          "`$You meet `w{name}`$ between the rows. They know this ground better than you do, and they swing before you've finished your speech.",
        youHit: "`$You whack `w{name}`$ with a headstone fragment for `4{damage}`$ damage.",
        youMiss: "`$You swing at `w{name}`$ and hit a marble cherub instead. It does not flinch.",
        theyHit: "`w{name}`$ cracks you with a shovel for `4{damage}`$ damage.",
        theyMiss: "`w{name}`$ swings and misses and kicks over a vase of lilies.",
        shoveIn:
          "`$You shove `w{name}`$ into an open grave! `4{damage}`$ damage, and you get a free swing while they climb out. They lose their next move.",
        shoveFail:
          "`$You lunge to shove `w{name}`$, miss, and fall on your face. They take advantage.",
        theyShove:
          "`w{name}`$ shoves you into an open grave! `4{damage}`$ damage, and they swing at you twice while you climb out.",
        theyShoveFail:
          "`w{name}`$ tries to shove you into a grave and trips over a footstone. Free swing for you.",
        shoveDetail: "{chance}% chance",
        won: "`$`w{name}`$ goes down among the dead and stays there a while. You win `5{bp} BP`$.",
        lost: "`4You wake up face down on somebody's grave. `w{name}`4 wins. You lose `5{bp} BP`4.`$",
        yielded:
          "`$You throw down your shovel. `w{name}`$ accepts your surrender with a smirk. You lose `5{bp} BP`$, but nothing is broken.",
        wonMail: "`w{name}`$ challenged you in the graveyard and lost. You win `5{bp} BP`$.",
        lostMail: "`w{name}`$ beat you senseless in the graveyard. You lose `5{bp} BP`$.",
        yieldMail:
          "`w{name}`$ challenged you in the graveyard, then lost their nerve and yielded. `5+{bp} BP`$.",
        crime:
          "`7GRAVEYARD BRAWL\n`^{winner} beat {loser} among the headstones last night. Several of the dead were disturbed.\n\n",
        selfPeaceful: "You took the Peace Pledge. No duels for you",
        targetPeaceful: "`${name} took the Peace Pledge. The graveyard keeper won't allow it.",
        chainMate: "`${name} is in your chain. Brawling with family is bad for business.",
        rivalTired: "`${name} has been beaten in the graveyard enough for one day.",
        sheltered:
          "`${name}'s chain has taken enough beatings today. Their friends are watching the gate.",
        self: "`$You can't duel yourself. You've tried.",
        nobody: "`$There's nobody here to fight but the dead, and they always win.",
      },
    },

    church: {
      title: "Church",
      note: "Father Smyth greets you warmly, a little too warmly. You wonder if he has anything on under that robe.",
      greeting: [
        '`wFather Smyth: `y"Why hello there, {player}. Isn\'t it a wonderfully fantastic day today? Praise the Lord."',
        '`wFather Smyth: `y"{player}! The Lord loves a cheerful giver, and so do I."',
        '`wFather Smyth: `y"Ah, {player}. You look like a person with something on their conscience. Or their shoe."',
      ],
      buttons: {
        bingo: "Bingo Night",
        confess: "Confession",
        holyWater: "Holy Water",
        service: "Lead the Service",
        tithe: "Tithe",
        leave: "Leave",
        back: "Back",
        buyOne: "Buy a Card",
        buyThree: "Buy 3 Cards",
      },
      bingoIntro:
        '`$"Ladies and gentlemen, buy your cards now," says Father Smyth.\n\n`$There are `w{cards}`$ cards tonight; `w{sold}`$ are sold. One card wins at midnight, and its owner takes the pot: `w{pot} wood tags`$ (`w{carry}`$ carried over from nights nobody held the winning card). The church keeps a small cut for the roof.\n\nEach card costs `w1 wood tag`$. Your cards: `w{mine}`$ (at most {max}). You have `w{wood}`$ wood tags.',
      bingoBought:
        '`$Father Smyth hands you {count} card(s): number `w{numbers}`$. "Good luck, my child. Luck is a sin, but good luck."',
      bingoFree: "Free tonight",
      bingoWinMail:
        "`$BINGO! Your card `w#{card}`$ won last night. Father Smyth grudgingly hands over `w{pot} wood tags`$.",
      bingoNews:
        "`7BINGO NIGHT\n`^{name} won {pot} wood tags at St. Mortimer's with card #{card}. The losers say it was rigged. It wasn't.\n\n",
      bingoCarryNews:
        "`7BINGO NIGHT\n`^Card #{card} won, but nobody had bought it. The pot of {pot} wood tags rolls over to tonight.\n\n",
      confessed: [
        '`$You confess. Father Smyth listens, winces, and accepts `w${price}`$ "for the candles." You feel cleaner. `5(+1 karma)`$',
        '`$Father Smyth hears you out, gasps twice, and takes `w${price}`$. "Say three Hail Marys and never tell me that again." `5(+1 karma)`$',
      ],
      confessCapped:
        "`$Father Smyth closes the little window. \"That's as clean as money gets you, my child. The rest you'll have to earn.\"",
      holyWaterBought:
        '`$Father Smyth fills a bottle from the font. "Bless a grieving family with it." You have `w{have}`$ bottle(s).',
      served:
        "`$You lead the Sunday service. Nobody falls asleep, which is a first. `5(+{bp} BP, +{reviews} reputation)`$",
      tithed: [
        "`$You drop `w${money}`$ in the plate. It makes a satisfying thud. The parish newsletter will mention you. `5(+{bp} BP)`$",
        "`$Father Smyth takes your `w${money}`$ and looks at you like a son. A son with money. `5(+{bp} BP)`$",
      ],
    },

    cityHall: {
      title: "City Hall",
      note: "City Hall smells of floor wax and broken promises. A clerk is asleep behind a sign that says ALL DEPARTMENTS.",
      greeting:
        '`w{mayor}: `y"{player}! Good to see a taxpayer. What can the town do for you, and what can you do for the town?"',
      buttons: {
        permits: "Permits",
        inspection: "Health Inspection",
        ordinance: "Ordinance Vote",
        election: "Mayoral Election",
        chains: "Parlor Chains",
        leave: "Leave",
        back: "Back",
        certify: "Request a Certificate",
        bribe: "Slip the Inspector an Envelope",
        lobby: "Lobby for It",
        file: "Run for Mayor",
        ads: "Buy Campaign Ads",
      },
      permitsIntro:
        "`$The clerk wakes up just long enough to slide a form across the desk. Some of the contractor's bigger jobs need a permit first.\n\n",
      permitLine: "`w{name}`$, `w${price}`$: {description}\n",
      permitBought: "`$The clerk stamps your `w{name}`$ eleven times and goes back to sleep.",
      inspectionIntro:
        "`$Inspector Pratt calls on one parlor in town each night, and he finds something every time unless your rating and your karma are good, or he's been looked after. A failed inspection costs a fine and your reputation.",
      certifiedUntil:
        "`$You're certified clean through day `w{until}`$. The inspector will wave at your door.",
      certified:
        "`$Inspector Pratt walks through your parlor in four minutes and signs. Clean for `w{days}`$ days, and a nice write-up in the paper.",
      bribed:
        '`$Inspector Pratt counts the envelope without looking at it. "I\'m sure everything is up to code." `5(-2 karma)`$',
      inspectPassMail:
        "`$The health inspector came by last night and found nothing he could put in writing.",
      inspectFailMail:
        "`4The health inspector came by last night. He found a finger in the coffee maker. You were fined `w${fine}`4.`$",
      inspectFailNews:
        "`7HEALTH CODE VIOLATION\n`^Inspectors found unspeakable things at {parlor}. {name} says the finger was there when they bought the place.\n\n",
      ordinanceIntro:
        "{current}\n`$This week's ballot closes at the end of day `w{closes}`$. One vote each; the Mayor's counts double; lobbying buys more.",
      noOrdinance: "`$No ordinance is in force. The town runs on habit and spite.",
      currentOrdinance: "`$In force through day `w{until}`$: `w{title}`$ ({effect}).",
      noBallot: "`$There's no ballot open right now. Come back on the first day of next week.",
      voted:
        "`$You vote for `w{title}`$. The clerk puts your ballot in a box marked BALLOTS AND LUNCH.",
      lobbied: "`$You take a councilman to lunch on behalf of `w{title}`$. He orders the lobster.",
      ordinanceNews:
        "`7NEW ORDINANCE: {title}\n`^{text} Passed with {votes} votes. In force all week: {effect}.\n\n",
      noVotesNews:
        "`7COUNCIL DEADLOCKED\n`^Nobody voted on this week's ordinances. The council took the week off to recover.\n\n",
      electionFiling:
        "`$The season's mayoral election is open for candidates until the end of day `w{until}`$. Filing costs `w${fee}`$. The Mayor gets `w+{rating}`$ parlor rating from all the ribbon cuttings and a double vote on ordinances.\n\nCandidates so far: `w{candidates}`$.",
      electionVoting:
        "`$Voting is open until the end of day `w{until}`$. One vote each; candidates can buy ads.\n\nCandidates: `w{candidates}`$.",
      electionDone: "`$The town's mayor this season is `w{name}`$.",
      noCandidates: "nobody yet",
      filed: "`$You're on the ballot. A photographer takes your picture. You blink.",
      electionVoted: "`$You vote for `w{name}`$. Democracy happens.",
      adsBought: "`$Your face appears on every bus bench in town. Several pigeons are offended.",
      electedNews:
        "`7NEW MAYOR ELECTED\n`^{name} wins the mayor's race with {votes} votes and promises to keep the town's dead in an orderly fashion.\n\n",
      electedMail:
        "`$You won the election! The ribbon cuttings start tomorrow, and your vote on ordinances counts double.",
      noElectionNews:
        "`7ELECTION CANCELLED\n`^Nobody ran for mayor. The old Mayor stays on, and frankly she's relieved.\n\n",
      mayorMorning: "\n`$Your mayoral chauffeur saves you time all over town. `w+{turns}`$ turn.",
      votesDetail: "{votes} votes",
      votesDetailOne: "{votes} vote",
    },

    chains: {
      title: "Parlor Chains",
      intro:
        "`$A chain is up to `w{max}`$ parlors sharing a season score board. Founding one costs `w${fee}`$, joining one `w${join}`$, and every member pays `w${dues}`$ a day in dues. Members get a better rating, cheaper caskets, and families that walk out are sent to a chain-mate. Chain-mates can never fight, rob, burn or put a hit on each other.\n\n",
      line: "`w{name}`$: {members}. Season score `5{score}`$\n",
      none: "`$No chains are registered yet.",
      yours: "`$You belong to `w{name}`$.\n",
      buttons: {
        found: "Found a Chain",
        invite: "Invite a Parlor",
        join: "Join {name}",
        leave: "Leave the Chain",
        back: "Back",
      },
      namePrompt: "What will your chain be called?",
      invitePrompt: "Which parlor do you want to invite?",
      founded: "`$The clerk registers `w{name}`$ and charges you for the ink.",
      invited: "`$An invitation goes out to `w{name}`$.",
      inviteMail:
        "`w{name}`$ invites you to join the parlor chain `w{chain}`$. Visit City Hall to accept.",
      joined: "`$You're now part of `w{name}`$. Somebody gives you a lapel pin.",
      joinedMail: "`w{name}`$ joined your chain.",
      left: "`$You hand back the lapel pin.",
      full: "That chain is full",
      cooldown: "You left a chain recently ({days} more days)",
      badName: "`$The clerk won't register that name. Try another.",
      duesUnpaid: "`4You couldn't pay the ${dues} chain dues, so the chain dropped you.`$",
      noFriendlyFire: "`${name} is in your chain. You can't do that to family.",
      removedName: "Parlor Chain No. {n}",
    },

    hospital: {
      title: "Hospital",
      note: "The hospital smells of bleach and boiled carrots. The nurse looks up from a crossword.",
      greeting: '`w{nurse}: `y"Back again, {player}? What did you break this time?"',
      injuryLine: "`$`w{name}`$: heals in `w{days}`$ day(s), or `w${price}`$ to fix today.",
      noInjuries: "`$You're in one piece, more or less. Injuries from fights would show up here.",
      buttons: { treat: "Fix {name}", lead: "Bribe the Nurse", leave: "Leave" },
      treated: "`$The doctor fixes your `w{name}`$ and charges you for the tongue depressor.",
      leadIntro:
        "`${nurse} knows who's in intensive care and who won't be leaving. For `w${price}`$ she'll put your card in the right hand. `5({karma} karma, a sure and richer customer)`$",
      leadBought: [
        '`$The nurse tucks the money in her shoe. "Room 212. Ask for the daughter."',
        '`$"Bed six. Pancreas. Give it till Thursday." She winks. You wish she hadn\'t.',
      ],
      leadMax: "You already have plenty of leads",
      stillHurt: "\n`4Still hurting: {list}.`$",
      hurtTurns: "\n`4Your injuries slow you down: `w-{turns}`4 turn.`$",
      newInjury: "`4Injury: {name}.`$",
      armorSaved: "`$Your vest takes the worst of it. The vest is ruined, but you're not.",
      leadArrives: "`$The family your lead promised walks in, wallet first.",
    },

    club: {
      title: "The Reaper Club",
      note: "You shiver as you approach the Reaper, a rave club frequented by the underbelly of society (mostly funeral directors).",
      door: '`$The bouncer, a man with a neck like a tree stump, holds out a hand. "Cover\'s `w{cover} wooden tags`$." Behind him {owner} waves from the VIP booth.',
      necroFree:
        "`$The bouncer sees the grave dirt under your nails and waves you straight through.",
      inside: [
        "`$You can barely hear yourself think. Somebody is dancing with a skeleton, and the skeleton is leading.",
        "`$The DJ is playing organ music with a dance beat. Three morticians are doing the conga around a casket.",
        "`$The bartender pours you something green. It's either absinthe or embalming fluid. Here, there's no difference.",
      ],
      buttons: {
        pay: "Pay the Cover",
        games: "The Back Tables",
        market: "Black Market",
        hit: "Hire a Hit Man",
        bodyguard: "Hire a Bodyguard",
        seance: "Seance in the Back Room",
        draw: "Draw",
        slots: "Slots",
        shots: "Shots",
        leave: "Leave",
        back: "Back",
      },
      gamesIntro:
        "`$The house games, honest as anything in this town. You've staked `w${staked}`$ tonight; the house stops you at `w${max}`$.\n`wDead Man's Draw`$: you and the Reaper each draw a card; high card wins even money, a tie and the Reaper keeps half.\n`wThe One-Armed Undertaker`$: three skulls pay 500 to one, three coffins 100, three bones 30, three roses 12, three worms 4; a skull on the first reel gets your stake back.",
      stakeLabel: "${stake}",
      drawWin: "`$You draw the `w{you}`$, the Reaper draws the `w{dealer}`$. You win `w${won}`$!",
      drawLose:
        "`$You draw the `w{you}`$, the Reaper draws the `w{dealer}`$. The Reaper rakes in your `w${won}`$.",
      drawTie: "`$You both draw the `w{you}`$. The Reaper keeps `w${won}`$ for his trouble.",
      cards: [
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Jack",
        "Queen",
        "King",
        "Ace",
      ],
      slotsSpin: "`$The One-Armed Undertaker clanks: `w{reels}`$. ",
      slotsWin: "`$It spits out `w${won}`$!",
      slotsLose: "`$Nothing. The machine burps.",
      symbols: { skull: "SKULL", coffin: "COFFIN", bone: "BONE", rose: "ROSE", worm: "WORM" },
      shotsIntro:
        "`wFormaldehyde Roulette`$: six shot glasses, one of them isn't vodka. Drink one and live, and the house pays a little under a fifth of your stake. Pick wrong and you lose it, and your liver files a complaint.",
      shotsWin: "`$You slam it back. Vodka! The crowd cheers and the house pays `w${won}`$.",
      shotsLose: "`4That was not vodka. You lose your stake and a good deal of your dignity.`$",
      marketIntro:
        '`$A man in a trench coat opens it. The inside is lined with merchandise. "Today\'s specials. Cash only, no receipts, no faces."\n\n',
      marketLine: "`w{name}`$, `w${price}`$: {text}\n",
      marketBought: "`$You buy `w{name}`$. The man in the trench coat is already gone.",
      hitPrompt:
        "Whose knees do you want explained to them? (from ${price}, more for bigger parlors)",
      hitBooked:
        "`$Lucius Vane takes the envelope. \"Tonight. {name} won't know what hit them. Well, they'll know it was a tire iron.\" `5(-5 karma)`$",
      hitSelf: '`$Vane looks at you for a long time. "Get help, pal."',
      hitPeaceful: "`${name} took the Peace Pledge. Even Vane has rules.",
      hitTaken: "`$Somebody already paid for {name} tonight. Vane doesn't double-book.",
      hitChain: "`${name} is in your chain. Vane doesn't do family.",
      hitNews:
        "`7MORTICIAN ROUGHED UP\n`^{name} was found in a dumpster last night, alive, with a very clear memory of a tire iron.\n\n",
      hitMail:
        "`4Two men visited you last night and discussed your kneecaps with a tire iron. You lose `5{bp} BP`4.`$",
      hitFoiledMail:
        "`$Two men with a tire iron came to your parlor last night, took one look and left.",
      hitFoiledHirer: "`$Vane sends word: the job on `w{name}`$ didn't come off. No refunds.",
      hitSnitchMail:
        "`$The thug who came for you last night got picked up and talked. `w{name}`$ paid him.",
      hitSnitchNews:
        "`7HIT MAN SINGS\n`^A hired thug arrested outside {target}'s parlor told police {name} paid for the job. {name} has been fined.\n\n",
      hitRumour:
        "`$Word at the Reaper Club is that somebody paid for your knees tonight. You might want a bodyguard, or a vest.",
      bodyguardBought:
        "`$A man the size of a hearse will sleep on your porch tonight. He brought his own blanket.",
      seanceWin:
        "`$The candles gutter. The dead whisper two names, and two addresses, and that both will be needing you soon. `5(+2 customer leads)`$",
      seanceFail:
        "`4The dead have nothing to say to you, and one of them is rude about it. `5(-3 luck)`4`$",
    },

    bank: {
      buttons: {
        savings: "Savings",
        deposit: "Deposit",
        withdraw: "Withdraw",
        loan: "Loans",
        borrow: "Borrow",
        repay: "Repay",
        transfer: "Send Tags",
        back: "Back",
        wood: "Wood",
        silver: "Silver",
        gold: "Gold",
      },
      savingsIntro:
        "`$You have `w${savings}`$ in savings, earning `w{rate}%`$ a day (on up to `w${cap}`$). Cash on hand: `w${cash}`$. Money in the bank can't be stolen from your till.",
      depositPrompt: "How much do you want to deposit?",
      withdrawPrompt: "How much do you want to withdraw?",
      deposited: "`$The teller counts your `w${money}`$ twice and stamps the book.",
      withdrew: "`$The teller hands over `w${money}`$ like it was his own.",
      badAmount:
        "`$The teller stares at you over his glasses until you go away and come back with a real number.",
      noDepositWithLoan: "Pay off your loan first",
      loanIntro:
        "`$The bank will lend against your plots: up to `w${limit}`$ today, at `w{rate}%`$ interest a day (the first day's `w{fee}%`$ is added when you sign), due in `w{days}`$ days. If you don't pay, they take your cash, your savings and your caskets, and the town finds out.",
      loanOwed: "`$You owe the bank `w${owed}`$, due at the end of day `w{due}`$.",
      borrowPrompt: "How much do you want to borrow?",
      borrowed:
        '`$The loan officer counts out `w${money}`$. "Due day {due}. We know where you bury people."',
      repaid: "`$You pay the bank `w${money}`$.",
      loanClosed: "The bank stops lending this close to the end of the season",
      deadbeat: "The bank doesn't lend to deadbeats",
      loanCollected: "`$Your loan came due. The bank collected `w${money}`$ from your accounts.",
      loanDefault:
        "`4Your loan came due and you couldn't cover it. The bank took everything it could and wrote off `w${left}`4. Your name is in the window. `5(-{bp} BP)`4`$",
      transferIntro:
        "`$You can send casket tags to another parlor. The teller keeps `w{fee}%`$ (rounded up) of each transfer. You've sent `w{sent}`$ of `w{max}`$ wood-tag equivalents today; nobody can receive more than that a day either.",
      transferPick: "Who do you want to send tags to?",
      transferTier: "`$Which tags do you want to send to `w{name}`$?",
      transferCount: "How many tags?",
      transferred:
        "`$`w{count}`$ {tier} tag(s) are on their way to `w{name}`$. The teller keeps `w{fee}`$.",
      transferMail: "`w{name}`$ sent you `w{count}`$ {tier} tag(s) through the bank.",
      transferTooNew: "New parlors can't send tags for a few days",
      transferLimit: "That's over the daily limit ({left} more)",
      transferTheirLimit: "They can't receive any more today",
      transferSelf: "You can't send tags to yourself",
      transferNotEnough: "Not enough tags for that (and the fee)",
    },

    world: {
      morningWeather: "\n`$Weather: `w{label}`$. {line} `5({effect})`$",
      morningNews: "\n`$In the paper: `w{title}`$ `5({effect})`$",
      deskStatus: "{weather} {news}",
      quietNews: "",
      morningArc: "\n`$The town is talking about: `w{title}`$",
    },

    challenge: {
      title: "Daily Challenge",
      intro:
        "`$Daily Challenge `w{id}`$. Every parlor in the world gets this same day: the same families, in the same order. You have `w{turns}`$ turns. Make them count.",
      finished:
        "`$The day is done. You earned `5{score} BP`$ from `w{sales}`$ sales and finished `w${money}`$ up. Your score is on the board.",
      leave: "Finish",
    },
  },
};
