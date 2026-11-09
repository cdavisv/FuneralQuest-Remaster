/**
 * ============================================================================
 *  EXPANDED STARTER CONTENT: THE BATCH-A PLACES
 * ============================================================================
 * The Police Station, the Crematorium, the Florist and the Town Gazette
 * (docs/expanded-rules.md section 30). The numbers are in `rules.town.placesA`
 * (`rules/expandedTownRules.ts`); this file is only words and pictures.
 *
 * Voice: the original's. Deadpan, crude, everybody in town is on the take.
 * No slurs, nothing about minors, no real brands or people. Money is always
 * passed in already formatted (`{price}` is "$1,000"), so no text here needs
 * a dollar sign next to a placeholder.
 *
 * `ExpandedContent.placesA` is optional: a pack without it plays with
 * `PLACES_A_STARTER`, so packs written before these places existed still load.
 * ============================================================================
 */
import type { AssetId } from "@fq/protocol";

type Picture = { fg?: AssetId; bg: AssetId };

export interface PlacesAContent {
  /** The new people (`sergeant` keeps the police desk; the health inspector, `town.cast.inspector`, works at the Health Department). Nurse Gertie and Father Smyth appear by name. */
  cast: { sergeant: string; ovenKeeper: string; florist: string; editor: string };
  pictures: { police: Picture; crematorium: Picture; florist: Picture; gazette: Picture };
  hints: {
    notEnoughCash: string;
    doneToday: string;
    alreadyHave: string;
    noRivals: string;
  };
  /** Lines added to a sale summary. */
  saleNotes: {
    /** `{money}`: a rented oven slot saved this much. */
    oven: string;
    /** `{count}`, `{money}` */
    flowers: string;
  };
  police: PoliceText;
  crematorium: CrematoriumText;
  florist: FloristText;
  gazette: GazetteText;
}

export interface PoliceText {
  title: string;
  note: string;
  /** `{inspector}` */
  intro: string;
  /** Added to the intro while tonight's patrol is on. */
  introPatrolled: string;
  buttons: {
    report: string;
    settle: string;
    patrol: string;
    backdoor: string;
    leave: string;
  };
  /** Picker prompts. `{inspector}` */
  reportPrompt: string;
  settlePrompt: string;
  /** Hint on Report and Settle with nobody to name. */
  noGrievances: string;
  /** Hint on the patrol buttons when tonight is already covered. */
  alreadyPatrolled: string;
  /** Hint on the patrol buttons for a Peaceful parlor (nobody can visit it anyway). */
  peacefulSafe: string;
  /** `{name}`, `{fine}`, `{share}` */
  reported: string;
  /** `{name}`: the rival had nothing to fine. */
  reportedBroke: string;
  /** `{name}`, `{amount}` */
  settled: string;
  /** `{name}`: a settlement from a rival with an empty till. */
  settledBroke: string;
  /** `{name}`, `{fine}` */
  fineMail: string;
  /** `{name}`, `{amount}` */
  settleMail: string;
  /** `{name}`, `{fine}`: on the crime page. */
  fineNews: string;
  /** `{inspector}` */
  patrolBought: string;
  /** `{inspector}` */
  backdoorWorked: string;
  /** `{inspector}` */
  backdoorFailed: string;
  /** `{rival}`, `{day}`: one line of a picker row. */
  grievanceRow: string;
}

export interface CrematoriumText {
  title: string;
  note: string;
  /** `{keeper}`, `{slots}`, `{until}`, `{ashes}` */
  intro: string;
  /** Added when the Crematory Emissions Permit gives the discount. */
  permitNote: string;
  buttons: { rent: string; bulk: string; scatter: string; diamonds: string; leave: string };
  /** Hint when the rack is full. */
  ovenFull: string;
  /** Hint when there is nothing in the urn rack. */
  noAshes: string;
  /** `{slots}` */
  rented: string;
  /** `{slots}` */
  bulkBought: string;
  /** `{count}` */
  scattered: string;
  /** `{count}`, `{money}` */
  pressed: string;
}

export interface FloristText {
  title: string;
  note: string;
  /** `{florist}`, `{stock}`, `{special}` */
  intro: string;
  buttons: { buy: string; bundle: string; church: string; ward: string; leave: string };
  /** `{label}`, `{line}`, `{price}`, shown per weather id (falls back to `specialNone`). */
  special: Record<string, string>;
  specialNone: string;
  /** Hint when the shelf is full. */
  shelfFull: string;
  /** `{count}` */
  bought: string;
  /** Said once the church wreath or the ward flowers have gone out today. */
  wreathDone: string;
  /** `{nurse}` */
  wardSent: string;
  churchSent: string;
}

export interface GazetteText {
  title: string;
  note: string;
  /** `{editor}`, `{mayor}` */
  intro: string;
  buttons: { classified: string; display: string; puff: string; smear: string; leave: string };
  /** Hint when today's advert is already booked. */
  adBooked: string;
  /** Hint when the front page has been bought today. */
  puffDone: string;
  /** Hint when the smear slot has been used today. */
  smearDone: string;
  /** Shown after an advert: `{when}` is "tomorrow". */
  classifiedBooked: string;
  classifiedFlop: string;
  displayBooked: string;
  /** Delivered by the morning hook. `{count}` */
  adMorning: string;
  /** `{name}`, `{mayor}`: the front-page story. */
  puffNews: string;
  /** `{editor}`: shown to the buyer. */
  puffPrinted: string;
  /** Picker prompt. `{price}` */
  smearPrompt: string;
  /** `{name}` */
  smearDone2: string;
  /** `{name}` */
  smearNews: string;
  /** `{name}` */
  smearMail: string;
  /** `{name}`, `{fine}` */
  smearBackfire: string;
  /** `{name}`, `{target}`: the paper's retraction. */
  smearBackfireNews: string;
  /** `{name}` */
  smearBackfireMail: string;
  /** `{name}` */
  smearPeaceful: string;
  /** `{name}` */
  smearChain: string;
}

export const PLACES_A_STARTER: PlacesAContent = {
  cast: {
    sergeant: "Sergeant Bixby",
    ovenKeeper: "Old Cinder Pete",
    florist: "Marigold Thorne",
    editor: "Hal Pennywhistle",
  },

  pictures: {
    police: { fg: "people/sergeant-bixby", bg: "places/funeral_enemy_police" },
    crematorium: { bg: "places/creamation_oven" },
    florist: { fg: "people/marigold-thorne", bg: "places/florist" },
    gazette: { fg: "people/hal-pennywhistle", bg: "places/gazette" },
  },

  hints: {
    notEnoughCash: "You can't afford that.",
    doneToday: "Already done today.",
    alreadyHave: "You already have it.",
    noRivals: "There is nobody to pick.",
  },

  saleNotes: {
    oven: "\n`$Your rented oven slot saves you `w{money}`$ on the cremation.",
    flowers: "\n`$Fresh bouquets from the florist ({count}) add `w{money}`$.",
  },

  police: {
    title: "Police Station",
    note: "Deathville's finest. Mostly they are finest at doughnuts.",
    intro:
      '`w{inspector}: `$"Break-in? Assault? Lost cat? Pick one, sign here, and try not to lean on the desk. It is the only desk we have."',
    introPatrolled:
      "\n\n`$A patrol car idles at the curb, pointed at your parlor. It is on your tab.",
    buttons: {
      report: "File a Report",
      settle: "Take a Settlement",
      patrol: "Hire a Patrol",
      backdoor: "The Back Door",
      leave: "Leave",
    },
    reportPrompt: '`w{inspector}: `$"Who broke in on you? Pick a name and I will write it down."',
    settlePrompt: '`w{inspector}: `$"You want the money, not the paperwork? Name the culprit."',
    noGrievances: "Nobody has hit your parlor lately.",
    alreadyPatrolled: "Tonight is already covered.",
    peacefulSafe: "Peaceful parlors are off the rota already.",
    reported:
      "`$The report is filed. {name} is fined `w{fine}`$ and the town pays you `w{share}`$ for the trouble. Your name is on the right side of a form for once.",
    reportedBroke:
      "`$The report is filed. {name} has nothing worth fining, so the form goes in a drawer, but you feel better.",
    settled:
      "`$You and {name} reach an understanding in the parking lot. They hand over `w{amount}`$ and the form is never filed.",
    settledBroke:
      "`$You and {name} reach an understanding. They hand over lint and the form is never filed.",
    fineMail:
      "`$The police fined you `4{fine}`$ for roughing up {name}'s parlor. The officer said it with a straight face.\n",
    settleMail:
      "`$You were cornered by {name} about the break-in. To keep it off the record you paid `4{amount}`$.\n",
    fineNews: "`$Police fined {name} `w{fine}`$ after a complaint about a break-in.\r\n",
    patrolBought:
      '`w{inspector}: `$"One patrol car, parked outside all night. Nobody gets in, nobody gets out, nobody asks."',
    backdoorWorked:
      '`w{inspector}: `$"Funny, I never saw an envelope. A car will be outside tonight. I will not remember why."',
    backdoorFailed:
      '`w{inspector}: `$"That envelope was for the fund. The fund thanks you. No car, and I would not call a lawyer."',
    grievanceRow: "{rival} (day {day})",
  },

  crematorium: {
    title: "Crematorium",
    note: "The oven runs hot and the owner runs hotter.",
    intro:
      '`w{keeper}: `$"Oven time by the slot, no questions, no inspections. You have `w{slots}`$ slots reserved until day `w{until}`$ and `w{ashes}`$ urns on the shelf."',
    permitNote: "\n`$The crematory permit on your wall knocks the price down.",
    buttons: {
      rent: "Rent Oven Time",
      bulk: "Rent a Week's Worth",
      scatter: "Scatter the Ashes",
      diamonds: "Press the Ashes",
      leave: "Leave",
    },
    ovenFull: "The oven rack is full.",
    noAshes: "No urns are waiting.",
    rented:
      '`w{keeper}: `$"Slot reserved. That makes {slots} on your tab. Bring me a body and a bad attitude."',
    bulkBought:
      '`w{keeper}: `$"Bulk rate. Nobody ever bought in bulk and complained. That makes {slots} slots."',
    scattered:
      "`$You take {count} urn(s) to the lake at dawn and let the wind do the talking. It is very quiet. The town thinks better of you.",
    pressed:
      "`$Urns pressed: {count}. They go into the press behind the shed. A jeweler with no questions pays `w{money}`$. You try not to look at the display case again.",
  },

  florist: {
    title: "Florist",
    note: "Roses are red, violets are blue, that is a lot of stems for a funeral or two.",
    intro:
      '`w{florist}: `$"Fresh stems for your funeral packages. You have `w{stock}`$ in the cooler. {special}"',
    buttons: {
      buy: "Buy a Bouquet",
      bundle: "Buy a Bundle",
      church: "Wreath for Father Smyth",
      ward: "Flowers for the Ward",
      leave: "Leave",
    },
    special: {
      clear: "Nothing special today. Roses are on the shelf.",
      rain: "It is raining, so lilies are in season and cheaper.",
      fog: "The fog hurts the deliveries, but not the prices.",
      storm: "The storm smashed the front window, so everything is on clearance.",
      heat: "It is hot, and flowers in the heat cost double to keep alive.",
      snow: "The snow shut the growers, so hothouse stems cost extra.",
    },
    specialNone: "The price is whatever it is today.",
    shelfFull: "Your cooler is full.",
    bought: '`w{florist}: `$"{count} bouquet(s) added to your cooler. Sell them before they wilt."',
    wreathDone: "Already sent flowers today.",
    wardSent:
      "`$A hundred stems go to {nurse}'s ward. A patient cries. A visitor steals a rose. Everyone is a bit luckier.",
    churchSent:
      "`$A large wreath goes to Father Smyth's pulpit. He mentions your name in the sermon, which is the best thing he has ever said about anyone.",
  },

  gazette: {
    title: "Town Gazette",
    note: "All the news that is fit to print, and some that is not.",
    intro:
      '`w{editor}: `$"The Gazette goes everywhere in Deathville that {mayor} goes, which is a surprising amount of places. Ad copy, a feature on you, or a hatchet job on somebody else. What can I do?"',
    buttons: {
      classified: "Run a Classified",
      display: "Buy a Display Ad",
      puff: "Front-Page Puff Piece",
      smear: "Run a Smear",
      leave: "Leave",
    },
    adBooked: "You already booked an ad today.",
    puffDone: "You already own the front page today.",
    smearDone: "The Gazette has printed one smear for you today.",
    classifiedBooked:
      '`w{editor}: `$"Three lines in the back, between a missing cat and a pie sale. People will read it tomorrow. Some of them."',
    classifiedFlop:
      '`w{editor}: `$"Three lines in the back, between a missing cat and a pie sale. Nobody will read it. Nobody ever does."',
    displayBooked:
      '`w{editor}: `$"Half a page, with a border. Tomorrow the whole town sees your name, and your phone number."',
    adMorning: "\n`$Somebody read the Gazette ad: {count} new customer(s) waiting for you.",
    puffPrinted:
      '`w{editor}: `$"Front page, above the fold, your face six columns wide. Try to look like you deserve it."',
    puffNews:
      "`w{name}: `$A beloved parlor. The Gazette says {name} is a pillar of the community, and not a single pillar was asked.\r\n",
    smearPrompt:
      '`w{editor}: `$"A smear costs {price}. Who is the unlucky one? I will find the adjectives."',
    smearDone2:
      '`w{editor}: `$"Done. {name} will read about themselves in the morning. I took the liberty of spelling their name right."',
    smearNews:
      "`$The Gazette hears rumors about {name}'s parlor. Nobody will say what the rumors are. They are, however, everywhere.\r\n",
    smearMail:
      "`$The Gazette printed rumors about your parlor. Your word of mouth took a hit. Somebody paid for that.\n",
    smearBackfire:
      '`w{editor}: `$"{name} has a lawyer, an alibi and a nephew in the print room. The piece is pulled, you are fined `w{fine}`$, and I never met you."',
    smearBackfireNews:
      "`$The Gazette retracts its piece on {target}, after a complaint. It will not say who paid for the first one, and the whole town knows it was {name}.\r\n",
    smearBackfireMail:
      "`$Word is {name} tried to smear you in the Gazette. The piece was pulled and your good name is clean.\n",
    smearPeaceful: "{name} is a Peaceful parlor and off limits to the Gazette.",
    smearChain: "{name} is in your chain. Run it past them first.",
  },
};
