// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" here is a dollar sign before a {price} placeholder, not a template.
/**
 * ============================================================================
 *  EXPANDED STARTER CONTENT
 * ============================================================================
 * A small but complete content set for the Expanded ruleset, written for the
 * engine's tests and so a town is playable before the content writers arrive.
 * Writers: replace and multiply everything here; the shapes are in
 * `./types.ts` and docs/expanded-rules.md section 13 says what each table
 * does. Nothing in the engine depends on the number of entries, only on the
 * ids that rules refer to (upgrade ids, package category ids "plot",
 * "headstone", "embalming", trait ids used by specials).
 *
 * Voice: the original's. Deadpan, crude, the funeral director is a crook and
 * the customers are no better. No slurs, nothing about minors, no real brands
 * or people (docs/REMASTER_PLAN.md section 3.2).
 * ============================================================================
 */
import { TOWN_STARTER } from "./townStarter.js";
import type { ExpandedContent } from "./types.js";

export const EXPANDED_STARTER: ExpandedContent = {
  names: {
    male: [
      "Earl",
      "Vernon",
      "Clyde",
      "Mort",
      "Dale",
      "Lyle",
      "Gus",
      "Herb",
      "Wendell",
      "Rusty",
      "Otis",
      "Floyd",
      "Barry",
      "Duane",
      "Chester",
    ],
    female: [
      "Doris",
      "Mildred",
      "Bev",
      "Darlene",
      "Agnes",
      "Rhonda",
      "Lorraine",
      "Gladys",
      "Tammy",
      "Myrtle",
      "Edna",
      "Pam",
      "Velma",
      "Shirley",
      "Opal",
    ],
    surnames: [
      "Pickett",
      "Stubbs",
      "Gruber",
      "Plunkett",
      "Moody",
      "Haskins",
      "Wormley",
      "Crump",
      "Dunlop",
      "Fennimore",
      "Gristle",
      "Hogarth",
      "Kettleworth",
      "Lumley",
      "Mudge",
      "Nutley",
      "Oakes",
      "Puckett",
      "Quigley",
      "Rumbold",
      "Sludge",
      "Tumbly",
      "Underhill",
      "Varney",
      "Whipple",
      "Yokum",
      "Bramble",
      "Coffey",
      "Digby",
      "Graves",
    ],
    pets: [
      "Mr. Whiskers",
      "Biscuit",
      "Sir Barks-a-Lot",
      "Gravy",
      "Princess",
      "Tater",
      "Lord Fluffington",
      "Meatball",
    ],
  },

  traits: [
    {
      id: "haggler",
      label: "Haggler",
      hint: "Wants a deal. Discounts calm them twice as much; a Hard Sell goes down badly.",
      lines: [
        '{customer}"Before we start, I never pay sticker price. Not for tires, not for {dHim}."',
        '{customer}"What kind of discount do you do for cash? Or for no receipt?"',
      ],
      effects: { discount: 2, hardSell: 1, cheapness: 0.5 },
    },
    {
      id: "heir",
      label: "Guilt-Ridden Heir",
      hint: "Inherited everything and feels awful about it. Guilt works extra well.",
      excludes: ["heartbroken"],
      lines: [
        '{customer}"{dHeCap} left me the house, the boat and the timeshare. I didn\'t even visit at Christmas."',
        '{customer}"The will reading is Tuesday. I should feel sadder than I do."',
      ],
      effects: { loved: false, guilt: 1.6 },
    },
    {
      id: "hurry",
      label: "In a Hurry",
      hint: "Has somewhere to be: little patience and no time for coffee.",
      lines: [
        "{customer}\"I'm double parked, so whatever you're going to do, do it fast.\"",
        '{customer}"My bowling league starts in twenty minutes. Let\'s move this along."',
      ],
      effects: { patience: -4, coffee: 0 },
    },
    {
      id: "pincher",
      label: "Penny-Pincher",
      hint: "Hates spending money. Harder to sell, harder to read.",
      lines: [
        '{customer}"I brought my own coupons. They\'re for a pizza place but I think they should count."',
        "{customer}\"Do you charge for the chair I'm sitting in? Because I'll stand.\"",
      ],
      effects: { cheapness: 2, estimate: 1.3, affinity: { prestige: 1.5 } },
    },
    {
      id: "showoff",
      label: "Show-Off",
      hint: "Wants the neighbours talking. Anything flashy sells itself.",
      lines: [
        '{customer}"The Hendersons had a horse-drawn carriage. I want two horses. Bigger horses."',
        '{customer}"Money is no object. Well, it\'s an object. A shiny one I like to wave around."',
      ],
      effects: { cheapness: -0.5, limitMult: 1.1, affinity: { prestige: -3, vanity: -3 } },
    },
    {
      id: "heartbroken",
      label: "Heartbroken",
      hint: "Truly grieving. Sympathy works wonders.",
      excludes: ["heir", "estranged"],
      lines: [
        "{customerName} can barely get the words out between sobs.",
        '{customer}"We were going to retire to Florida. Now it\'s just me and the parakeet."',
      ],
      effects: { loved: true, sympathy: 1.5, moodMult: 0.8 },
    },
    {
      id: "estranged",
      label: "Estranged",
      hint: "Hadn't spoken in years. Sentimental extras fall flat.",
      excludes: ["heartbroken"],
      lines: [
        '{customer}"Last time I saw {dHim} was 1987. {dHeCap} owed me twenty bucks."',
        "{customer}\"The hospital found my number in {dHis} phone under 'Do Not Answer'.\"",
      ],
      effects: { loved: false, guilt: 1.3, affinity: { sentimental: 2 } },
    },
    {
      id: "skeptic",
      label: "Skeptic",
      hint: "Thinks you are a crook. A Hard Sell bounces off, but they open up when you Listen.",
      lines: [
        "{customerName} reads every word of the price list, then reads it again upside down.",
        '{customer}"I watched a documentary about you people."',
      ],
      effects: { hardSell: 1.5, listen: 2 },
    },
    {
      id: "devout",
      label: "Devout",
      hint: "Church every Sunday. Loves religious touches; cremation is out of the question.",
      excludes: ["green"],
      lines: [
        '{customer}"Father Smyth said you were... adequate."',
        "{customerName} makes the sign of the cross every time you mention a price.",
      ],
      effects: { affinity: { religious: -3, cremation: 4 } },
    },
    {
      id: "hothead",
      label: "Hot-Headed",
      hint: "Short fuse: everything annoys them more, and coffee helps more.",
      lines: [
        '{customer}"The guy at the hospital looked at me funny. Don\'t look at me funny."',
        "{customerName} has already kicked your umbrella stand.",
      ],
      effects: { moodMult: 1.4, coffee: 1.5 },
    },
    {
      id: "sentimental",
      label: "Sentimental",
      hint: "Keeps everything. Keepsakes and flowers practically sell themselves.",
      lines: [
        '{customer}"I still have {dHis} baby teeth in a jar. Is that weird? Don\'t answer that."',
        "{customerName} is clutching a shoebox of old photos and one sock.",
      ],
      effects: { sympathy: 1.2, affinity: { sentimental: -3, flowers: -2 } },
    },
    {
      id: "green",
      label: "Eco-Minded",
      hint: "Wants it natural. Open to cremation, appalled by embalming.",
      excludes: ["devout"],
      lines: [
        '{customer}"Is the casket compostable? {dHeCap} would want to be a tree. A small tree. A shrub."',
        "{customerName} arrived on a bicycle with a trailer, looking for a place to plug it in.",
      ],
      effects: { affinity: { cremation: -4, embalming: 3, vanity: 1 } },
    },
  ],

  backstories: [
    "{dFirst} {surname} was a {job} for {years} years and spent every weekend {hobby}. {dHeCap} was last seen near {place}.",
    "{cFirst} found {dFirst} {dSmashed} {aFridge} out behind {place}. {dHeCap} had just retired as a {job}.",
    "The {surname} family has lived in Deathville for four generations, and {dFirst} was the first one to die sober.",
    "{dFirst} spent {years} years as a {job} and the rest of the time {hobby}. Nobody is sure which one killed {dHim}.",
    '{cFirst} drove in from out of town. {dFirst} left a note that just said "{place}, you know why."',
    "{dFirst} {surname}: {job}, local legend at {place}, and three-time runner-up at the county fair for {hobby}.",
    "According to {cFirst}, {dFirst} was {dSmashed} {aFridge} while {hobby}, which everyone had warned {dHim} about.",
    "{dFirst} was banned from {place} for {years} years. The ban would have been lifted next week.",
    "{cFirst} and {dFirst} ran a {job} business together until the incident with the {dFridge}.",
    "{dFirst} was known all over town for {hobby}. The church choir is already arguing about who gets {dHis} robe.",
  ],
  backstoryBits: {
    jobs: [
      "crossing guard",
      "taxidermist",
      "used car salesman",
      "lunch lady",
      "night watchman",
      "mall Santa",
      "pest exterminator",
      "dental hygienist",
      "bowling alley mechanic",
      "tax preparer",
    ],
    hobbies: [
      "collecting ceramic frogs",
      "competitive pie eating",
      "yelling at the TV",
      "metal detecting",
      "writing angry letters to the paper",
      "polka dancing",
      "feeding the ducks bread they shouldn't eat",
      "building ships in bottles",
    ],
    places: [
      "the Pale Horse Cafe",
      "Bill's Big Burger",
      "the Deathville Zoo",
      "the bingo hall",
      "the quarry",
      "the Di-Mart parking lot",
      "the retirement home",
      "Lake Bleak",
    ],
  },

  tells: {
    loved: [
      "{customerName} keeps touching a photo of {dFirst} like it might still be warm.",
      '{customer}"{dHeCap} made the worst coffee in the world. I\'d give anything for one more cup."',
      "{customerName}'s mascara has given up entirely.",
      '{customer}"I keep setting two plates at dinner."',
      "{customerName} is wearing {dFirst}'s old cardigan. It's three sizes too big.",
    ],
    notLoved: [
      "{customerName} checks {cHis} phone. Twice. While you're talking.",
      '{customer}"How long does this usually take? The will is being read at four."',
      "{customerName} hasn't once said {dFirst}'s name.",
      '{customer}"Can we skip the part where I pretend to be sad?"',
      "{customerName} asks if you validate parking before asking anything about the funeral.",
    ],
    cheapLow: [
      "{customerName} tips the umbrella stand a dollar.",
      '{customer}"I don\'t care what it costs. Well. I care a little."',
      "{customerName} is wearing a watch that costs more than your hearse.",
    ],
    cheapMid: [
      "{customerName} squints at the price list but doesn't flinch.",
      '{customer}"I want it done right. Within reason. Whatever reason is."',
      "{customerName} asks if the coffee is free, then drinks it either way.",
    ],
    cheapHigh: [
      "{customerName} asks if you take expired coupons.",
      '{customer}"My cousin says I could just use a refrigerator box."',
      "{customerName} has brought {cHis} own folding chair so you can't charge for seating.",
    ],
    limitHigh: [
      "{customer}\"Good news is there was a life insurance policy. Bad news is the ferret was the beneficiary. I'm the ferret's guardian.\"",
      "{customerName} mentions, three times, the boat {cHe} just bought.",
      '{customer}"The settlement from the {dFridge} company came through, if that matters."',
    ],
    limitLow: [
      "{customer}\"Money's tight. The {dFridge} wasn't insured.\"",
      "{customerName} pays for the parking meter in nickels.",
      '{customer}"I had to sell {dHis} bowling ball to get here."',
    ],
  },

  specials: [
    {
      id: "mob-boss",
      label: "Mob Boss",
      weight: 1,
      minDay: 3,
      person: { first: "Vincent", surname: "Morticelli", male: true },
      portrait: "people/m_old_4",
      intro:
        '`$Two large men in sunglasses check your closets before an old man in a camel coat sits down.\n\n{customer}"My associate {dFirst} had an accident. With {aFridge}. Several times. I want a funeral people will remember, and a casket that does not open from the inside."',
      incomeAtLeast: 3,
      effects: { limitMult: 1.5, guilt: 0, cheapness: -1 },
      noWalkout: true,
      onHappy: { gold: 2, karma: -2, protection: true },
      onDone: { karma: -1 },
      onWalkout: { bp: -25, karma: -1 },
      lines: {
        happy: '{customer}"You did right by {dFirst}. Nobody will bother you tonight. Nobody."',
        threat:
          '{customer}"You disappoint me." The large men walk you out to the alley and explain your disappointment to your ribs.',
      },
    },
    {
      id: "celebrity",
      label: "Celebrity",
      weight: 1,
      person: { first: "Crystal", surname: "Vance", male: false },
      portrait: "people/f_sexy",
      intro:
        '`$Flashbulbs go off outside your window. Crystal Vance, star of the reality show "Tanning Moms", sweeps in behind giant sunglasses.\n\n{customer}"My {dRelation} {dFirst} is dead and the cameras are rolling. Make it TRAGIC. Make it TRENDING."',
      incomeAtLeast: 2,
      traits: ["showoff"],
      tvAlways: true,
      onHappy: { rating: 3, reviews: 3 },
      onWalkout: { rating: -3, reviews: -5 },
      lines: {
        happy: '{customer}"Oh my god, the crying shots are going to be AMAZING."',
        walkout:
          '`$Crystal storms out to her limo. By dinner the whole town has seen the clip of her calling your parlor "a Di-Mart for corpses".',
      },
    },
    {
      id: "pet",
      label: "Pet Funeral",
      weight: 2,
      pet: ["cat", "dog", "hamster", "iguana", "parakeet", "goldfish", "ferret", "pot-bellied pig"],
      intro:
        '`${customerName} sets a shoebox on your desk. Something inside it is not moving.\n\n{customer}"This is {dFirst}. {dFirst} was a good {pet}. The best {pet}. The vet said you do pets?"',
      casketPriceMult: 0.25,
      effects: { loved: true, sympathy: 1.5, guilt: 2, cheapness: -1 },
      onHappy: { karma: 1, reviews: 1 },
      lines: {
        happy:
          '{customer}"{dFirst} would have loved this. {dFirst} loved everything. Except the mailman."',
      },
    },
    {
      id: "pre-need",
      label: "Pre-Need Planner",
      weight: 2,
      selfFuneral: true,
      intro:
        '`${customerName} sits down with a clipboard and a highlighter.\n\n{customer}"Nobody\'s dead yet. Me, eventually. I want to pick out my own {casket} casket now, before my kids pick something tacky."',
      effects: { cheapness: 1, patience: 3, sympathy: 0.5, guilt: 0.5 },
      future: {
        minDays: 2,
        maxDays: 6,
        bpShare: 0.5,
        text: "`${name} finally used the funeral {he} planned with you. The family pays the balance.",
      },
    },
    {
      id: "black-widow",
      label: "The Widow Black",
      weight: 1,
      minDay: 2,
      person: { first: "Vivian", surname: "Black", male: false },
      portrait: "people/f_sexy2",
      intro:
        '`$Vivian Black glides in, all in black, as usual.\n\n{customer}"Husband number five, darling. Same as last time, but bigger. You know I like things bigger."',
      incomeAtLeast: 3,
      effects: { loved: false, guilt: 0, limitMult: 1.3, patience: 2 },
      onHappy: { reviews: 2 },
      lines: {
        happy: '{customer}"Lovely. Keep my file handy, darling. Number six has a weak heart."',
      },
    },
    {
      id: "county-contract",
      label: "County Contract",
      weight: 1,
      intro:
        '`$A clerk from the county drops off a toe-tagged John Doe and a form in triplicate.\n\n`wClerk: `$"Unclaimed, no family. County pays the flat rate: a pine box and a hole. Take it or leave it, I\'ve got six more in the van."',
      offer: {
        accept: {
          label: "Take the Body",
          text: '`$You bury John Doe with as much dignity as the county rate allows, which is not much. Father Smyth says a few words. Some of them are "who?"',
          effects: { bp: 8, money: 300, karma: 2 },
        },
        decline: {
          label: "Turn It Down",
          text: '`$The clerk shrugs and wheels John Doe across the street to a rival. You hear the word "cheapskate" through the window.',
          effects: { karma: -1 },
        },
      },
    },
    {
      id: "cousin-sal",
      label: "Cousin Sal",
      weight: 1,
      minDay: 2,
      person: { first: "Cousin", surname: "Sal", male: true },
      portrait: "people/m_doctor",
      intro:
        '`$Cousin Sal, M.D. (University of P.O. Box 411), backs a station wagon up to your door.\n\n`wCousin Sal: `$"Got a body for you. Paperwork\'s, uh, still being printed. Cash only, no questions, no autopsy, especially no autopsy."',
      offer: {
        accept: {
          label: "Take the Cash",
          text: "`$You bury the mystery guest under a fake name. Sal pays in damp twenties. You sleep fine. Mostly.",
          effects: { money: 2500, bp: 5, karma: -4 },
        },
        decline: {
          label: "Call the Police",
          text: "`$Sal is gone before the squad car arrives. The officer thanks you and tells the whole precinct you're one of the good ones.",
          effects: { karma: 3, reviews: 2 },
        },
      },
    },
    {
      id: "old-man-withers",
      label: "Old Man Withers",
      weight: 1,
      person: { first: "Old Man", surname: "Withers", male: true },
      portrait: "people/m_old_3",
      selfFuneral: true,
      intro:
        '`$Old Man Withers, who has been "about to die any day now" since 1974, shuffles in to price-check his funeral again.\n\n{customer}"Just looking. Show me your cheapest {casket}. I\'ll know if you\'re lying, I invented lying."',
      effects: { cheapness: 3, patience: 6, limitMult: 0.6 },
      onHappy: { reviews: 4, rating: 1 },
      lines: {
        happy:
          "{customer}\"Not bad, sonny. I'll tell everyone at bingo. Don't get excited, I'm not dying this week.\"",
      },
    },
  ],

  softSell: [
    { article: "a", name: "Memorial Plaque", price: 100, tags: ["sentimental"] },
    { article: "some", name: "Grief Therapy", price: 300, tags: ["sentimental"] },
    { article: "some", name: "Live Piano Music", price: 450, tags: ["music", "prestige"] },
    { article: "some", name: "Burial Footwear", price: 150, tags: ["vanity"] },
    { article: "a few", name: "Paid Mourners", price: 350, tags: ["prestige", "vanity"] },
    { article: "some", name: "Relaxing Mourning Music", price: 50, tags: ["music"] },
    { article: "some", name: "Punch and Cookies", price: 150, tags: ["food"] },
    { article: "a", name: "DuraRest (tm) Neck Brace", price: 150, tags: ["vanity"] },
    { article: "some", name: "Casket Scrollwork", price: 450, tags: ["prestige"], track: "burial" },
    { article: "a", name: "Fine Burial Suit", price: 250, tags: ["vanity"] },
    { article: "some", name: "Burial Makeup", price: 100, tags: ["vanity"] },
    { article: "a", name: "Post-Mortem Baptism", price: 300, tags: ["religious"] },
    { article: "some", name: "Burial Jewelry", price: 400, tags: ["prestige", "vanity"] },
    { article: "a", name: "Professional Orator", price: 550, tags: ["prestige"] },
    { article: "a", name: "Burial Body Shave", price: 200, tags: ["vanity"] },
    { article: "some", name: "Burial Hairstyling", price: 250, tags: ["vanity"] },
    { article: "a", name: "Memorial Slideshow", price: 200, tags: ["sentimental"] },
    { article: "a", name: "Guest Book (Leather-ish)", price: 50, tags: ["sentimental"] },
    { article: "a", name: "Bagpiper", price: 600, tags: ["music", "prestige"] },
    { article: "a", name: "Buffet Lunch", price: 500, tags: ["food"] },
    { article: "an", name: "Open Bar", price: 800, tags: ["food", "prestige"] },
    { article: "a", name: "Dove Release", price: 350, tags: ["sentimental", "prestige"] },
    { article: "a", name: "Candlelight Vigil", price: 150, tags: ["religious", "sentimental"] },
    { article: "a", name: "Rosary Placed in the Hands", price: 100, tags: ["religious"] },
    {
      article: "a",
      name: "Hymn Sung Off-Key by Father Smyth",
      price: 200,
      tags: ["religious", "music"],
    },
    { article: "a", name: "Lock of Hair in a Locket", price: 250, tags: ["sentimental"] },
    { article: "a", name: "Fingerprint Keepsake Charm", price: 300, tags: ["sentimental"] },
    {
      article: "a",
      name: "Personalized Casket Pillow",
      price: 200,
      tags: ["sentimental"],
      track: "burial",
    },
    { article: "a", name: "Motorcycle Escort", price: 700, tags: ["prestige", "vanity"] },
    {
      article: "a",
      name: "Ice Sculpture of the Deceased",
      price: 900,
      tags: ["vanity", "prestige"],
    },
    { article: "a", name: "Cardboard Cutout of the Deceased", price: 150, tags: ["vanity"] },
    {
      article: "a",
      name: "Video Tribute Set to Soft Rock",
      price: 350,
      tags: ["music", "sentimental"],
    },
    { article: "a", name: "Mariachi Band", price: 750, tags: ["music"] },
    { article: "some", name: "Commemorative Coffee Mugs", price: 100, tags: ["vanity"] },
    { article: "a", name: "Balloon Arch (Black)", price: 250, tags: ["vanity"] },
    { article: "an", name: "Organic Burial Shroud", price: 300, tags: ["green"] },
    {
      article: "a",
      name: "Tree Planted in the Name of the Deceased",
      price: 200,
      tags: ["green", "sentimental"],
    },
    {
      article: "a",
      name: "Keepsake Mini-Urn",
      price: 250,
      tags: ["sentimental"],
      track: "cremation",
    },
    {
      article: "some",
      name: "Ashes Pressed Into a Vinyl Record",
      price: 650,
      tags: ["music", "vanity"],
      track: "cremation",
    },
    { article: "a", name: "Fireworks Send-Off", price: 1000, tags: ["vanity", "prestige"] },
  ],

  packages: [
    {
      id: "embalming",
      label: "Embalming",
      track: "any",
      tiers: [
        { article: "", name: "No Embalming", price: 0, tags: [] },
        { article: "a", name: "Basic Embalming", price: 400, tags: ["embalming"] },
        { article: "a", name: "Full Reconstruction", price: 900, tags: ["embalming", "vanity"] },
        {
          article: "an",
          name: "Air-Brushed Embalming",
          price: 1500,
          tags: ["embalming", "vanity", "prestige"],
          requires: "embalming-lab",
        },
      ],
      pitch: [
        '`w{player}: `$"Embalming is, uh, required by the state for, uh, disease reasons. Yeah. Required. {upgrade} is only ${price}."\n\n',
        '`w{player}: `$"You want people to remember {dHim} looking peaceful, not looking like {aFridge} fell on {dHim}. {upgrade}, ${price}."\n\n',
        "`w{player}: `$\"A {last}? For your {dRelation}? Let's talk about {upgrade}. ${price} and {dHe}'ll look better than at the wedding.\"\n\n",
      ],
    },
    {
      id: "flowers",
      label: "Flowers",
      track: "any",
      tiers: [
        { article: "a", name: "Single Carnation", price: 0, tags: [] },
        { article: "a", name: "Floral Arrangement", price: 250, tags: ["flowers"] },
        {
          article: "a",
          name: "Wall of Lilies",
          price: 800,
          tags: ["flowers", "prestige"],
          requires: "florist-cooler",
        },
        {
          article: "a",
          name: "Blanket of Black Roses",
          price: 1200,
          tags: ["flowers", "prestige", "sentimental"],
          requires: "florist-cooler",
        },
      ],
      pitch: [
        "`w{player}: `$\"Nothing says 'we tried' like {article} {upgrade}. Only ${price}.\"\n\n",
        '`w{player}: `$"A {last} is... a choice. A brave one. Most families go with {article} {upgrade} for ${price}."\n\n',
        '`w{player}: `$"Flowers hide a multitude of smells. {upgrade}, ${price}. Trust me on the smells."\n\n',
      ],
    },
    {
      id: "plot",
      label: "Plot",
      track: "burial",
      noPet: true,
      tiers: [
        { article: "a", name: "Standard Plot", price: 0, tags: [] },
        { article: "a", name: "Forest Lawn Plot", price: 1500, tags: ["prestige"], plotIncome: 10 },
        {
          article: "a",
          name: "Memorial Park Plot",
          price: 3000,
          tags: ["prestige", "sentimental"],
          plotIncome: 25,
        },
        {
          article: "a",
          name: "Crypt (Lower Bunk)",
          price: 5000,
          tags: ["prestige", "vanity"],
          plotIncome: 60,
          requires: "mausoleum",
        },
      ],
      pitch: [
        '`w{player}: `$"The {last} is right next to the drainage ditch. {upgrade} has a view. Of other graves, but still. ${price}."\n\n',
        '`w{player}: `$"Location, location, location. {upgrade}, ${price}. The neighbors are very quiet."\n\n',
        '`w{player}: `$"You wouldn\'t put {dHim} in a {last} forever, would you? {upgrade} is only ${price}."\n\n',
      ],
    },
    {
      id: "headstone",
      label: "Headstone",
      track: "burial",
      noPet: true,
      tiers: [
        { article: "a", name: "Wooden Cross", price: 0, tags: [] },
        { article: "a", name: "Granite Headstone", price: 700, tags: ["sentimental"] },
        { article: "a", name: "Giant Headstone", price: 2550, tags: ["prestige", "vanity"] },
        { article: "a", name: "Naked Statue", price: 4000, tags: ["vanity", "prestige"] },
      ],
      pitch: [
        '`w{player}: `$"Termites love a {last}. A {upgrade}, on the other hand, lasts until the sun explodes. ${price}."\n\n',
        '`w{player}: `$"People will walk past {dHim} for a hundred years. Give them something to look at: {article} {upgrade}, ${price}."\n\n',
        '`w{player}: `$"The {upgrade} is our most popular model with families who loved the deceased. ${price}. Just saying."\n\n',
      ],
    },
    {
      id: "urn",
      label: "Urn",
      track: "cremation",
      tiers: [
        { article: "a", name: "Cardboard Box", price: 0, tags: [] },
        { article: "a", name: "Memorial Urn", price: 400, tags: ["sentimental"] },
        { article: "a", name: "Gold-Plated Urn", price: 1200, tags: ["prestige", "vanity"] },
        {
          article: "an",
          name: "Ashes Fired From a Cannon",
          price: 2500,
          tags: ["vanity", "prestige"],
        },
      ],
      pitch: [
        '`w{player}: `$"A {last}. For your {dRelation}. On your mantel. Next to the good china. Or, {article} {upgrade} for ${price}."\n\n',
        "`w{player}: `$\"{upgrade}, ${price}. Because 'shake and bake' doesn't have to mean 'cheap'.\"\n\n",
        '`w{player}: `$"What would {dFirst} want? I think {dFirst} would want {article} {upgrade}. ${price}."\n\n',
      ],
    },
    {
      id: "service",
      label: "Service",
      track: "any",
      tiers: [
        { article: "", name: "Ten Minutes of Silence", price: 0, tags: [] },
        { article: "an", name: "Organist", price: 300, tags: ["music", "religious"] },
        {
          article: "a",
          name: "Gospel Choir",
          price: 900,
          tags: ["music", "religious", "prestige"],
        },
        {
          article: "a",
          name: "Celebrity Impersonator Eulogy",
          price: 1800,
          tags: ["vanity", "music"],
        },
      ],
      pitch: [
        '`w{player}: `$"{last} is lovely, if you like hearing people\'s stomachs growl. {article} {upgrade} is ${price}."\n\n',
        '`w{player}: `$"Picture it: {article} {upgrade}, not a dry eye in the house. ${price}."\n\n',
        '`w{player}: `$"For ${price}, {article} {upgrade} will make sure nobody remembers what {aFridge} did to {dHim}."\n\n',
      ],
    },
  ],

  cremation: {
    name: "Cremation",
    fee: 1500,
    tags: ["cremation"],
    pitch: [
      '`w{player}: `$"Have you considered cremation? No casket, no plot, no worms. Just a flat ${price}."\n\n',
      "`w{player}: `$\"Some families go with cremation. It's clean, it's quick, and {dHe} can stay on your bookshelf.\"\n\n",
      '`w{player}: `$"Our new incinerator is very efficient. I could do {dHim} at lunch."\n\n',
    ],
    accept: [
      "{customer}\"Thank god, I didn't want to buy a box {dHe}'d just lie in.\"",
      '{customer}"Cremation. Yes. {dHeCap} always ran hot anyway."',
      '{customer}"Fine. Smaller to carry around."',
    ],
    refuse: [
      '{customer}"You are NOT setting my {dRelation} on fire."',
      '{customer}"{dHeCap} wanted to be buried. In the ground. Like a normal person."',
      '{customer}"Bake and shake? Over my dead body. Well. Over {dHis}."',
    ],
  },

  prep: [
    {
      id: "ring",
      text: "`$While dressing the body you notice a ring is still on {dFirst} {surname}'s finger. It's a shame to bury such a beautiful stone.",
      picture: "ring/ring&hand",
      options: [
        {
          label: "Take It",
          text: "`$You gently work it off and tuck {dHis} hand into a pocket so no one will notice. A pawn shop gives you a good price.",
          effects: { money: 400, karma: -2 },
          evil: true,
          risk: {
            weight: 0.9,
            failText:
              "`$At the viewing, {surname}'s sister notices the pale band of skin where the ring was. She notices it loudly.",
            failEffects: { karma: -3, reviews: -3 },
          },
        },
        {
          label: "Leave It",
          text: "`$You smile and gently pat it. Some things should go in the ground.",
          effects: { karma: 1 },
        },
      ],
    },
    {
      id: "gold-tooth",
      text: "`${dFirst} has a gold tooth. A big one. It catches the light every time you lean over the table.",
      options: [
        {
          label: "Pliers",
          text: "`$One good yank. Deathville Dental Recycling pays by the gram.",
          effects: { money: 150, karma: -1 },
          evil: true,
        },
        {
          label: "Leave It",
          text: "`$You close {dHis} mouth. {dHeCap} smiles with it, in a way.",
          effects: { karma: 1 },
        },
      ],
    },
    {
      id: "wallet",
      text: "`$There's a fat wallet in {dFirst}'s back pocket. The family never asked about it.",
      options: [
        {
          label: "Pocket It",
          text: "`$Finders keepers. {dFirst} won't be needing bus fare.",
          effects: { money: 300, karma: -2 },
          evil: true,
        },
        {
          label: "Return It",
          text: "`$You hand it to the family. They tell everyone at the wake how honest you are.",
          effects: { karma: 2, reviews: 1 },
        },
      ],
    },
    {
      id: "windex",
      text: "`$You're out of embalming fluid. There's a jug of window cleaner under the sink. It's blue. Embalming fluid is... sort of blue.",
      track: "burial",
      picture: "places/embalming-room",
      options: [
        {
          label: "Use the Windex",
          text: "`$Nobody notices a thing. {dFirst} has never looked so streak-free.",
          effects: { money: 100, karma: -1 },
          evil: true,
          risk: {
            weight: 0.85,
            failText:
              "`$At the viewing {dFirst} faintly glows under the lights. A child points. Then everyone points.",
            failEffects: { reviews: -3 },
          },
        },
        {
          label: "Buy Proper Fluid",
          text: "`$You run to Di-Mart for the real stuff. Elijah charges you the emergency price, the crook.",
          effects: { money: -100, karma: 1 },
        },
      ],
    },
    {
      id: "love-letter",
      text: "`$A folded love letter is tucked in {dFirst}'s shirt pocket. It is not addressed to {dHis} spouse.",
      options: [
        {
          label: "Read It at the Service",
          text: "`$There isn't a dry eye in the house. Also there's a fistfight in the parking lot. People will talk about this one for years.",
          effects: { reviews: 2, karma: -1 },
        },
        {
          label: "Sell It to the Tabloid",
          text: "`$The Deathville Enquirer pays cash and runs it on page three.",
          effects: { money: 250, karma: -2 },
          evil: true,
        },
        {
          label: "Bury It With {dHim}",
          text: "`$Some secrets belong six feet down.",
          effects: { karma: 2 },
        },
      ],
    },
    {
      id: "dog",
      text: "`${dFirst}'s old dog followed the hearse all the way here and is now lying by the back door, whining.",
      options: [
        {
          label: "Adopt It",
          text: "`$You name it Formaldehyde. It is a good dog. It eats like three dogs.",
          effects: { money: -50, karma: 2, luck: 3 },
        },
        {
          label: "Shoo It Away",
          text: "`$You throw a shoe. The dog takes the shoe. You are now down a shoe.",
          effects: { karma: -1 },
        },
      ],
    },
    {
      id: "wrong-body",
      text: '`$The toe tag says {surname}, but this one has a tattoo that says "BIG STEVE". You have a feeling there has been a mix-up at the hospital.',
      options: [
        {
          label: "Bury Him Anyway",
          text: "`$Big Steve, {surname}, close enough. Nobody looks closely at a closed casket.",
          effects: { karma: -2 },
          risk: {
            weight: 0.8,
            failText:
              "`$Halfway through the eulogy the real {dFirst} is wheeled in the side door. Awkward does not begin to cover it.",
            failEffects: { reviews: -4 },
          },
        },
        {
          label: "Call the Hospital",
          text: "`$It takes all afternoon, but the right body arrives. The family never knows how close it was.",
          effects: { karma: 1, reviews: 1 },
        },
      ],
    },
    {
      id: "spare-parts",
      text: '`$A man in a lab coat at the back door offers $500 for "spare parts, no questions asked." He has a cooler.',
      karmaBelow: 60,
      options: [
        {
          label: "Take the Cooler",
          text: "`$You don't ask what he takes. He doesn't ask how you sleep. Everyone is happy except {dFirst}, who is past caring.",
          effects: { money: 500, karma: -3 },
          evil: true,
        },
        {
          label: "Slam the Door",
          text: "`$You slam the door on his foot. It feels great.",
          effects: { karma: 1 },
        },
      ],
    },
    {
      id: "twitch",
      text: "`${dFirst}'s finger twitches. Then the foot. With the right words from that book in your basement, {dHe} could mop floors for a week.",
      karmaBelow: 30,
      picture: "mother/finger",
      options: [
        {
          label: "Say the Words",
          text: "`${dFirst} sits up, groans, and mops the embalming room. Badly, but for free. The smell lingers for days.",
          effects: { money: 300, karma: -3, luck: 5 },
          evil: true,
        },
        {
          label: "Lay {dHim} to Rest",
          text: "`$You put a hand on {dHis} chest until the twitching stops. Not today, {dFirst}.",
          effects: { karma: 1 },
        },
      ],
    },
    {
      id: "blessing",
      text: "`$Father Smyth drops by and offers to bless {dFirst} for free, as long as you put the bake sale flyer in the program.",
      karmaAbove: 70,
      picture: "people/churchguy_h",
      options: [
        {
          label: "Accept the Blessing",
          text: "`$Father Smyth blesses the body, the casket, you, the coffee machine and, for some reason, the hearse.",
          effects: { karma: 1, reviews: 2 },
        },
        {
          label: "No Flyers",
          text: "`$Father Smyth leaves, muttering something about lemon bars.",
          effects: {},
        },
      ],
    },
    {
      id: "light-ashes",
      text: "`${dFirst}'s ashes come out about a pound light. The cat litter is right there on the shelf.",
      track: "cremation",
      picture: "places/creamation_oven",
      options: [
        {
          label: "Top It Up",
          text: "`$A cup of Kitty Klump and nobody is any the wiser. Clumps a little, though.",
          effects: { money: 50, karma: -1 },
          evil: true,
        },
        {
          label: "Tell the Family",
          text: "`$You explain that some people are just light. They seem oddly proud.",
          effects: { karma: 1, reviews: -1 },
        },
      ],
    },
    {
      id: "grin",
      text: "`$Rigor mortis has left {dFirst} with an enormous grin, like {dHe} just heard a filthy joke.",
      options: [
        {
          label: "Leave the Grin",
          text: "`$At the viewing everyone agrees {dFirst} looks happier than {dHe} ever did alive. One aunt faints. It's taken as a good omen.",
          effects: { luck: 5, reviews: -1 },
        },
        {
          label: "Staple Gun",
          text: "`$Two staples and a firm hand. {dFirst} looks dignified, and only slightly surprised.",
          effects: { karma: 1, reviews: 1 },
          risk: {
            weight: 0.9,
            failText:
              "`$During the viewing a staple gives out with an audible ping. The grin returns. So does the aunt, to faint again.",
            failEffects: { reviews: -3 },
          },
        },
      ],
    },
  ],

  upgrades: {
    paint: {
      name: "Fresh Paint",
      description: "Covers the graffiti and most of the smell. First step out of the shack.",
    },
    "coffee-machine": {
      name: "Coffee Machine",
      description:
        "Real coffee instead of instant. Offer Coffee calms customers half again as much.",
    },
    "guard-dog": {
      name: "Guard Dog",
      description:
        "Security level 1: rivals sometimes get chased off at the door, and you hit harder in a fight at home.",
    },
    "florist-cooler": {
      name: "Florist Cooler",
      description: "Unlocks the Wall of Lilies and the Blanket of Black Roses.",
    },
    storeroom: { name: "Storeroom", description: "Room for 18 caskets instead of 6." },
    "embalming-lab": {
      name: "Embalming Lab",
      description: "Unlocks Air-Brushed Embalming. The fumes are only mildly illegal.",
    },
    alarm: {
      name: "Alarm System",
      description: "Security level 2. Needs the Guard Dog, who hates it.",
    },
    "viewing-room": {
      name: "Viewing Room",
      description: "Somewhere to sit. Customers have 2 more patience. Needs Fresh Paint.",
    },
    incinerator: {
      name: "Incinerator",
      description: "Unlocks the cremation track: offer to cremate instead of bury, then sell urns.",
    },
    "night-watchman": {
      name: "Night Watchman",
      description:
        "Security level 3. He is mostly asleep, but loudly, and families like a parlor with a man at the door: richer customers. Needs the Alarm System.",
    },
    chapel: {
      name: "Chapel",
      description: "A real chapel. Richer families come to you. Needs the Viewing Room.",
    },
    mausoleum: {
      name: "Mausoleum",
      description:
        "Marble everything. Unlocks crypt plots, which pay well every day. Needs the Chapel.",
    },
    billboard: {
      name: "Billboard on Route 9",
      description:
        "Your face, forty feet wide, over the words WE'LL TAKE IT FROM HERE. Richer customers. Needs a signage permit.",
    },
    "memorial-garden": {
      name: "Memorial Garden",
      description:
        "Gravel paths, a fountain that mostly works, and benches for the bereaved to sit and wonder what it cost them. Customers stay a little longer, and richer families notice you. Needs a zoning permit.",
    },
    crematorium: {
      name: "Crematorium Annex",
      description:
        "A proper smokestack instead of the old pizza oven. Upscale families like to watch. Needs the incinerator and a crematory permit.",
    },
  },

  text: {
    hints: {
      notEnoughCash: "Not enough cash",
      storeroomFull: "Storeroom full",
      nothingToFill: "Nothing to fill",
      dugEnough: "Dug enough today",
      noTurns: "No turns left",
      current: "Current",
      needsMoney: "Needs ${money}",
      costsTurns: "{turns} turn",
    },
    negotiation: {
      request: [
        '{customer}"My {dRelation} {dFirst} was {dSmashed} {aFridge}. I need a {casket} casket and a plot. Can you do it?"',
        '{customer}"It\'s {dFirst}. My {dRelation}. {AFridge} was involved. I was thinking a {casket} casket?"',
        '{customer}"I need to bury my {dRelation}. {dFirst} would have wanted {casket}. Or so {dHe} said, loudly, often."',
        '{customer}"{dFirst} is gone. {AFridge} was involved, if you can believe it. Something {casket}, please."',
      ],
      petRequest: [
        '{customer}"{dFirst} needs a proper send-off. A {casket} casket. A small one. Unless {pet}s come in medium?"',
      ],
      selfRequest: [
        "{customer}\"Put me down for a {casket} casket. I'll be using it eventually, so don't skimp.\"",
      ],
      repeat: {
        happy: [
          '{customer}"We came back because of how you handled Grandpa. The whole {surname} family says hello."',
          '{customer}"You did such a lovely job last time. We just keep dying, us {surname}s."',
        ],
        ok: ['{customer}"You buried my other relative. It was fine. I suppose you\'ll do."'],
        sour: [
          "{customer}\"Last time you sold us {aFridge}-proof casket. It wasn't. We're watching you.\"",
          '{customer}"The {surname} family remembers last time. We\'re only here because the other place is closed."',
        ],
        walked: [
          '{customer}"The {surname}s don\'t forget. You treated us like garbage. Convince me otherwise. Fast."',
        ],
      },
      estimate: "`wYou figure {cHe} can spend between ${low} and ${high}.`$",
      resistance: "`wYou successfully analyze {cHis} resistance.`$",
      psychTell: "`wYou notice something:`$ ",
      nothingExtra: "`$You can't read anything else about {cHim} yet.",
      bonusRule:
        "`5Bonus if the bill lands within `#{nice}%`5 of what {cHe} can pay, more within `#{great}%`5, and a lot for the exact amount.",
      total: "\n\nTotal: ${price}",
      buttons: {
        coffee: "Coffee",
        listen: "Listen",
        discount: "Discount",
        packages: "Packages",
        back: "Back",
        cremation: "Cremation",
        bless: "Bless",
        raise: "Raise Mourners",
      },
      hints: {
        coffeeUsed: "Already had coffee",
        nothingToLearn: "Nothing more to learn",
        discountMax: "No more discounts",
        discountTooSmall: "The bill is too small to discount",
        hardMaxed: "Already the best casket",
        cremationTrack: "Cremation: no casket to upgrade",
        noPackages: "Nothing left to upgrade",
        blessUsed: "Already blessed",
        raiseUsed: "The mourners are already up",
        handEmpty: "Nothing left to offer",
        needsUpgrade: "Your parlor can't offer this yet",
      },
      handIntro: "`$Which do you pitch?",
      packagesIntro: "`$Which part of the funeral do you upgrade?",
      softPitch: [
        "`w{player}: `$\"Most families in your situation go with {article} {item}. ${price}, and it says 'we cared' without saying 'we cared a lot'.\"\n\n",
        '`w{player}: `$"{dFirst} would have loved {article} {item}. I didn\'t know {dHim}, but I feel it. ${price}."\n\n',
        '`w{player}: `$"For just ${price}, {article} {item} will make the other mourners feel cheap. Isn\'t that what this is about?"\n\n',
        "`w{player}: `$\"We're running a special on {item}. It's ${price}. That's the special price. It's always the special price.\"\n\n",
        '`w{player}: `$"Can I interest you in {article} {item}? ${price}, and I\'ll throw in a mint."\n\n',
        '`w{player}: `$"You know what this funeral needs? {item}. ${price}. Don\'t ask me why, I just feel it."\n\n',
        "`w{player}: `$\"I shouldn't tell you this, but the mayor's mother had {article} {item}. ${price}.\"\n\n",
        '`w{player}: `$"{item}. ${price}. It\'s tasteful. Mostly."\n\n',
        '`w{player}: `$"Grief is a journey, {cSir}, and every journey needs {article} {item}. ${price}."\n\n',
        '`w{player}: `$"A lot of people regret not getting {article} {item}. For about a week. Then they forget. ${price}."\n\n',
        '`w{player}: `$"Let me paint you a picture: {dFirst}, at peace, with {article} {item}. ${price}. That\'s the picture."\n\n',
        "`w{player}: `$\"I'd hate for you to wake up at 3 a.m. wishing you'd gotten {article} {item}. ${price}.\"\n\n",
        '`w{player}: `$"The {item} is very popular this season. Death has seasons. ${price}."\n\n',
        '`w{player}: `$"Everyone deserves {article} {item}. Even {dFirst}. Especially {dFirst}. ${price}."\n\n',
        '`w{player}: `$"${price} for {article} {item}. Think of it as an investment in being talked about."\n\n',
      ],
      hardPitchWood: [
        '`w{player}: `$"Wood is fine, if {dFirst} was a hamster. Silver is only ${price} more."\n\n',
        '`w{player}: `$"Our wood caskets are made from genuine leftover pallets. Silver, on the other hand, ${price} more, keeps the raccoons out."\n\n',
        '`w{player}: `$"Wood rots, {cSir}. In about a week, in this soil. Silver is ${price} more."\n\n',
        '`w{player}: `$"I could put {dHim} in wood. I could also put {dHim} in a trash bag. Silver is ${price} more and has handles."\n\n',
        '`w{player}: `$"You know what they say: once you go silver, you never go... other things. ${price} more."\n\n',
        '`w{player}: `$"The silver model has a pillow. The wood model has splinters. ${price} difference."\n\n',
        "`w{player}: `$\"Do you want people whispering 'wood' at the viewing? Silver is ${price} more.\"\n\n",
        '`w{player}: `$"Silver. ${price} more. Your {dRelation} survived {aFridge}, well, nearly. {dHeCap} deserves silver."\n\n',
      ],
      hardPitchSilver: [
        '`w{player}: `$"Silver is nice. Gold is nicer. Gold is ${price} nicer, specifically."\n\n',
        '`w{player}: `$"Gold doesn\'t tarnish, {cSir}. Neither will your reputation. ${price} more."\n\n',
        '`w{player}: `$"The gold model is what we bury bank presidents in. And now, for ${price} more, your {dRelation}."\n\n',
        "`w{player}: `$\"Imagine the lid opening and everyone going 'ooh'. That's gold. Silver gets an 'oh'. ${price} more.\"\n\n",
        '`w{player}: `$"Your neighbors went gold. I\'m just saying. ${price} more."\n\n',
        '`w{player}: `$"Silver is for people who came in second, {cSir}. Gold is ${price} more."\n\n',
        '`w{player}: `$"Gold-plated handles, gold-plated hinges, gold-plated everything. ${price} more and {dHe}\'ll shine in the dark."\n\n',
      ],
      guiltPitch: [
        '`w{player}: `$"{dFirst} would have done anything for you. And you\'re thinking about saving a few bucks?"\n\n',
        "`w{player}: `$\"I'm sure {dHe} would understand you going cheap. {dHeCap}'s dead, so {dHe} has to understand.\"\n\n",
        '`w{player}: `$"People at the wake will look in that casket, {cSir}, and then they\'ll look at you."\n\n',
        "`w{player}: `$\"I'm not saying you're cheap. The other families are saying it. I'm just repeating it.\"\n\n",
        '`w{player}: `$"Some folks spend more on their cars than on their {dRelation}. You\'re not one of those folks, are you?"\n\n',
        '`w{player}: `$"{dFirst} is watching from somewhere, {cSir}. Maybe heaven. Maybe the other place. But watching."\n\n',
        "`w{player}: `$\"What will you tell people? '{dFirst} got the discount box'?\"\n\n",
        '`w{player}: `$"You only bury your {dRelation} once. Usually."\n\n',
        '`w{player}: `$"This is the last gift you\'ll ever give {dHim}. Make it count. Make it expensive."\n\n',
        '`w{player}: `$"I had a family in here last week who went cheap. They don\'t sleep anymore."\n\n',
        '`w{player}: `$"You can\'t take it with you. Neither can {dFirst}, but {dHe} can take it into the ground."\n\n',
        '`w{player}: `$"Did {dFirst} ever go cheap on you? Don\'t answer, I can see it in your face."\n\n',
        '`w{player}: `$"The Bible says something about this. I forget what. Something about spending."\n\n',
        '`w{player}: `$"Cheap funerals attract ghosts, {cSir}. It\'s a well-known fact I just made up."\n\n',
        '`w{player}: `$"I can see you loved {dHim}. I can also see your shoes. You can afford more."\n\n',
      ],
      sympathyPitch: [
        '`w{player}: `$"Take all the time you need. The meter isn\'t running. Well, it is, but slowly."\n\n',
        '`w{player}: `$"Tell me about {dFirst}. What was {dHe} like before the {dFridge}?"\n\n',
        '`w{player}: `$"I lost my {dRelation} once. To {aFridge}, as it happens. Small world."\n\n',
        "`w{player}: `$\"Here, have a tissue. Have the whole box. It's on the house. The box isn't, but the tissue is.\"\n\n",
        '`w{player}: `$"Grief is just love with nowhere to go, {cSir}. I read that on a mug."\n\n',
        '`w{player}: `$"You\'re doing great. Really. Most people throw things at this point."\n\n',
        '`w{player}: `$"{dFirst} sounds like a wonderful {dRelation}. I can tell from the paperwork."\n\n',
        '`w{player}: `$"It\'s okay to cry. Over there, though. Not on the brochures."\n\n',
        '`w{player}: `$"I\'m here for you. Professionally. Within business hours."\n\n',
        "`w{player}: `$\"You know, {dHe} isn't really gone. {dHeCap}'s in the back, actually. But spiritually, too.\"\n\n",
        '`w{player}: `$"Let it out. Nobody judges in here. Except the guy across the street. He judges."\n\n',
        '`w{player}: `$"What\'s your favorite memory of {dFirst}? Take your time. Not too much time."\n\n',
        '`w{player}: `$"The first week is the hardest. Then it\'s the second week. Then the paperwork."\n\n',
        '`w{player}: `$"You have my deepest sympathies, {cSir}. And my second-deepest, at a discount."\n\n',
        "`w{player}: `$\"I'm going to put on some soft music. It's the hold music, but it's soft.\"\n\n",
      ],
      coffeePitch: [
        '`w{player}: `$"Can I get you a coffee? It\'s fresh. Fresher than most things in this building."\n\n',
        '`w{player}: `$"Coffee? Cream? Sugar? Something stronger in a coffee cup?"\n\n',
        "`w{player}: `$\"Let's take a breather. I'll get the pot.\"\n\n",
        "`w{player}: `$\"Here, have a cup. Mind the mug, it says 'World's Best Mortician', I bought it myself.\"\n\n",
        '`w{player}: `$"You look like you could use a coffee. Or a nap. I can only offer one of those."\n\n',
        '`w{player}: `$"Coffee is on the house. The house is a funeral home, so drink it quick."\n\n',
        "`w{player}: `$\"Sit, sit. I'll pour. Don't mind the smell, that's not the coffee.\"\n\n",
        '`w{player}: `$"A hot cup of joe makes everything better. Not this, but other things."\n\n',
        '`w{player}: `$"Decaf or regular? I\'ll be honest, they come out of the same pot."\n\n',
        '`w{player}: `$"Let me get you something warm. The coffee, I mean. The other warm things are in the back."\n\n',
        "`w{player}: `$\"Biscotti? I've had these since the Reagan administration but they're fine.\"\n\n",
        '`w{player}: `$"Have a coffee and look at the brochures. No pressure. Some pressure."\n\n',
        '`w{player}: `$"This coffee is so good people have died for it. Not here. Mostly not here."\n\n',
        '`w{player}: `$"Let\'s pause and have a cup. Grief is a marathon, coffee is the water station."\n\n',
        '`w{player}: `$"I\'ll make a fresh pot. You just sit there and feel your feelings."\n\n',
      ],
      coffeeAccept: {
        loved: [
          '{customer}"Thank you. {dFirst} took it black. Like {dHis} heart, {dHe} used to say. {dHeCap} was joking. I think."',
          "{customerName} wraps both hands around the mug and stops shaking a little.",
        ],
        notLoved: [
          '{customer}"Sure, free is free."',
          "{customerName} drinks it in one gulp and asks if there's a refill.",
        ],
      },
      coffeeRefuse: [
        '{customer}"Coffee? I don\'t have TIME for coffee."',
        '{customer}"No coffee. Just get on with it."',
      ],
      listenPitch: [
        '`w{player}: `$"Tell me about {dHim}. Take your time."\n\n',
        '`w{player}: `$"I\'d like to know more about {dFirst}. Who was {dHe}, really?"\n\n',
        '`w{player}: `$"So. How are you holding up?"\n\n',
        '`w{player}: `$"Walk me through it. From the start. Before the {dFridge}."\n\n',
        '`w{player}: `$"What do you think {dFirst} would want?"\n\n',
        "`w{player}: `$\"Talk to me. I'm a good listener. It's in the brochure.\"\n\n",
        '`w{player}: `$"Is there anything you want to get off your chest?"\n\n',
        '`w{player}: `$"How did the family take it?"\n\n',
        '`w{player}: `$"What did {dFirst} do for a living? Besides, you know, the dying."\n\n',
        '`w{player}: `$"Do you have any plans for the... aftermath? Financially, I mean. Emotionally too."\n\n',
        '`w{player}: `$"You can tell me anything. Funeral directors are like priests. Cheaper confessions."\n\n',
        '`w{player}: `$"I\'m just going to sit here and nod. You talk."\n\n',
        '`w{player}: `$"Were you and {dFirst} close?"\n\n',
        '`w{player}: `$"Tell me a story about {dFirst}. A short one."\n\n',
        '`w{player}: `$"Mm-hmm. And how did that make you feel?"\n\n',
      ],
      listenTrait: "`wYou learn something new: `#{trait}`w.`$ ",
      listenNothing: [
        "{customerName} has run out of things to say and is now describing the weather.",
        "{customerName} just repeats the story about the {dFridge} again.",
      ],
      listenLoved: ["{customerName} seems grateful someone asked."],
      listenNotLoved: ["{customerName} sighs and looks at the clock."],
      discountPitch: [
        "`w{player}: `$\"Tell you what. I'll knock ${amount} off. Because I like you. Don't tell anyone.\"\n\n",
        '`w{player}: `$"Family discount: ${amount} off. You\'re family now. Sort of. Legally no."\n\n',
        '`w{player}: `$"For you? ${amount} off. My accountant will cry, but my accountant cries anyway."\n\n',
        '`w{player}: `$"Let\'s call it ${amount} off for the trouble with the {dFridge}."\n\n',
        '`w{player}: `$"Since {dFirst} was such a valued member of the community, ${amount} off."\n\n',
        '`w{player}: `$"I\'m running a grief special. ${amount} off. Today only. Every day is today."\n\n',
        '`w{player}: `$"I\'ll take ${amount} off if you promise to stop crying on the leather."\n\n',
        '`w{player}: `$"Okay, okay. ${amount} off. You drive a hard bargain for a person in mourning."\n\n',
        '`w{player}: `$"${amount} off. Seniors, veterans and the recently bereaved. That last one is you."\n\n',
        "`w{player}: `$\"You know what, ${amount} off. I'm feeling generous. It'll pass.\"\n\n",
        '`w{player}: `$"Let me see what I can do... ${amount} off. That\'s my final offer. Probably."\n\n',
        "`w{player}: `$\"I'll waive the ${amount} body-handling fee. There is no body-handling fee. Now there's a discount.\"\n\n",
        '`w{player}: `$"Loyalty discount, ${amount}. You weren\'t loyal before, but you will be."\n\n',
        '`w{player}: `$"${amount} off, because {dFirst} was {dSmashed} {aFridge} and that\'s just bad luck."\n\n',
        '`w{player}: `$"I never do this. ${amount} off. I do this all the time."\n\n',
      ],
      discountAccept: [
        '{customer}"Well. That\'s something, I suppose."',
        '{customer}"Oh! Thank you. Really."',
        "{customerName} relaxes a little in the chair.",
      ],
      discountHaggle: [
        '{customer}"Now we\'re talking. Keep going."',
        '{customer}"See? Was that so hard? Do it again."',
      ],
      packagePitch: [
        "`w{player}: `$\"I'd feel terrible if I didn't mention {article} {upgrade}. ${price}.\"\n\n",
        '`w{player}: `$"The {last} is our basic option. Basic. Like a peasant. {upgrade} is ${price}."\n\n',
        '`w{player}: `$"Families who really care go with {article} {upgrade}. ${price}. No pressure."\n\n',
        '`w{player}: `$"I could do the {last}. Or I could do {article} {upgrade} for ${price} and you could sleep at night."\n\n',
        '`w{player}: `$"Upgrade to {article} {upgrade}? ${price}. I see you as a {upgrade} kind of person."\n\n',
        "`w{player}: `$\"Have you considered {article} {upgrade}? It's ${price} and it doesn't come with the smell.\"\n\n",
        '`w{player}: `$"The {upgrade} is ${price}. The {last} is free, which tells you everything."\n\n',
        '`w{player}: `$"{dFirst} survived... well, didn\'t survive {dFridge}. {dHeCap} deserves {article} {upgrade}. ${price}."\n\n',
        "`w{player}: `$\"For ${price}, {article} {upgrade} says what words can't. Mostly 'we paid for this'.\"\n\n",
        '`w{player}: `$"Everyone at the wake will notice {article} {upgrade}. Everyone will notice a {last}, too."\n\n',
        '`w{player}: `$"I personally recommend {article} {upgrade}. ${price}. I get no commission. I get some commission."\n\n',
        '`w{player}: `$"Let\'s not cut corners on {dFirst}. {upgrade}, ${price}."\n\n',
        '`w{player}: `$"A {last}... sure. If you want people to think you hated {dHim}. {upgrade} is ${price}."\n\n',
        '`w{player}: `$"{upgrade}. ${price}. Tasteful, timeless, tax-deductible. Probably not tax-deductible."\n\n',
        '`w{player}: `$"You only get one funeral, {cSir}. {dFirst} only gets one. {upgrade}, ${price}."\n\n',
      ],
      packageAccept: [
        '{customer}"Alright, I\'ll take it."',
        '{customer}"Fine. Yes. Do that."',
        '{customer}"I suppose {dFirst} would want that."',
        "{customer}\"You had me at 'tax-deductible'.\"",
      ],
      packageRefuse: [
        '{customer}"No. The {last} is fine."',
        '{customer}"I\'m not paying ${price} for that."',
        '{customer}"{dFirst} wouldn\'t want a fuss."',
        '{customer}"Do I look made of money?"',
      ],
      packageOverLimit: '{customer}"That would put me over what I can spend. Something cheaper?"',
      impatient: [
        "{customerName} checks {cHis} watch, loudly.",
        '{customer}"Are we almost done here?"',
        "{customerName} drums {cHis} fingers on your desk.",
        '{customer}"I\'ve been here longer than {dFirst} was in the hospital."',
      ],
      blessPitch:
        '`w{player}: `$"Would you like me to say a little prayer for {dFirst}? Father Smyth taught me. Most of it."\n\n',
      blessResult: {
        loved:
          "{customerName} bows {cHis} head and weeps quietly. {cHeCap} loved {dHim}, that much is clear.",
        notLoved:
          "{customerName} bows {cHis} head politely and checks {cHis} phone during the amen. No love lost there.",
      },
      raisePitch:
        "`$You mutter a few words from the book in your basement. Somewhere in the back room, chairs scrape.\n\n",
      raiseResult:
        "`$Three pale mourners shuffle in and stand behind {customerName}, moaning softly. {cHeCap} decides not to argue about money any more.",
      threat:
        '{customer}"You disappoint me." The large men walk you out to the alley and explain your disappointment to your ribs.',
      // Section 13.5: lines for some customers only (they join the named pool when the ages fit).
      agedLines: [
        {
          pool: "sympathyPitch",
          maxCustomerAge: 17,
          text: '`w{player}: `$"Would you like a juice box? We keep them for the bravest visitors."\n\n',
        },
        {
          pool: "sympathyPitch",
          minCustomerAge: 18,
          minDeceasedAge: 60,
          text: '`w{player}: `$"{dFirst} had a long life. The good ones always seem too short anyway."\n\n',
        },
      ],
    },
    done: {
      success:
        "`w`$The service is a success! Total bill is ${price}.\n\n{extra}You earn `w{bp}`$ Bury Points and a {casket} sales tag.",
      perfect:
        "`wPERFECT! `$The bill is exactly what {cHe} could pay: `w+{bonus}`$ BP (half the sale again, plus a little extra).\n\n",
      great: "`wGREAT! `$Within {percent}% of what {cHe} could pay: `w+{bonus}`$ BP.\n\n",
      nice: "`wNICE! `$Within {percent}% of what {cHe} could pay: `w+{bonus}`$ BP.\n\n",
      missed:
        "`8You left about ${left} on the table. A bill within {nice}% of what they can pay earns a bonus.`$\n\n",
      underdog: "`wUNDERDOG! `$The town roots for the little guy: `w+{bonus}`$ BP.\n\n",
      insurance: "`8Peace Pledge insurance: -{tax} BP.`$\n\n",
      money: "The parlor takes in `w${money}`$.",
      fromStock: " ({tier} casket from stock)",
      rushOrder: " (rush order {tier} casket from Di-Mart: ${cost})",
      happy: "\n\n`2The family leaves happy and will tell their friends.`$",
      sour: "\n\n`4The family leaves grumbling. Word gets around.`$",
      specialTv: '"{name} just handled the {special}," a reporter says.',
      prepButton: "Prepare the Body",
      fainted:
        "\n`wYou fainted while dealing with a customer.`$\n\nYou vaguely remember riding in an ambulance.\n\n",
      future: "\n\n`$They will settle the rest when the time comes (in about {days} days).",
      cremated: "wood (cremation)",
    },
    desk: {
      menuParlor: "Parlor",
      accidents:
        "\n`$People keep having accidents near your parlor. You don't ask how. `w+{turns}`$ turn.",
      banked: "\n`$You carried over `w{turns}`$ unused turns from yesterday.",
      hearsePaid: "\n`$Gas and insurance for your {ride}: `w${upkeep}`$.",
      hearseUnpaid:
        "\n`4You can't pay the ${upkeep} for your {ride} today. It stays in the garage: no bonus turns.`$",
      plotIncome: "\n`$Your `w{plots}`$ plots bring in `w${money}`$ in upkeep fees.",
      futurePaid: "\n{text} `w+{bp}`$ BP, `w+${money}`$.",
      digFound:
        "`$You dig around the old graves behind the parlor and find `w${money}`$ worth of watches and teeth.",
      digCaught:
        "`$You dig all afternoon and find nothing but a very angry groundskeeper. People talk.",
      digTag: "`$Your shovel hits a coffin with a sales tag still on it. A `wgold tag`$!",
    },
    office: {
      title: "Your Office",
      summary:
        "`w{parlor}`$ ({level})\n\nRating: `w{rating}`$ ({ratingTitle})\nKarma: `w{karma}`$ ({karmaTitle})\nCash: `w${money}`$\nCaskets in stock: {stock}\nMarkup: `w{markup}%`$   Rivalry: `w{rivalry}`$\n{perks}",
      buttons: {
        upgrades: "Upgrades",
        markup: "Markup",
        rivalry: "Rivalry",
        dig: "Dig for Goodies",
        back: "Back",
        buy: "Buy",
      },
      upgradesIntro:
        "`$A contractor with a pencil behind his ear waits for you to point at something.\n\n",
      upgradeLine: "`w{name}`$ (${price}): {description}\n",
      bought: "`$The contractor gets to work. `w{name}`$ is done by lunch, mostly.",
      cantAfford: "`$The contractor looks at your bank statement and laughs.",
      needs: "Needs {name}",
      owned: "Owned",
      markupIntro:
        "`$How much do you mark up your caskets? A higher markup means bigger bills but harder sells and a worse reputation.",
      markupSet: "`$Casket markup set to `w{markup}%`$.",
      rivalryIntro:
        "`$How rough do you play? You can change this once every 3 days.\n\n`wPeace Pledge:`$ nobody can visit or burn you, you can't visit anyone, and {tax}% of every sale goes to insurance.\n`wStandard:`$ the usual.\n`wCutthroat:`$ one extra visit a day, and fights with other cutthroat parlors pay a quarter more.",
      rivalryNames: { peaceful: "Peace Pledge", standard: "Standard", cutthroat: "Cutthroat" },
      rivalryHints: {
        peaceful: "Safe from rivals, {tax}% insurance on sales",
        standard: "The usual",
        cutthroat: "Extra visit; bigger fights",
      },
      rivalrySet: "`$You are now `w{rivalry}`$.",
      rivalryWait: "Wait {days} more days",
      levelNames: ["Shack", "Fixer-Upper", "Respectable", "Chapel House", "Colonial Mansion"],
      noPerks: "No karma perks yet.",
    },
    store: {
      caskets: "Caskets",
      casketIntro:
        '`wElijah: `$"Caskets at wholesale. Wood ${wood}, silver ${silver}, gold ${gold}. You\'ve got {have} in the back and room for {room} more."',
      buyLabel: "{tier} (${price})",
      restock: "Fill Up",
      bought:
        '`wElijah: `$"One {tier} casket, ${price}. Want it gift wrapped? I don\'t gift wrap."',
      restocked:
        '`wElijah: `$"{count} caskets, ${price}. I\'ll have the boy drop them off. The boy is 64."',
      full: '`wElijah: `$"Your storeroom is full. Sell some dead people first."',
      cantAfford: '`wElijah: `$"Cash up front, friend. I don\'t do layaway on caskets."',
      shadyDiscount: " `8(Elijah gives you the back-room price.)`$",
    },
    university: {
      capped:
        '`$The professor shakes his head. "There is nothing more I can teach you about the human mind. Go read some faces."',
      hpCapped:
        "`$The coach looks you over. \"You're as tough as you're going to get. Any more and you'd be a wall.\"",
      strengthCapped:
        '`$"Any stronger and you\'ll tear the caskets in half," the coach says. "Go buy a nicer hearse instead."',
    },
    visit: {
      selfPeaceful:
        "`$You signed the Peace Pledge. Visiting rivals is off the table until you change your rivalry at your office.",
      targetPeaceful:
        "`$There's a Peace Pledge sign on {name}'s door and a police car idling across the street. Not today.",
      turnedAway:
        "`$Something big and hairy hurls itself at {name}'s window. You decide to come back never.",
      turnedAwayMail: "\n`$Your security scared off a prowler last night!\n",
      cashStolen: "\n`$You also find `w${money}`$ in the register.",
      cashStolenMail: "\n`$The thief also emptied `4${money}`$ from your register.\n",
    },
    prep: {
      header: "`wPreparing the body`$\n\n",
      continue: "Continue",
      riskFailed: "\n\n`4It goes badly.`$",
    },
    stats: {
      labels: {
        money: "Cash",
        karma: "Karma",
        rating: "Rating",
        parlor: "Parlor",
        stock: "Caskets in stock",
        markup: "Casket markup",
        rivalry: "Rivalry",
        banked: "Turns banked",
        plotIncome: "Plot income a day",
        perks: "Perks",
        sales: "Sales / walkouts",
      },
    },
    tutorial: {
      speaker: "`wClerk: `$",
      pages: [
        "`wClerk: `$\"Welcome to Deathville, {name}! I'm from the Funeral Director's Guild. Congratulations on {parlor}. It's... a building.\n\nLet me show you the ropes before your first customer comes in. It'll take two minutes, or you can skip it.\"",
        "`wClerk: `$\"Every day you get turns. Each customer you meet costs one. Unused turns carry over to tomorrow, up to one day's worth, so don't panic.\n\nYou score Bury Points for every funeral. The parlor with the most at the end of the season wins.\"",
        '`wClerk: `$"Customers have a limit, a most they\'ll spend. You never see it exactly: you get an estimate, and it gets better as you learn psychology.\n\nThe closer the bill lands to their limit, the bigger your bonus. Hit it exactly and the whole town hears about it."',
        '`wClerk: `$"Read the customer! Their mood, their traits and the little things they say all mean something. Someone who keeps checking their phone didn\'t love the deceased: Guilt works on them. Someone clutching a photo did: use Sympathy.\n\nIf they get too angry, they walk out and a rival gets the body."',
        "`wClerk: `$\"Soft Sell shows you three extras to pick from: choose ones that fit what they can pay. Packages upgrade the plot, headstone, flowers and so on. Coffee calms people down once. Listen teaches you something but uses up their patience. A Discount cheers them up but lowers the bill.\n\nAfter the funeral you'll sometimes have a choice while preparing the body. Be good and the church sends business your way. Be bad and... well, the money's nice.\"",
        "`wClerk: `$\"That's it! Your first customer is waiting. I'll be watching. I'll make notes. Don't mind me.\"",
      ],
      next: "Next",
      skip: "Skip Tour",
      start: "Meet Your Customer",
      hints: {
        arrival:
          "Clerk: Look at the mood word and what they say. Then try Soft Sell and pick an item that keeps the bill under the top of the estimate.",
        hand: "Clerk: Pick the card that brings the bill closest to their limit without going over.",
        packages: "Clerk: Each line upgrades one part of the funeral. Mind the price.",
        afterPitch:
          "Clerk: Keep an eye on the mood and the patience. When the bill is near the estimate, press Done.",
        impatient:
          "Clerk: They're getting impatient! Every extra action now makes them angrier. Wrap it up.",
        done: "Clerk: Well done! Press Continue.",
      },
      finish:
        '`wClerk: `$"Not bad for a first day! Wait for more customers until you run out of turns, then visit the town. Di-Mart sells caskets wholesale, and your Parlor office has upgrades. Good luck. Try not to get stabbed."',
    },
    perks: {
      trusted: {
        name: "Trusted",
        description:
          "Families arrive calmer and less stingy. +2 rating (+5 as a Church Associate).",
      },
      "church-associate": {
        name: "Church Associate",
        description:
          "Bless a customer once to calm them and learn if they loved the deceased. Rivals win half as much from you.",
      },
      "grave-robber": {
        name: "Grave Robber",
        description:
          "Dishonest choices pay double, Di-Mart gives you the back-room price, and twice a day you can dig for goodies at your office or rob a fresh grave without losing a customer.",
      },
      necromancer: {
        name: "Necromancer",
        description:
          "Raise mourners once per customer to scare them out of haggling, people keep having 'accidents' nearby (one more customer a day), and your attacks pay 15% more.",
      },
    },
    arson: {
      offer:
        "`wThe Twins: `y\"We like to play with fire. We'll discreetly pay a 'visit' to any funeral parlor in town for only {cost} gold tags.\"\n\nA fire burns 5 percent of the gravestones, all wood tags, half the caskets in stock and the parlor's reputation. A smoke detector stops it 80 percent of the time; a safe saves the tags.",
      peaceful:
        '`yThe twins look at the Peace Pledge sign, then at the police car across the street. "No way, boss."',
      burned:
        "`yYou watch from your window.\n\n`wA fire engulfs {home}!\n\n`y{name} loses `w{burned}`y gravestone(s), `w{tags}`y wood tag(s) and `w{stock}`y casket(s). The neighbours will be talking for a week.",
      burnedMail:
        "\n`yA mysterious fire was started on your property. You lost `4{burned}`y gravestone(s), `4{tags}`y wood tag(s) and `4{stock}`y casket(s) from the storeroom. Customers can smell the smoke.\n",
    },
  },
  town: TOWN_STARTER,
};
