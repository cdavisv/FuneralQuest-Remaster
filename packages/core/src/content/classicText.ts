// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" here is a dollar sign before a {price} placeholder, not a template.
import { CLASSIC_SOCIAL_TEXT, type SocialText } from "./socialText.js";

/**
 * Strings the original server hard-coded in C++. They are content, so they
 * live in the pack (`ContentPack.text`); `CLASSIC_TEXT` is the untouched
 * original wording, which an importer can copy or edit.
 *
 * Templates use `{name}` placeholders, listed on each group. Strings keep the
 * original backtick colour codes. Arrays of alternatives are picked with
 * `random(length)`, so the Classic draw counts depend on these lengths:
 * changing a length changes which random numbers later handlers see.
 *
 * Common placeholders in negotiation lines:
 * - `{player}`: the player's display name.
 * - `{customer}`: the customer's speaker tag, "`w" + `{cYoungMan}` + ": `$".
 * - `{cYoungMan}` "Middle aged man", `{cMan}` "man", `{cHe}` "he", `{cHim}`,
 *   `{cHis}`, `{cSir}` "sir"/"ma'am", `{cSirCap}` "Sir"/"Ma'am".
 * - `{dRelation}` "wife", `{dHe}`, `{dHeCap}`, `{dHim}`, `{dSmashed}`
 *   "run over by", `{dFridge}` "piano".
 * - `{limit}` the spending limit with separators.
 */
export interface ClassicText {
  newPlayer: {
    /** {max} (legacy/source/new_user.cpp:34) */
    townFull: string;
    nameShort: string;
    nameLong: string;
    /** {name} */
    nameTaken: string;
    logonShort: string;
    logonLong: string;
    /** {logon} */
    logonTaken: string;
    parlorShort: string;
    parlorLong: string;
    passwordLong: string;
    passwordShort: string;
    passwordMismatch: string;
    emailShort: string;
    emailLong: string;
    /** Broadcast to players online. {name} */
    movedIn: string;
    /** Front page. {parlor} {name} */
    newsOpened: string;
  };
  session: {
    /** {name} */
    loggedOn: string;
    /** {name} */
    loggedOff: string;
  };
  desk: {
    title: string;
    /** {name} */
    welcomeBack: string;
    sitting: string;
    sittingPolice: string;
    /** {name} {parlor} {bonus} */
    newDayFirst: string;
    /** {name} {parlor} {bonus} */
    newDayBack: string;
    /** {parlor} {bonus} */
    newDayAtDesk: string;
    /** {ride} {turns} */
    hearseBonus: string;
    policeBonus: string;
    /** Prefix for each delivered mail text: {text} */
    mailLine: string;
    /** Labels of the desk menu, left to right. */
    menu: {
      wait: string;
      map: string;
      news: string;
      stats: string;
      rankings: string;
      quit: string;
    };
    continueLabel: string;
    /** Label of the reply button on a delivered letter. */
    replyLabel: string;
  };
  wait: {
    /** legacy/source/commands_misc.cpp:103-114, picked with `rand() % 3`. */
    noTurns: string[];
    eventHeader: string;
    /** add_reward_text (legacy/source/misc_utils.cpp:50-91): {amount} {what} */
    rewardFirstGain: string;
    rewardFirstLoss: string;
    rewardNextGain: string;
    rewardNextLoss: string;
    rewardEnd: string;
    words: { bp: string; bps: string; luck: string; turn: string; turns: string };
    /** CEvent defaults (legacy/source/CEvent.cpp:12). */
    noMessage: string;
  };
  risk: {
    earnedOne: string;
    /** {amount} */
    earned: string;
    /** {amount} */
    lost: string;
    /** {amount} */
    won: string;
  };
  negotiation: NegotiationText;
  news: {
    nothingToday: string;
    /** {name} {parlor} {bp} */
    topToday: string;
    noTopToday: string;
    /** {name} {parlor} {bp} */
    topYesterday: string;
    noTopYesterday: string;
    /** {name} */
    universeTop: string;
    finalDay: string;
    lastDayTomorrow: string;
    /** {days} */
    daysLeft: string;
    /** {name} perfect sale front-page item */
    perfectSale: string;
    winnerHeadline: string;
    /** {bp} {plots} {name} */
    winnerBody: string;
    meteorHeadline: string;
    meteorBody: string;
    /** Book of Deeds line: {name} */
    deed: string;
  };
  maintenance: {
    /** {luck} {bp} */
    topSeller: string;
    /** {luck} {bp} */
    topParlor: string;
    /** {luck} {bp} */
    secondParlor: string;
    /** {luck} {bp} */
    thirdParlor: string;
    /** {name} */
    closesShop: string;
    /** {name} */
    closesShopNoSale: string;
  };
  stats: {
    title: string;
    labels: {
      turns: string;
      bpTotal: string;
      money: string;
      wood: string;
      silver: string;
      gold: string;
      plots: string;
      bpToday: string;
      psych: string;
      rating: string;
      yangs: string;
      visits: string;
      hpMax: string;
      strength: string;
      lockpicks: string;
      ride: string;
    };
    /** {level} */
    psychLevel: string;
    /** {rank} {title} */
    rating: string;
    /** get_rating_string fallback (legacy/source/commands_misc.cpp:143). */
    noRatingText: string;
  };
  rankings: { title: string; protected: string; inCafe: string; onNow: string; logon: string };
  map: { title: string };
  stub: {
    /** {place} */
    notBuilt: string;
    leaveLabel: string;
  };
  /** Display names of the hearse table rows (legacy/source/transportation.cpp:22-70). */
  hearseNames: string[];
  /** Descriptions of the hearse table rows, for the store. */
  hearseDescriptions: string[];
  /** The town places: bank, Di-Mart, Spirit University, Yang's, hospital, name change. */
  places: PlaceText;
  /** Visits, battle, cafe, mail, crime news and the log-on game info (content/socialText.ts). */
  social: SocialText;
}

/** Text of the town places (legacy/source/commands_bank.cpp and its siblings). */
export interface PlaceText {
  bank: {
    /** `init_location_info` name (commands_bank.cpp:446). */
    location: string;
    note: string;
    /** {player} */
    greeting: string;
    which: string;
    /** {from}: "Wood", "Silver" or "Gold" */
    convertTo: string;
    /** {fromCount} {from} {toCount} {to} */
    ratio: string;
    /** {sir} */
    amusing: string;
    notEnough: string;
    /** {count} {to} */
    tooFew: string;
    /** {lost} {from} {gained} {to} */
    done: string;
    allToWood: string;
    allToGold: string;
    buttons: {
      allToWood: string;
      allToGold: string;
      exchange: string;
      leave: string;
      gold: string;
      silver: string;
      wood: string;
      back: string;
      continue: string;
    };
  };
  store: {
    location: string;
    note: string;
    /** {player} */
    greeting: string;
    hearseIntro: string;
    /** {n} {name} {price} */
    hearseLine: string;
    /** {name} {description} {bonus} {trade} */
    look: string;
    /** {current} {credit} {cost} */
    lookTrade: string;
    /** Remaster fix, shown instead of `lookTrade` for a hearse that is no upgrade. {current} {name} */
    lookNoUpgrade: string;
    /** {name} */
    cannotAfford: string;
    /** Remaster fix. {current} {name} */
    noUpgrade: string;
    /** {old} {new} {bonus} */
    bought: string;
    buttons: {
      security: string;
      supplies: string;
      hearses: string;
      leave: string;
      /** {n} */
      view: string;
      buyIt: string;
      back: string;
    };
  };
  university: {
    location: string;
    note: string;
    status: string;
    /** {psych} {hp} {strength} */
    schedule: string;
    cantAfford: string;
    /** {level} {extra} */
    psychDone: string;
    /** Skill learned on reaching psych 1, 2, 3, 4, 5 (:168-190). */
    psychSkills: string[];
    /** {hp} */
    hpDone: string;
    strengthDone: string;
    library: string;
    /** {max} */
    paperPrompt: string;
    /** {day} */
    paperMissing: string;
    /** {day} */
    paperFound: string;
    deedsTitle: string;
    deedsNone: string;
    /** {name} {he} */
    deedsHope: string;
    buttons: {
      takePsy: string;
      takePe: string;
      takeSt: string;
      library: string;
      leave: string;
      continue: string;
      back: string;
      oldPapers: string;
      deeds: string;
    };
  };
  yangs: {
    location: string;
    note: string;
    statusReady: string;
    statusKicked: string;
    /** {player} */
    kicked: string;
    /** {dragonLuck} {dragonCost} {sparrowLuck} {sparrowCost} {tigerLuck} {tigerCost} */
    menu: string;
    /** {limit} */
    dragonLater: string;
    dragonBroke: string;
    /** {luck} */
    dragonDone: string;
    /** {player} */
    tigerOut: string;
    sparrowOut: string;
    tigerWho: string;
    sparrowWho: string;
    fortunePrompt: string;
    /** {player} */
    bitchy: string;
    /** {player} */
    selfTarget: string;
    /** {perDay} */
    limit: string;
    notHome: string;
    noPoints: string;
    leaves: string;
    /** TV line: {parlor} */
    tv: string;
    /** Front-page items picked with `random(4)`: {name} {parlor} */
    news: string[];
    /** {fortune} {luck} */
    tigerMail: string;
    /** {name} {fortune} {luck} */
    sparrowMail: string;
    /** {name} {target} {fortune} */
    logTiger: string;
    logSparrow: string;
    buttons: {
      order1: string;
      order2: string;
      order3: string;
      leave: string;
      continue: string;
      getBitchy: string;
    };
  };
  hospital: {
    location: string;
    note: string;
    /** {player} */
    greeting: string;
    roomNote: string;
    roomText: string;
    /** {prince}: "prince charming" or "sleeping beauty" */
    wakeUp: string;
    princeMale: string;
    princeFemale: string;
    leave: string;
  };
  options: {
    location: string;
    noChange: string;
    note: string;
    /** {cost} */
    ask: string;
    prompt: string;
    noGold: string;
    /** {name} */
    same: string;
    short: string;
    long: string;
    /** {name} */
    taken: string;
    /** Front page: {old} {his} {new} */
    news: string;
    /** {name} */
    done: string;
    buttons: { yes: string; no: string; continue: string };
  };
}

export interface NegotiationText {
  /** {cYoungMan} {dRelation} (legacy/source/commands_complicated.cpp:434) */
  arrivalRequest: string;
  /** {casket} {dHim} */
  arrivalNeed: string;
  psych: {
    /** {cHis} */
    resistance: string;
    /** {cHeCap} */
    heartbroken: string;
    /** {cHeCap} */
    guilty: string;
    doubled: string;
    /** {cHe} {limit} */
    estimate: string;
    halvedResistance: string;
    halvedMood: string;
    /** {cHim} */
    nothing: string;
  };
  /** {price} */
  total: string;
  /** {percent} */
  resistance: string;
  buttons: { guilt: string; sympathy: string; hard: string; soft: string; done: string };
  /** Soft Sell pitches (:495-516): {player} {article} {item} {price} {dRelation} */
  softPitch: string[];
  /** Soft Sell refusals (:547-564). Use `{ loved, notLoved }` for lines that depend on the hidden flag. {customer} {dRelation} {dHe} {price} */
  softRefuse: LovedLine[];
  /** Soft Sell acceptances by mood before the sale (:592-611), for mood < 2, < 4, < 7, < 9, else. {customer} {item} */
  softAccept: string[];
  /** {customer} */
  softOverLimit: string;
  /** Hard Sell pitches from Wood (:698-708): {player} {price} {dRelation} */
  hardPitchWood: string[];
  /** Hard Sell pitches from Silver (:715-725): {player} {price} {dRelation} */
  hardPitchSilver: string[];
  /** (:745-765) {customer} {dRelation} {tier} ("silver" or "gold") */
  hardRefuse: LovedLine[];
  /** (:793-799) {customer} */
  hardAccept: string[];
  /** Mood 7 or more (:802): {customer} {tier} */
  hardAcceptAngry: string;
  /** {customer} */
  hardOverLimit: string;
  /** Upgrade pitches (:1117-1133): {player} {last} {upgrade} {price} */
  upgradePitch: string[];
  /** (:1149-1169) {customer} {dRelation} {rawPrice} */
  upgradeRefuse: LovedLine[];
  /** (:1196-1202) {customer} */
  upgradeAccept: string[];
  /** {customer} */
  upgradeAcceptAngry: string;
  /** {customer} */
  upgradeOverLimit: string;
  /** (:1100) {cMan} */
  upgradeNothingLeft: string;
  /** Name of the casket before the first upgrade (:1111). */
  upgradeFirstLast: string;
  /** Guilt pitches (:884-908): {player} {cSir} {cSirCap} {dHim} */
  guiltPitch: string[];
  /** Loved customers (:922-931): {customer} {dHim} {dRelation} {dSmashed} {dFridge} */
  guiltLoved: string[];
  /** Not loved (:941-951): {customer} {dRelation} {limit} */
  guiltNotLoved: string[];
  /** Sympathy pitches (:992-1015): {player} {cSirCap} {dRelation} {dHeCap} {dFridge} */
  sympathyPitch: string[];
  /** Not loved (:1030-1039): {customer} {dRelation} */
  sympathyNotLoved: string[];
  /** Loved (:1049-1060): {customer} {dHe} {dHim} {dSmashed} {dFridge} {dRelation} {limit} */
  sympathyLoved: string[];
  /** (:875) */
  interrupted: string;
  /** leave_pissed (:167-176): {customer} */
  leavePissed: string[];
  /** pissed_over_limit (:234-241): {customer} {limit} */
  pissedOverLimit: string[];
  /** TV line (:179): {income} {young} {man} {parlor} */
  walkoutTv: string;
  /** (:187) {cHim} {cHe} {rivalParlor} {rivalName} */
  rivalWatch: string;
  /** Mail to the rival (:193): {cAYoung} {cMan} {rivalSir} {name} {parlor} {points} */
  rivalMail: string;
  done: {
    /** {cHe} {bonus} (:51) */
    perfect: string;
    /** {range} {bonus} (:61) */
    great: string;
    /** {range} {bonus} (:68) */
    nice: string;
    /** {price} {extra} {bp} {casket} (:80) */
    success: string;
    /** {name} {bp} (:87) */
    bigSaleTv: string;
    /** {name} {his} (:77) */
    faintedTv: string;
    /** {bp} {casket} (:101-106) */
    faintedMail: string;
  };
}

/** A line that depends on the hidden "loved" flag. */
export type LovedLine = string | { loved: string; notLoved: string };

/** The original wording, line by line from legacy/source. */
export const CLASSIC_TEXT: ClassicText = {
  newPlayer: {
    townFull: "The town is full.  (this server allows {max} players max)  Come back later!",
    nameShort: "`wYour `wname is too short.  Try a longer one.",
    nameLong: "`wYour name is too long.  Try a shorter one.",
    nameTaken: "`wSomeone is already using the name {name}. Please try another.",
    logonShort: "`wYour logon name is too short.  Try a longer one.",
    logonLong: "`wYour logon name is too long.  Try a shorter one.",
    logonTaken: "`wSomeone is already using the logon name of {logon}. Please try another.",
    parlorShort: "`wYour funeral parlor name is too short.  Try a longer one.",
    parlorLong: "`wYour funeral parlor name is too long.  Try a shorter one.",
    passwordLong: "`wYour password is too long.  Try a shorter one.",
    passwordShort: "`wYour password is too short.  Try a longer one.",
    passwordMismatch: "`wYour passwords don't match!  Try again, genius.",
    emailShort: "`wEmail address required.  (Only used for game purposes)",
    emailLong: "`wEmail address is too big.  Try a smaller one.",
    movedIn: "{name} has just moved into town!",
    newsOpened: "`5A new parlor ({parlor}) run by {name} has been opened!\r\n\r\n",
  },
  session: {
    loggedOn: "{name} logged on.",
    loggedOff: "{name} logged off.",
  },
  desk: {
    title: "At Home",
    welcomeBack: "`$Welcome back, `w{name}`$.  Unfinished business?\n",
    sitting: "`$You are sitting at your desk.\n",
    sittingPolice: "`$You are sitting at your desk.  Police are outside, you feel safe.\n",
    newDayFirst:
      "`wWelcome to Funeral Quest, {name}.  Good luck.`^\n\n`$You unlock the front door and enter your beloved {parlor} Funeral Parlor.  Ah, it's great to be alive.\n\n{bonus}",
    newDayBack:
      "`wWelcome back, {name}!`^\n\n`$You unlock the front door and enter your beloved {parlor} Funeral Parlor.  Ah, it's great to be alive.\n\n{bonus}",
    newDayAtDesk:
      "`wYou're eyes grow heavy.  You wake up the next morning, still at your desk.\n\n`$You quickly freshen up.. who knows what great things await {parlor} Funeral Parlor today?\n\n{bonus}",
    hearseBonus: "Your {ride} gives you time for `w{turns}`$ extra customers. ",
    policeBonus: "There are police patrolling your parlor.",
    mailLine: "`w{text}\n",
    menu: {
      wait: "Wait for Customer",
      map: "Town Map",
      news: "Read Paper",
      stats: "Stats",
      rankings: "Rankings",
      quit: "Exit",
    },
    continueLabel: "Continue",
    replyLabel: "Reply",
  },
  wait: {
    noTurns: [
      "You are out of turns for the day, come back tomorrow!",
      "It's closing time, you'll have to wait until tomorrow.",
      "You look at your watch - it's late.  Maybe tomorrow.",
    ],
    eventHeader: "`wSPECIAL EVENT\n\n",
    rewardFirstGain: "\n\n`$You earn `w{amount}`$ {what}",
    rewardFirstLoss: "\n\n`4You lose `w{amount}`4 {what}",
    rewardNextGain: " and `w{amount}`$ {what}",
    rewardNextLoss: " and `w{amount}`4 {what}",
    rewardEnd: ".",
    words: { bp: "Bury Point", bps: "Bury Points", luck: "luck", turn: "turn", turns: "turns" },
    noMessage: "No message.",
  },
  risk: {
    earnedOne: "`$You earned one Bury Point, not bad.\n",
    earned: "`$You earned `w{amount}`$ Bury Points.\n",
    lost: "`$You lose `#{amount}`$ Bury Points.",
    won: "`$You earned `w{amount}`$ Bury Points!",
  },
  negotiation: {
    arrivalRequest: '`w{cYoungMan}: `$"Please, I need a funeral service for my {dRelation}. ',
    arrivalNeed: 'I would need a plot and a {casket} casket for {dHim}."',
    psych: {
      resistance: "`wYou successfully analyze {cHis} resistance.`$",
      heartbroken: "`w{cHeCap} seems heartbroken.`$",
      guilty: "`w{cHeCap} seems guilty.`$",
      doubled: "`wSpending limit doubled.`$",
      estimate: "`wYou estimate {cHe} is worth about ${limit}.`$",
      halvedResistance: "`wResistance cut in half.`$",
      halvedMood: "`wMood cut in half.`$",
      nothing: "\n\n`$You are unable to analyze anything extra about {cHim}.",
    },
    total: "\n\nTotal: ${price}",
    resistance: " `5(Resistance: `#{percent}%`5)",
    buttons: {
      guilt: "Guilt",
      sympathy: "Sympathy",
      hard: "Hard Sell",
      soft: "Soft Sell",
      done: "Done",
    },
    softPitch: [
      '`w{player}: `$"You know, your neighbor was in here recently.. he bought {article} {item} for only ${price}. Impeccable taste."\n\n',
      '`w{player}: `$"I can tell by the fine clothes you\'re wearing that you appreciate the finer things. How about {article} {item} for ${price}?"\n\n',
      "`w{player}: `$\"I don't mean to rush you, but this isn't really something you can wait a week thinking about. We do have {article} {item} for ${price}...\"\n\n",
      '`w{player}: `$"You know..  I bet your {dRelation}\'s social security death benefits would probably cover {article} {item} for ${price}?"\n\n',
    ],
    softRefuse: [
      '{customer}"I really don\'t think my {dRelation} needs that."',
      '{customer}"Actually, my {dRelation} wanted a very simple funeral."',
      '{customer}"Um, no."',
      {
        loved:
          '{customer}"When my {dRelation} was alive {dHe} asked me not to buy that.  I\'m sorry."',
        notLoved:
          "{customer}\"I'm not gonna pay another ${price} for an 'effing {dRelation} I barely knew!\"",
      },
      '{customer}"You\'ve got to be kidding."',
      "{customer}\"I'm not saying I can't afford that, but I don't think I really need it.\"",
    ],
    softAccept: [
      '{customer}"Thank you, I\'ll take it."',
      '{customer}"You don\'t say? {item} is something I want then."',
      '{customer}"Fine, I\'ll take it."',
      "{customer}\"I think I'm getting ripped off here but I'll take it.\"",
      '{customer}"WHATEVER!! Just give it to me I guess."',
    ],
    softOverLimit: '{customer}"That would put me over my limit.. how about something cheaper?"',
    hardPitchWood: [
      '`w{player}: `$"Well, I suppose you COULD go with a wood casket.. except it really doesn\'t offer much protection from worms and the like.  How about a Silver Casket for only ${price} additional?"\n\n',
      '`w{player}: `$"Wouldn\'t your {dRelation} prefer our traditional Silver Casket for only ${price} more?"\n\n',
    ],
    hardPitchSilver: [
      '`w{player}: `$"Just think of the beautiful memory picture you would have of your {dRelation} in a Gold Casket - a bargain for only ${price} more!"\n\n',
      '`w{player}: `$"A Gold Casket (only ${price} additional) reflects character and station in life.. its suberb styling reflects a successful living."\n\n',
    ],
    hardRefuse: [
      '{customer}"I really don\'t think my {dRelation} needs that."',
      '{customer}"Actually, my {dRelation} wanted a very simple funeral."',
      '{customer}"A casket is a casket, right?"',
      {
        loved: '{customer}"No way, for that much it should have AC and a stereo!"',
        notLoved: '{customer}"My {dRelation} doesn\'t deserve {tier}."',
      },
      '{customer}"I don\'t want to spend that much."',
      '{customer}"I\'ve got the dough, but I would rather give to charity."',
    ],
    hardAccept: [
      '{customer}"Alright, I\'ll take it."',
      '{customer}"Ok, I\'ll do the upgrade."',
      '{customer}"Well, since you put it that way, ok."',
    ],
    hardAcceptAngry: '{customer}"Fine, I\'ll take the damn {tier} casket, ok?"',
    hardOverLimit:
      '{customer}"That casket would put me over my limit.. how about something cheaper?"',
    upgradePitch: [
      "`w{player}: `$\"A simple {last} may be enough for some.  But tell me, don't the words '{upgrade}' (only ${price} additional) give you goosebumps?\"\n\n",
      '`w{player}: `$"I would feel guilty if I didn\'t mention we do offer a {upgrade} for a small fee of ${price}."\n\n',
      '`w{player}: `$"{upgrade}\'s are a great idea for an enternal slumber. A fee of ${price} will be charged, alright?"\n\n',
    ],
    upgradeRefuse: [
      '{customer}"No."',
      '{customer}"Actually I want a simple funeral for my {dRelation}."',
      '{customer}"I would rather spend money getting drunk after this."',
      {
        loved: '{customer}"God, can\'t you see this is hurting me talking about this now?"',
        notLoved:
          "{customer}\"In case you haven't noticed, I wasn't overly fond of my {dRelation}.  Forget it.\"",
      },
      '{customer}"You just said ${rawPrice} right? I hope you\'re kidding."',
      '{customer}"I\'ve got the dough, but I would rather spend it on something that matters."',
    ],
    upgradeAccept: [
      '{customer}"Alright, I\'ll take it."',
      '{customer}"Ok."',
      '{customer}"Maybe you\'re right.  Ok."',
    ],
    upgradeAcceptAngry: '{customer}"Fine, whatever, ok?"',
    upgradeOverLimit: '{customer}"That would put me over my limit.. how about something cheaper?"',
    upgradeNothingLeft:
      "`yThis {cMan} has already bought everything big you can think of.  It's a great feeling.",
    upgradeFirstLast: "Gold Casket",
    guiltPitch: [
      '`w{player}: `$"The funeral is not occasion for a display of cheapness, {cSir}."\n\n',
      '`w{player}: `$"{cSirCap},  let me ask you one simple thing.  Did you hate {dHim}?  Why else wouldn\'t you make this funeral something to be proud of?"\n\n',
      '`w{player}: `$"Some believe an expensive funeral absolves the purchaser from any sin.  I happen to believe this, my friend."\n\n',
      "`w{player}: `$\"I would stay away from cremation.  Your loved one deserves better than 'bake and shake' - people would talk.\"\n\n",
      "`w{player}: `$\"Resistance to a 'proper' funeral will send the wrong message, wouldn't you agree?\"\n\n",
    ],
    guiltLoved: [
      '{customer}"I LOVED {dHim}! Don\'t you get it? None of that stuff matters to me!"',
      '{customer}"My {dRelation} was {dSmashed} a {dFridge} for god-sake! How can you say something like that?"',
      '{customer}"If you want to keep my business you\'re going to stop saying stuff like that."',
    ],
    guiltNotLoved: [
      '{customer}"You\'re right. I should be a little looser with my money."',
      '{customer}"Good call.  I guess it would be appropriate to spend more on my {dRelation}."',
      "{customer}\"You've got a point there.. It makes me mad but you're right.\"",
      '{customer}"I agree in principle.. but I only want to spend ${limit} on this."',
    ],
    sympathyPitch: [
      '`w{player}: `$"{cSirCap}, I understand you\'ve been through a lot, please tell me what happened."\n\n',
      '`w{player}: `$"I know how you feel.  I know someone who lost a {dRelation} once."\n\n',
      '`w{player}: `$"So you two were close?  {dHeCap} sounds very special."\n\n',
      '`w{player}: `$"I\'m not a licensed therapist.. but keep talking, get the pain out."\n\n',
      '`w{player}: `$"Any time a {dFridge} is involved in an accident it\'s going to be traumatic."\n\n',
    ],
    sympathyNotLoved: [
      '{customer}"Sorry, I don\'t read ya, pard."',
      "{customer}\"I don't go for all this touchy feeling crap, ok?  Don't hug me.\"",
      '{customer}"Um yeah.. except I actually have another {dRelation}, so it ain\'t so bad.  No more wasting my time, ok?"',
    ],
    sympathyLoved: [
      '{customer}"It\'s just.. I feel like {dHe} is just in another room, you know?"',
      '{customer}"I still have dreams.. of {dHim} getting {dSmashed} a {dFridge} over and over."',
      '{customer}"I mean, usually someone\'s {dRelation} is close.. but we were REALLY close if you know what I mean."',
      '{customer}"I appreciate what you\'re trying to do but I need to get this over with..for ${limit} or less.."',
    ],
    interrupted: "`$You are interrupted!\n\n",
    leavePissed: [
      '{customer}"You know what? I really don\'t like the way you work. Bye."\n',
      '{customer}"Enough is enough.  I\'m sick of you."\n',
      '{customer}"I just realized that you disgust me.  Sayoonara."\n',
      '{customer}"Can we cut the crap for a second here?  I guess not, bye."\n',
    ],
    pissedOverLimit: [
      '{customer}"That would put me over my limit.. I don\'t have time for this, bye."\n',
      '{customer}"Damn, you see, I can only spend ${limit}.  I\'m leaving."\n',
      '{customer}"My visa only goes to ${limit}... I\'ll try next-door."\n',
    ],
    walkoutTv: '"A {income} {young} {man} just left {parlor} looking pissed," a reporter says.',
    rivalWatch:
      "\n`$You watch {cHim} through the window after {cHe} leaves.  You see {cHim} go into {rivalParlor} to see {rivalName}!",
    rivalMail:
      '\n`${cAYoung} {cMan} walks in with a dead body. "Hello {rivalSir}, I would like you to know I got treated like crap by {name} of {parlor}. I know you\'ll do a better job!"\n\nYou earn `w{points}`$ Bury Points for stealing this sale!\n',
    done: {
      perfect:
        "`wEXCELLENT! `$For making this funeral cost the max {cHe} could pay you receive a `w{bonus}`$ BP bonus!\n\n",
      great:
        "`wGREAT! `$For getting within {range} of this customers limit you receive a `w{bonus}`$ BP bonus!\n\n",
      nice: "`wNICE! `$For getting within {range} of this customers limit you receive a `w{bonus}`$ BP bonus!\n\n",
      success:
        "`w`$The service is a success!  Total bill is ${price}.\n\n{extra}You earn `w{bp}`$ Bury Points and a {casket} sales tag.",
      bigSaleTv: '"It appears {name} just made a {bp} BP sale," a guy reports.',
      faintedTv: '"{name} has fainted in {his} parlor.  Working too hard maybe?" a guy reports.',
      faintedMail:
        "\n`wYou fainted while dealing with a customer.`$\n\nYou vaguely remember riding in an ambulance.\n\n`$When you get home you find `w{bp} `$Bury Points and a {casket} tag on the desk!",
    },
  },
  news: {
    nothingToday: "Nothing has happened today.",
    topToday: "{name} from {parlor} with {bp} Bury Points.",
    noTopToday: "Sadly, no one has managed to sell anything yet today.",
    topYesterday: "{name} from {parlor} with {bp} Bury Points.\n\n",
    noTopYesterday: "No one died yesterday.",
    universeTop: "Top seller of the universe is {name}.",
    finalDay:
      "`5Today is the final day of the tournament - a winner will be declared at midnight!\n\n",
    lastDayTomorrow: "`5Tomorrow is the last day of the tournament.\n\n",
    daysLeft: "`5Only {days} days left before a tournament winner shall be declared!\n\n",
    perfectSale: "`7{name} makes a perfect sale, the industry is in awe.\r\n\r\n",
    winnerHeadline: "`7TOURNAMENT WINNER HAS BEEN DECLARED!\r\n",
    winnerBody:
      "`^With {bp} Bury Points and {plots} plots, {name} has been declared the victor.\r\n\r\n",
    meteorHeadline: "`7GIANT METEOR TO DESTROY THE WORLD AT MIDNIGHT!\r\n",
    meteorBody:
      '`^"This is a real bummer, but at least we have time to read our mail and stuff.  But who will bury us?," comments a local astronomer.\r\n\r\n',
    deed: "{name} won the 'Best Funeral Directory In The Universe' award.",
  },
  maintenance: {
    topSeller:
      "`wCongratulations!\n`$You were the top seller for yesterday.  You earn `w{luck}`$ luck and `w{bp}`$ Bury Points.\n",
    topParlor:
      "`wCongratulations!\n`$You ran the top parlor in town yesterday.  You earn `w{luck}`$ luck and `w{bp}`$ Bury Points.\n",
    secondParlor:
      "`wCongratulations!\n`$You were the second highest parlor in town yesterday. You earn `w{luck}`$ luck and `w{bp}`$ Bury Points.\n",
    thirdParlor:
      "`wCongratulations!\n`$You were the third highest parlor in town yesterday. You earn `w{luck}`$ luck and `w{bp}`$ Bury Points.\n",
    closesShop: "{name} closes shop and leaves town.",
    closesShopNoSale: "{name} closes shop and leaves town without a single sale.",
  },
  stats: {
    title: "Stats",
    labels: {
      turns: "Turns left",
      bpTotal: "Total Bury Points",
      money: "Money",
      wood: "Wood tags",
      silver: "Silver tags",
      gold: "Gold tags",
      plots: "Plots",
      bpToday: "Bury Points today",
      psych: "Psychology",
      rating: "Rating",
      yangs: "Yang's deliveries left",
      visits: "Visits left",
      hpMax: "Max hit points",
      strength: "Strength",
      lockpicks: "Lockpicks",
      ride: "Ride",
    },
    psychLevel: "Level {level}",
    rating: "#{rank} - {title}",
    noRatingText: "(No text for this rating.  Email Seth some ideas!)",
  },
  rankings: {
    title: "Rankings",
    protected: "Protected",
    inCafe: "in cafe",
    onNow: "on now",
    logon: "logon",
  },
  map: { title: "Town Map" },
  stub: {
    notBuilt: "`${place} is not built yet.  Check back after the next town meeting.",
    leaveLabel: "Leave",
  },
  hearseNames: ["Bicycle", "Budget Hearse", "Medalist", "Statesman", "Crown Sovereign"],
  hearseDescriptions: [
    "(you start with this, you can trade it in for 2)",
    "The ever humble Budget Hearse can fulfill all your transportation needs.  Children may laugh and point somewhat, but it sure beats a bike.",
    "The new Medalist very simply is the greatest value available today in the funeral profession. Flowing body lines and a graceful roof make this coach a winner.",
    "The paradigm of contemporary elegance and styling, the Statesman funeral coach gracefully integrates form and function with dramatic design.",
    "Beautifully proportioned, this new funeral coach reflects the prestige and styling of lasting beauty, an investment in your business future that is as distinguished and distinctive as the service you provide.",
  ],
  places: {
    bank: {
      location: "Bank",
      note: "You are at the city bank.  This facility allows you to exchange casket sales tags and transfer them to other accounts.",
      greeting: '`wTeller: `$"How\'s business, {player}?"',
      which: '`wTeller: `$"Which kind tag would you like to exchange?"',
      convertTo: '`wTeller: `$"What would you like to convert your {from} to?"',
      ratio:
        '`wTeller: `$"{fromCount} {from} tag(s) = {toCount} {to} tag(s).  How many {from} tags would you like to exchange?"',
      amusing: '`wTeller: `$"You are very amusing {sir}."',
      notEnough:
        "`wTeller: `$\"You can't exchange what you don't have.  I'm trying to be nice here, but please, think next time.\"",
      tooFew:
        "`wTeller: `$\"You don't understand, do you. You can't trade just {count} for a {to} tag, alright?\"",
      done: '`wTeller: `$"Very good, I have converted {lost} {from} tag(s) to {gained} {to} tag(s). Any other tags you would like to convert?"',
      allToWood: "`wA teller converts all your tags to Wood for you.",
      allToGold: "`wA teller converts all your tags to Gold for you.",
      buttons: {
        allToWood: "All to wood",
        allToGold: "All to gold",
        exchange: "Exchange",
        leave: "Leave",
        gold: "Gold",
        silver: "Silver",
        wood: "Wood",
        back: "Back",
        continue: "Continue",
      },
    },
    store: {
      location: "Store",
      note: "Di-Mart is not only an official DuraRest (tm) reseller but also carries many other useful supplies for the death care industry.\n\nA really creepy looking guy in a suit smiles at you.",
      greeting: '`wElijah: `$"What can I get for you today, {player}?"',
      hearseIntro: '`wElijah: `$"We carry nothing but the best in funeral transportation."\n\n',
      hearseLine: "`w{n}`$ - {name} - Cost: `w{price}`$ gold tags.\n",
      look: "`wThe {name}`$ - {description}\n\nEffect: `w{bonus}`$ extra turns per day.\n\n{trade}",
      lookTrade:
        "After trading in your {current} for `w{credit}`$ gold tags, the cost will be `w{cost}`$ gold tags.",
      lookNoUpgrade:
        "You already drive a {current}.  The {name} would be no improvement, and Di-Mart does not pay gold for a downgrade.",
      cannotAfford:
        "`wElijah: `$\"I'm sorry, I really don't have time to waste.  You obviously cannot afford a luxury sedan such as the {name}.\"",
      noUpgrade:
        '`wElijah: `$"You already drive a {current}.  I can\'t sell you a {name} on top of that, friend."',
      bought:
        "You trade in your {old} for a brand new {new}!\n\nYou have time for an extra `w{bonus}`$ customers today.",
      buttons: {
        security: "Security",
        supplies: "Supplies",
        hearses: "Hearses",
        leave: "Leave",
        view: "View #{n}",
        buyIt: "Buy it",
        back: "Back",
      },
    },
    university: {
      location: "Spirit U",
      note: "The role of the funeral director is constantly changing, encompassing more and more responsibilities each year. (for a fee, of course)",
      status: "Taking classes at SU is a great way to expand your options.",
      schedule:
        "`wClass schedules\n\n`$PSY - Social Psychology (cost: `w{psych}`$ gold tags)\n`$PE - Physical Education (cost: `w{hp}`$ gold tags)\n`$ST - Strength Training (cost: `w{strength}`$ gold tags)",
      cantAfford:
        "You fumble through your pockets in vain - you don't have enough gold tags to pay for the class.",
      psychDone:
        "You study hard for about an hour.  Your psychology level is raised to `w{level}`$!{extra}",
      psychSkills: [
        "\n\n`$You have learned a new skill: `wMood reading",
        "\n\n`$You have learned a new skill: `wFinancial Estimation",
        "\n\n`$You have learned a new skill: `wCutting resistance in half",
        "\n\n`$You have learned a new skill: `wCutting mood in half",
        "\n\n`$You have learned a new skill: `wDoubling spending limit",
      ],
      hpDone: "You run laps around the gym.  You gain `w{hp}`$ hitpoints!",
      strengthDone: "You lift weights for a while.  You gain `w1`$ strength!",
      library:
        "You are in the library.\n\n`$Students are quietly studying here.  You see one nerdy looking kid hogging the lone library computer.\n\n`$The book of deeds is sitting on a pedestal close by.",
      paperPrompt:
        "Which old newspaper would you like to look at?  You can choose between 1 and {max}.",
      paperMissing: "You desperately hunt around for anything dealing with a day {day} but fail.",
      paperFound:
        "You find a yellowing paper from day {day}, it looks like it may have been peed on.`$\n\n",
      deedsTitle: "The Book Of Deeds`$\n\n",
      deedsNone:
        "No one in Deathville has ever done anything worthing noting.\n\nIt's sad, really.\n",
      deedsHope: "\nThere is a glimmer of hope in `w{name}`$, but {he} has a way to go.",
      buttons: {
        takePsy: "Take PSY",
        takePe: "Take PE",
        takeSt: "Take ST",
        library: "Library",
        leave: "Leave",
        continue: "Continue",
        back: "Back",
        oldPapers: "Old Papers",
        deeds: "View Deeds",
      },
    },
    yangs: {
      location: "Yang's",
      note: "What could be luckier than a box of delectable grilled teriyaki spread over hot rice? Your mouth waters at the very thought of it.",
      statusReady: "June waits for you to order.",
      statusKicked: "June glances at you nervously.",
      kicked:
        '`w{player}: `$"Hello? I\'d like some service here!"\n\n`wJune: `$"Just leave, asshole."',
      menu: "`wThe Menu\n\n`w#1`$ - Lucky Dragon (adds `w{dragonLuck} `$luck, for here only) Cost: `w{dragonCost}`$ Bury Points\n`w#2`$ - Lucky Sparrow (adds `w{sparrowLuck} `$luck, for delivery only) Cost: `w{sparrowCost}`$ Bury Points\n`w#3`$ - Cursed Tiger (removes `w{tigerLuck}`$ luck, for delivery only) Cost: `w{tigerCost}`$ Bury Points\n",
      dragonLater:
        "`$Maybe later.  You especially like to eat Yang's when you're feeling down on your luck. (like less than {limit} percent for instance)",
      dragonBroke: "`$You check your wallet.. shoot, not enough Bury Points!",
      dragonDone:
        "`$You relish every bite of your General Tso's Chicken.\n\nYou gain `w{luck}`$ luck.",
      tigerOut:
        '`w{player}: `$"I would like a cursed tiger delivered, please."\n\n`wJune: `$"I\'m sorry, my dad is out delivering food right now.  How about something for here?"',
      sparrowOut:
        '`wYou: `$"I would like a lucky sparrow delivered, please."\n\n`wJune: `$"I\'m sorry, my dad is out delivering food right now.  How about something for here?"',
      tigerWho:
        '`wJune: `$"Ah.. someone you are not too fond of, I take it.  Who would this unlucky person be?" ',
      sparrowWho: "`wJune: `$\"That's very nice of you.  Who's the lucky person?\"",
      fortunePrompt: '`wJune: `$"If you would like to write a custom fortune, enter it now."',
      bitchy:
        '`w{player}: `$"That\'s very interesting.  Now get the god damn teriyaki, put it in a box, and deliver it."\n\n`wJune: `$"Please leave now."',
      selfTarget:
        '`w{player}: `$"If you could just deliver that to my parlor, that would be great, m\'kay?"\n\n`wJune: `$"Why don\'t you just get food for here?"\n\n`w{player}: `$"Ok, fine."\n\n',
      limit: '`$"We only allow {perDay} delivery per day," Mr Yang tells you apologetically. ',
      notHome: "`$Error delivering food, he wasn't home.",
      noPoints:
        "`$You don't have enough Bury Points.  You realize you would just look stupid trying to order now...",
      leaves: "`$Mr. Yang leaves to deliver the food.",
      tv: "A Yang's commercial comes on. It looks like {parlor} in the background.",
      news: [
        "`7SPOTLIGHT ON OUR TOWN\r\n`^Local mortician {name} is seen buying some Yang's for delivery.\r\n\r\n",
        "`7YANG'S NOW DELIVERS\r\n`^\"Yes, delivery is very popular.  You see this package from {name}? I'm going deliver it all the way to {parlor}, no extra charge!\" Mr Yang smiles.\r\n\r\n",
        '`7YANG\'S DOING WELL\r\n`^"Ah, yes.  Business is very good today! People like {name} buying so much delivery," Mr Yang comments.\r\n\r\n',
        "`7YANG'S MAKES A GREAT GIFT\r\n`^Looking for that special gift?  How about food? Today {name} was seen buying some, seems popular.\r\n\r\n",
      ],
      tigerMail:
        '\n`$Some delicious smelling chinese food has been left on your doorstep.\nYour fortune cookie reads:\n`w"{fortune}"\n`$You lose `w{luck}`$ luck!\n',
      sparrowMail:
        '\n`${name} has sent you some chinese food.\nYour fortune cookie reads:\n`w"{fortune}"\n`$You gain `w{luck}`$ luck!\n',
      logTiger: "{name} sent Yang's to {target}, cookie: {fortune}",
      logSparrow: "{name} sent nice Yang's to {target}, cookie: {fortune}",
      buttons: {
        order1: "Order #1",
        order2: "Order #2",
        order3: "Order #3",
        leave: "Leave",
        continue: "Continue",
        getBitchy: "Get Bitchy",
      },
    },
    hospital: {
      location: "Hospital",
      note: "You are at the city hospital.  A nurse smiles at you.",
      greeting: '`wNurse: `$"Hi {player}.  I don\'t recall you having a pick-up today."',
      roomNote: "You are lying on a bed, it doesn't look like your own.",
      roomText: "`$Your whole body aches.",
      wakeUp:
        '`wNurse: `$"I see you finally woke up, {prince}.  Hope you\'ll be more careful next time."',
      princeMale: "prince charming",
      princeFemale: "sleeping beauty",
      leave: "Leave",
    },
    options: {
      location: "Change Name",
      noChange:
        "`$This server doesn't allow name changes.  You're stuck with what your parents gave you.",
      note: "You stare at yourself in the mirror.\n\nMaybe it's time for a change.",
      ask: "`$Announcing your new name in the newspaper will cost `w{cost}`$ gold tag(s).  Do it?",
      prompt: "`wEnter your new name.",
      noGold: "`$You don't have enough gold tags.  Go exchange your woods or something.",
      same: "`$Yeah, {name}.. you like the sound of that... oh wait...",
      short: "`$What, are those initials?  Pick a longer name.",
      long: "`$Is that a name or a lecture?  Try something shorter.",
      taken:
        "`$Um, don't you think the real {name} would kind of be pissed?  Try something original.",
      news: "`5NAME CHANGE: {old} has changed {his} name to {new}.\r\n\r\n",
      done: "`$You will now be known as `w{name}`$.",
      buttons: { yes: "Yes", no: "No", continue: "Continue" },
    },
  },
  social: CLASSIC_SOCIAL_TEXT,
};
