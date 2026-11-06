import type { AgedPool, ExpandedContent, ExpandedTownContent, Reward } from "@fq/core";
import { z } from "zod";
import { pictureSchema } from "./pictures.js";

/**
 * The schema of `ContentPack.expanded` (packages/core/src/expanded/content/types.ts), field by field.
 *
 * Two modes:
 * - `loose` (what packs are validated with): every known field is checked, and fields this schema
 *   does not know yet are let through. Other agents add Expanded content types (locations, story
 *   arcs, weather, ...) while packs are written; a pack that already carries them must still load.
 * - `strict`: unknown fields are errors. The built-in packs are checked this way in the tests, so a
 *   typo in a field name of a built-in pack is caught.
 */
export type SchemaMode = "loose" | "strict";

/** `NewsCondition` (packages/core/src/content/newsCondition.ts): when a story or blurb may run. */
export const newsConditionSchema = z.strictObject({
  arcs: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        endings: z.array(z.string().min(1)).exactOptional(),
      }),
    )
    .exactOptional(),
  notArcs: z.array(z.string().min(1)).exactOptional(),
  mayor: z.boolean().exactOptional(),
});

/** Every `AgedPool` (packages/core/src/expanded/content/types.ts); the checks below keep the two equal. */
const AGED_POOLS = [
  "request",
  "petRequest",
  "repeat.happy",
  "repeat.ok",
  "repeat.sour",
  "repeat.walked",
  "impatient",
  "softPitch",
  "hardPitchWood",
  "hardPitchSilver",
  "guiltPitch",
  "sympathyPitch",
  "coffeePitch",
  "coffeeAccept.loved",
  "coffeeAccept.notLoved",
  "coffeeRefuse",
  "listenPitch",
  "listenLoved",
  "listenNotLoved",
  "discountPitch",
  "discountAccept",
  "discountHaggle",
  "packagePitch",
  "packageAccept",
  "packageRefuse",
] as const satisfies readonly AgedPool[];
/** A type error here names a pool core has and `AGED_POOLS` lacks. */
const agedPoolsComplete: [Exclude<AgedPool, (typeof AGED_POOLS)[number]>] extends [never]
  ? true
  : { error: "AGED_POOLS lacks"; pools: Exclude<AgedPool, (typeof AGED_POOLS)[number]> } = true;
void agedPoolsComplete;

const text = z.string();
const lines = (what = "line") =>
  z.array(z.string()).min(1, { error: `must have at least one ${what}` });
const words = z.array(z.string());

export function buildExpandedSchema(mode: SchemaMode) {
  const obj = <S extends z.core.$ZodLooseShape>(shape: S) =>
    mode === "strict" ? z.strictObject(shape) : z.looseObject(shape);
  const num = z.number();

  const effects = obj({
    cheapness: num.exactOptional(),
    mood: num.exactOptional(),
    moodMult: num.exactOptional(),
    patience: num.exactOptional(),
    limitMult: num.exactOptional(),
    loved: z.boolean().exactOptional(),
    guilt: num.exactOptional(),
    sympathy: num.exactOptional(),
    coffee: num.exactOptional(),
    discount: num.exactOptional(),
    listen: num.exactOptional(),
    hardSell: num.exactOptional(),
    affinity: z.record(z.string(), num).exactOptional(),
    estimate: num.exactOptional(),
  });

  const reward = obj({
    bp: num.exactOptional(),
    money: num.exactOptional(),
    karma: num.exactOptional(),
    rating: num.exactOptional(),
    luck: num.exactOptional(),
    reviews: num.exactOptional(),
    gold: num.exactOptional(),
    protection: z.boolean().exactOptional(),
  });

  // AgeLimits (13.5): whole years, inclusive, each optional.
  const age = z.number().int().min(0).max(120).exactOptional();
  const ageLimits = {
    minCustomerAge: age,
    maxCustomerAge: age,
    minDeceasedAge: age,
    maxDeceasedAge: age,
  };

  const trait = obj({
    ...ageLimits,
    id: z.string().min(1),
    label: z.string().min(1),
    hint: z.string().min(1),
    lines: words,
    effects,
    excludes: z.array(z.string()).exactOptional(),
    weight: num.positive().exactOptional(),
  });

  const offerChoice = obj({ label: text, text, effects: reward });

  const special = obj({
    id: z.string().min(1),
    label: z.string().min(1),
    weight: num.positive(),
    minDay: z.number().int().exactOptional(),
    person: obj({ first: text, surname: text, male: z.boolean() }).exactOptional(),
    portrait: pictureSchema.exactOptional(),
    intro: text,
    incomeAtLeast: z.number().int().min(0).max(3).exactOptional(),
    traits: z.array(z.string()).exactOptional(),
    effects: effects.exactOptional(),
    noWalkout: z.boolean().exactOptional(),
    casketPriceMult: num.positive().exactOptional(),
    pet: z.array(z.string()).exactOptional(),
    selfFuneral: z.boolean().exactOptional(),
    tvAlways: z.boolean().exactOptional(),
    onHappy: reward.exactOptional(),
    onDone: reward.exactOptional(),
    onWalkout: reward.exactOptional(),
    future: obj({
      minDays: z.number().int().positive(),
      maxDays: z.number().int().positive(),
      bpShare: num.positive(),
      text,
    }).exactOptional(),
    offer: obj({ accept: offerChoice, decline: offerChoice }).exactOptional(),
    lines: obj({
      happy: text.exactOptional(),
      walkout: text.exactOptional(),
      threat: text.exactOptional(),
      done: text.exactOptional(),
    }).exactOptional(),
  });

  const track = z.enum(["burial", "cremation"]);
  const saleItem = obj({
    article: text,
    name: z.string().min(1),
    price: z.number().int().positive(),
    tags: z.array(z.string()),
    track: track.exactOptional(),
  });

  const tier = obj({
    article: text,
    name: z.string().min(1),
    price: z.number().int().nonnegative(),
    tags: z.array(z.string()),
    requires: z.string().exactOptional(),
    plotIncome: z.number().int().nonnegative().exactOptional(),
  });

  const category = obj({
    id: z.string().min(1),
    label: z.string().min(1),
    track: z.enum(["burial", "cremation", "any"]),
    noPet: z.boolean().exactOptional(),
    tiers: z.array(tier).min(2, { error: "needs the free tier and at least one more" }),
    pitch: lines("pitch"),
  });

  const cremation = obj({
    name: z.string().min(1),
    fee: z.number().int().positive(),
    tags: z.array(z.string()),
    pitch: lines("pitch"),
    accept: lines(),
    refuse: lines(),
  });

  const prepOption = obj({
    label: z.string().min(1),
    text,
    effects: reward,
    risk: obj({ weight: num.min(0).max(1), failText: text, failEffects: reward }).exactOptional(),
    evil: z.boolean().exactOptional(),
    perk: z.string().exactOptional(),
  });

  const prep = obj({
    id: z.string().min(1),
    text,
    picture: pictureSchema.exactOptional(),
    track: track.exactOptional(),
    karmaBelow: num.exactOptional(),
    karmaAbove: num.exactOptional(),
    weight: num.positive().exactOptional(),
    options: z.array(prepOption).min(2, { error: "needs at least two options" }),
  });

  const lovedPair = obj({ loved: lines(), notLoved: lines() });

  const negotiation = obj({
    request: lines(),
    petRequest: lines(),
    selfRequest: lines(),
    repeat: obj({ happy: lines(), ok: lines(), sour: lines(), walked: lines() }),
    estimate: text,
    resistance: text,
    psychTell: text,
    nothingExtra: text,
    bonusRule: text,
    total: text,
    buttons: obj({
      coffee: text,
      listen: text,
      discount: text,
      packages: text,
      back: text,
      cremation: text,
      bless: text,
      raise: text,
    }),
    hints: obj({
      coffeeUsed: text,
      nothingToLearn: text,
      discountMax: text,
      discountTooSmall: text,
      hardMaxed: text,
      cremationTrack: text,
      noPackages: text,
      blessUsed: text,
      raiseUsed: text,
      handEmpty: text,
      needsUpgrade: text,
    }),
    handIntro: text,
    packagesIntro: text,
    softPitch: words,
    hardPitchWood: words,
    hardPitchSilver: words,
    guiltPitch: words,
    sympathyPitch: words,
    coffeePitch: lines(),
    coffeeAccept: lovedPair,
    coffeeRefuse: lines(),
    listenPitch: lines(),
    listenTrait: text,
    listenNothing: lines(),
    listenLoved: lines(),
    listenNotLoved: lines(),
    discountPitch: lines(),
    discountAccept: lines(),
    discountHaggle: lines(),
    packagePitch: words,
    packageAccept: words,
    packageRefuse: words,
    packageOverLimit: text,
    impatient: lines(),
    blessPitch: text,
    blessResult: obj({ loved: text, notLoved: text }),
    raisePitch: text,
    raiseResult: text,
    threat: text,
    agedLines: z
      .array(
        obj({
          ...ageLimits,
          pool: z.enum(AGED_POOLS),
          text: z.string().min(1),
        }),
      )
      .exactOptional(),
  });

  const textSection = obj({
    hints: obj({
      notEnoughCash: text,
      storeroomFull: text,
      nothingToFill: text,
      dugEnough: text,
      noTurns: text,
      current: text,
      needsMoney: text,
      costsTurns: text,
    }),
    negotiation,
    done: obj({
      success: text,
      perfect: text,
      great: text,
      nice: text,
      missed: text,
      underdog: text,
      insurance: text,
      money: text,
      fromStock: text,
      rushOrder: text,
      happy: text,
      sour: text,
      specialTv: text,
      prepButton: text,
      fainted: text,
      future: text,
      cremated: text,
    }),
    desk: obj({
      menuParlor: text,
      accidents: text,
      banked: text,
      hearsePaid: text,
      hearseUnpaid: text,
      plotIncome: text,
      futurePaid: text,
      digFound: text,
      digCaught: text,
      digTag: text,
    }),
    office: obj({
      title: text,
      summary: text,
      buttons: obj({
        upgrades: text,
        markup: text,
        rivalry: text,
        dig: text,
        back: text,
        buy: text,
      }),
      upgradesIntro: text,
      upgradeLine: text,
      bought: text,
      cantAfford: text,
      needs: text,
      owned: text,
      markupIntro: text,
      markupSet: text,
      rivalryIntro: text,
      rivalryNames: obj({ peaceful: text, standard: text, cutthroat: text }),
      rivalryHints: obj({ peaceful: text, standard: text, cutthroat: text }),
      rivalrySet: text,
      rivalryWait: text,
      levelNames: lines("level name"),
      noPerks: text,
    }),
    store: obj({
      caskets: text,
      casketIntro: text,
      buyLabel: text,
      restock: text,
      bought: text,
      restocked: text,
      full: text,
      cantAfford: text,
      shadyDiscount: text,
    }),
    university: obj({ capped: text, hpCapped: text, strengthCapped: text }),
    visit: obj({
      selfPeaceful: text,
      targetPeaceful: text,
      turnedAway: text,
      turnedAwayMail: text,
      cashStolen: text,
      cashStolenMail: text,
    }),
    prep: obj({ header: text, continue: text, riskFailed: text }),
    stats: obj({
      labels: obj({
        money: text,
        karma: text,
        rating: text,
        parlor: text,
        stock: text,
        markup: text,
        rivalry: text,
        banked: text,
        plotIncome: text,
        perks: text,
        sales: text,
      }),
    }),
    tutorial: obj({
      speaker: text,
      pages: lines("page"),
      next: text,
      skip: text,
      start: text,
      hints: obj({
        arrival: text,
        hand: text,
        packages: text,
        afterPitch: text,
        impatient: text,
        done: text,
      }),
      finish: text,
    }),
    perks: z.record(z.string(), obj({ name: text, description: text })),
    arson: obj({ offer: text, peaceful: text, burned: text, burnedMail: text }),
  });

  const town = buildTownSchema(mode, reward);

  return obj({
    names: obj({
      male: lines("name"),
      female: lines("name"),
      surnames: lines("name"),
      pets: lines("name"),
    }),
    traits: z.array(trait).min(3, { error: "needs at least 3 traits" }),
    backstories: lines("backstory"),
    backstoryBits: obj({ jobs: lines("job"), hobbies: lines("hobby"), places: lines("place") }),
    tells: obj({
      loved: lines("tell"),
      notLoved: lines("tell"),
      cheapLow: lines("tell"),
      cheapMid: lines("tell"),
      cheapHigh: lines("tell"),
      limitHigh: lines("tell"),
      limitLow: lines("tell"),
    }),
    specials: z.array(special),
    softSell: z.array(saleItem).min(1),
    packages: z.array(category),
    cremation,
    prep: z.array(prep),
    upgrades: z.record(z.string(), obj({ name: z.string().min(1), description: text })),
    text: textSection,
    town: town.exactOptional(),
  });
}

/**
 * `ExpandedContent.town` (packages/core/src/expanded/content/townTypes.ts, docs/expanded-rules.md
 * section 25), field by field. Mechanical ranges and placeholders are the lint's job (lint.ts); this
 * checks shapes, so a pack with a typo in a field name fails in strict mode.
 */
function buildTownSchema(mode: SchemaMode, reward: z.ZodType<Reward>) {
  const obj = <S extends z.core.$ZodLooseShape>(shape: S) =>
    mode === "strict" ? z.strictObject(shape) : z.looseObject(shape);
  const num = z.number();
  const int = z.number().int();
  const id = z.string().min(1);

  const modifier = obj({ key: id, op: z.enum(["add", "mul"]), value: num });
  const modifiers = z.array(modifier);

  const injury = obj({
    id,
    name: id,
    text,
    days: int.positive(),
    hp: int.nonnegative(),
    patience: int.nonnegative().exactOptional(),
    turns: int.nonnegative().exactOptional(),
    treatPrice: int.nonnegative(),
    causes: z
      .array(z.enum(["duel", "fight", "rob", "roulette", "hit"]))
      .min(1)
      .exactOptional(),
  });

  const news = obj({
    id,
    title: id,
    message: id,
    effect: id,
    weight: num.positive().exactOptional(),
    minDay: int.nonnegative().exactOptional(),
    days: int.positive().exactOptional(),
    modifiers,
    when: newsConditionSchema.exactOptional(),
  });

  const weather = obj({
    id,
    label: id,
    morning: lines("morning line"),
    effect: id,
    weight: num.positive().exactOptional(),
    modifiers,
  });

  const ordinance = obj({ id, title: id, text: id, effect: id, modifiers });

  const marketItem = obj({
    id,
    name: id,
    text: id,
    price: int.positive(),
    reward,
    grant: z
      .enum(["armor", "lead", "gold-casket", "bodyguard", "permit", "holy-water"])
      .exactOptional(),
    weight: num.positive().exactOptional(),
  });

  const side = z.enum(["good", "evil"]);
  const appeal = obj({
    place: z.enum(["church", "reaper-club", "city-hall"]),
    side,
    label: id,
    thanks: id,
    amount: int.positive(),
    karma: num.exactOptional(),
  });
  const test = z.discriminatedUnion("kind", [
    obj({ kind: z.literal("sideLeads"), side }),
    obj({ kind: z.literal("walkouts"), perPlayer: num.nonnegative() }),
    obj({ kind: z.literal("sales"), perPlayer: num.nonnegative() }),
    obj({ kind: z.literal("hasMayor") }),
    obj({ kind: z.literal("mayorKarma"), atLeast: num }),
  ]);
  const beat = obj({
    id,
    headline: id,
    story: id,
    modifiers: modifiers.exactOptional(),
    days: int.positive().exactOptional(),
    rewards: z
      .array(obj({ to: z.enum(["all", "good", "evil", "mayor", "top"]), reward }))
      .exactOptional(),
    appeals: z.array(appeal).exactOptional(),
    after: int.positive().exactOptional(),
    next: z.union([id, obj({ test, ifTrue: id, ifFalse: id })]).exactOptional(),
    ending: id.exactOptional(),
  });
  const arc = obj({
    id,
    title: id,
    earliest: int.positive(),
    latest: int.positive(),
    weight: num.positive().exactOptional(),
    start: id,
    beats: z.array(beat).min(1, { error: "an arc needs beats" }),
  });

  const place = obj({ fg: pictureSchema.exactOptional(), bg: pictureSchema });
  const pictures = obj({
    graveyard: place,
    church: place,
    bingo: place,
    cityHall: place,
    cityHallOutside: place.exactOptional(),
    inspection: place.exactOptional(),
    hospital: place,
    hospitalDesk: place.exactOptional(),
    club: place,
    clubDoor: place.exactOptional(),
    clubTables: place.exactOptional(),
    blackMarket: place.exactOptional(),
    bank: place,
    vault: place.exactOptional(),
    duel: place,
  });

  const hints = obj({
    noTurns: text,
    notEnoughCash: text,
    notEnoughTags: text,
    doneToday: text,
    karmaTooHigh: text,
    karmaTooLow: text,
    noRivals: text,
    soldOut: text,
    limitReached: text,
    costsTurns: text,
    needsPermit: text,
    closedToday: text,
    alreadyHave: text,
    notNow: text,
    yourVote: text.exactOptional(),
  });

  const graveyard = obj({
    title: text,
    note: text,
    intro: text,
    noMonument: text,
    buttons: obj({
      monuments: text,
      tend: text,
      rob: text,
      duel: text,
      look: text,
      leave: text,
      back: text,
      swing: text,
      shove: text,
      yield: text,
      continue: text,
    }),
    monumentsIntro: text,
    monumentLine: text,
    monumentBought: text,
    allBuilt: text,
    tended: lines(),
    tendedLead: text,
    tendedAssociate: text,
    robFound: lines(),
    robSilver: text,
    robCaught: text,
    look: lines(),
    lookRows: text,
    duel: obj({
      prompt: text,
      youFirst: text,
      theyFirst: text,
      youHit: text,
      youMiss: text,
      theyHit: text,
      theyMiss: text,
      shoveIn: text,
      shoveFail: text,
      theyShove: text,
      theyShoveFail: text,
      shoveDetail: text,
      won: text,
      lost: text,
      yielded: text,
      wonMail: text,
      lostMail: text,
      yieldMail: text,
      crime: text,
      selfPeaceful: text,
      targetPeaceful: text,
      chainMate: text,
      rivalTired: text,
      sheltered: text,
      self: text,
      nobody: text,
    }),
  });

  const church = obj({
    title: text,
    note: text,
    greeting: lines(),
    buttons: obj({
      bingo: text,
      confess: text,
      holyWater: text,
      service: text,
      tithe: text,
      leave: text,
      back: text,
      buyOne: text,
      buyThree: text,
    }),
    bingoIntro: text,
    bingoBought: text,
    bingoFree: text,
    bingoWinMail: text,
    bingoNews: text,
    bingoCarryNews: text,
    confessed: lines(),
    confessCapped: text,
    holyWaterBought: text,
    served: text,
    tithed: lines(),
  });

  const cityHall = obj({
    title: text,
    note: text,
    greeting: text,
    buttons: obj({
      permits: text,
      inspection: text,
      ordinance: text,
      election: text,
      chains: text,
      leave: text,
      back: text,
      certify: text,
      bribe: text,
      lobby: text,
      file: text,
      ads: text,
    }),
    permitsIntro: text,
    permitLine: text,
    permitBought: text,
    inspectionIntro: text,
    certifiedUntil: text,
    certified: text,
    bribed: text,
    inspectPassMail: text,
    inspectFailMail: text,
    inspectFailNews: text,
    ordinanceIntro: text,
    noOrdinance: text,
    currentOrdinance: text,
    noBallot: text,
    voted: text,
    lobbied: text,
    ordinanceNews: text,
    noVotesNews: text,
    electionFiling: text,
    electionVoting: text,
    electionDone: text,
    noCandidates: text,
    filed: text,
    electionVoted: text,
    adsBought: text,
    electedNews: text,
    electedMail: text,
    noElectionNews: text,
    mayorMorning: text,
    votesDetail: text,
  });

  const chains = obj({
    title: text,
    intro: text,
    line: text,
    none: text,
    yours: text,
    buttons: obj({ found: text, invite: text, join: text, leave: text, back: text }),
    namePrompt: text,
    invitePrompt: text,
    founded: text,
    invited: text,
    inviteMail: text,
    joined: text,
    joinedMail: text,
    left: text,
    full: text,
    cooldown: text,
    badName: text,
    duesUnpaid: text,
    noFriendlyFire: text,
    removedName: text.exactOptional(),
  });

  const hospital = obj({
    title: text,
    note: text,
    greeting: text,
    injuryLine: text,
    noInjuries: text,
    buttons: obj({ treat: text, lead: text, leave: text }),
    treated: text,
    leadIntro: text,
    leadBought: lines(),
    leadMax: text,
    stillHurt: text,
    hurtTurns: text,
    newInjury: text,
    armorSaved: text,
    leadArrives: text,
  });

  const club = obj({
    title: text,
    note: text,
    door: text,
    necroFree: text,
    inside: lines(),
    buttons: obj({
      pay: text,
      games: text,
      market: text,
      hit: text,
      bodyguard: text,
      seance: text,
      draw: text,
      slots: text,
      shots: text,
      leave: text,
      back: text,
    }),
    gamesIntro: text,
    stakeLabel: text,
    drawWin: text,
    drawLose: text,
    drawTie: text,
    cards: lines("card name"),
    slotsSpin: text,
    slotsWin: text,
    slotsLose: text,
    symbols: z.record(z.string(), text),
    shotsIntro: text,
    shotsWin: text,
    shotsLose: text,
    marketIntro: text,
    marketLine: text,
    marketBought: text,
    hitPrompt: text,
    hitBooked: text,
    hitSelf: text,
    hitPeaceful: text,
    hitTaken: text,
    hitChain: text,
    hitNews: text,
    hitMail: text,
    hitFoiledMail: text,
    hitFoiledHirer: text,
    hitSnitchMail: text,
    hitSnitchNews: text,
    hitRumour: text,
    bodyguardBought: text,
    seanceWin: text,
    seanceFail: text,
  });

  const bank = obj({
    buttons: obj({
      savings: text,
      deposit: text,
      withdraw: text,
      loan: text,
      borrow: text,
      repay: text,
      transfer: text,
      back: text,
      wood: text,
      silver: text,
      gold: text,
    }),
    savingsIntro: text,
    depositPrompt: text,
    withdrawPrompt: text,
    deposited: text,
    withdrew: text,
    badAmount: text,
    noDepositWithLoan: text,
    loanIntro: text,
    loanOwed: text,
    borrowPrompt: text,
    borrowed: text,
    repaid: text,
    loanClosed: text,
    deadbeat: text,
    loanCollected: text,
    loanDefault: text,
    transferIntro: text,
    transferPick: text,
    transferTier: text,
    transferCount: text,
    transferred: text,
    transferMail: text,
    transferTooNew: text,
    transferLimit: text,
    transferTheirLimit: text,
    transferSelf: text,
    transferNotEnough: text,
  });

  const world = obj({
    morningWeather: text,
    morningNews: text,
    deskStatus: text,
    quietNews: text,
    morningArc: text,
  });

  const challenge = obj({ title: text, intro: text, finished: text, leave: text });

  return obj({
    injuries: z.array(injury),
    news: z.array(news),
    weather: z.array(weather).min(1, { error: "needs at least one weather" }),
    ordinances: z.array(ordinance),
    market: z.array(marketItem),
    arcs: z.array(arc),
    monuments: words,
    permits: z.record(z.string(), obj({ name: id, description: text })),
    cast: obj({ mayor: id, clubOwner: id, nurse: id, inspector: id, teller: id }),
    pictures,
    text: obj({
      hints,
      graveyard,
      church,
      cityHall,
      chains,
      hospital,
      club,
      bank,
      world,
      challenge,
    }),
  });
}

export const expandedSchema = buildExpandedSchema("loose");
export const strictExpandedSchema = buildExpandedSchema("strict");

/*
 * Compile-time agreement with the core types, both ways, so a change to
 * packages/core/src/expanded/content/types.ts that this schema does not follow fails `typecheck`:
 * - whatever the strict schema accepts is an `ExpandedContent`;
 * - every `ExpandedContent` is accepted by the strict schema's type (no field required here that
 *   core does not have).
 */
type Parsed = z.infer<typeof strictExpandedSchema>;
const parsedIsContent = (x: Parsed): ExpandedContent => x;
const contentIsParsed = (x: ExpandedContent): Parsed => x;
void parsedIsContent;
void contentIsParsed;

/** The town section's own check (townTypes.ts), both ways, so a mismatch names the town. */
type ParsedTown = NonNullable<Parsed["town"]>;
const parsedIsTown = (x: ParsedTown): ExpandedTownContent => x;
const townIsParsed = (x: ExpandedTownContent): ParsedTown => x;
void parsedIsTown;
void townIsParsed;

/*
 * Field-by-field agreement with the core types. The assignability checks above cannot see an
 * OPTIONAL field that core has and this schema lacks (an object without it is still assignable),
 * so strict mode would reject packs that use it with the vague "unknown field". These compare the
 * set of field paths on both sides and, when they differ, make `typecheck` fail with a type that
 * lists the paths ("[]" is an array element).
 *
 * When this fails: add the field to `buildExpandedSchema` / `buildTownSchema` above, mirroring its
 * optionality, and give the lint (lint.ts, townLint.ts) a look at whether text in it needs checks.
 */
type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type AllKeys<T> = T extends unknown ? keyof T : never;
type ValueAt<T, K> = T extends unknown ? (K extends keyof T ? T[K] : never) : never;
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;
/** Paths of fields that `A` has and `B` lacks, walking both types together. */
type MissingIn<A, B, P extends string> = [NonNullable<A>] extends [Primitive]
  ? never
  : [ElementOf<NonNullable<A>>] extends [never]
    ?
        | `${P}.${Exclude<AllKeys<NonNullable<A>>, AllKeys<NonNullable<B>>> & string}`
        | {
            [K in AllKeys<NonNullable<A>> & AllKeys<NonNullable<B>> & string]: MissingIn<
              ValueAt<NonNullable<A>, K>,
              ValueAt<NonNullable<B>, K>,
              `${P}.${K}`
            >;
          }[AllKeys<NonNullable<A>> & AllKeys<NonNullable<B>> & string]
    : MissingIn<ElementOf<NonNullable<A>>, ElementOf<NonNullable<B>>, `${P}[]`>;

type SchemaIsMissing = MissingIn<ExpandedContent, Parsed, "expanded">;
type SchemaHasExtra = MissingIn<Parsed, ExpandedContent, "expanded">;

/** A type error here names the core fields the schema does not know yet (see the comment above). */
const schemaKnowsEveryCoreField: [SchemaIsMissing] extends [never]
  ? true
  : { error: "core has fields the schema lacks"; fields: SchemaIsMissing } = true;
/** A type error here names schema fields that core no longer has. */
const coreHasEverySchemaField: [SchemaHasExtra] extends [never]
  ? true
  : { error: "the schema has fields core lacks"; fields: SchemaHasExtra } = true;
void schemaKnowsEveryCoreField;
void coreHasEverySchemaField;
