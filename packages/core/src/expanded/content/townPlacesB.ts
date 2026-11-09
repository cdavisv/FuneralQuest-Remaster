// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" here is a dollar sign before a {price} placeholder, not a template.
/**
 * ============================================================================
 *  EXPANDED STARTER CONTENT: THE BATCH-B PLACES
 * ============================================================================
 * Dr. Grimble's Coroner's Office, the Health Department, Cousin Sal's Pawn
 * and Mourne & Sons (docs/expanded-rules.md section 31). Wired like the town's text
 * (`townStarter.ts`): `ExpandedContent.placesB`, with `PLACES_B_STARTER` as the
 * fallback for a pack that has none. Legacy markup, `{placeholders}`.
 *
 * Voice: the original's. Deadpan, crude, everybody in town is on the take.
 * No slurs, nothing about minors, no real brands or people.
 * ============================================================================
 */
import type { AssetId } from "@fq/protocol";

type Picture = { fg?: AssetId; bg: AssetId };

/** What every one of the four places names the same way. */
interface PlaceText {
  title: string;
  note: string;
  greeting: string;
  leave: string;
  back: string;
}

export interface PlacesBContent {
  cast: { coroner: string; pawnbroker: string; mournes: string; sons: string };
  pictures: { coroner: Picture; health: Picture; pawn: Picture; mournes: Picture };
  hints: {
    tipHeld: string;
    certWait: string;
    noLoot: string;
    boostOn: string;
    citationOpen: string;
    noCitation: string;
    truceOn: string;
    karmaTooLow: string;
    stanceChosen: string;
    noRivals: string;
  };
  coroner: PlaceText & {
    buttons: {
      tip: string;
      certificate: string;
      favour: string;
      burial: string;
      quiet: string;
    };
    tipBought: string;
    tipLoved: string;
    tipTrait: string;
    tipCheap: string;
    certBought: string;
    favourIntro: string;
    burialDone: string;
    quietDone: string;
    quietTalk: string;
  };
  health: PlaceText & {
    buttons: { inspect: string; buy: string; fine: string; complaint: string };
    passed: string;
    failed: string;
    bought: string;
    finePaid: string;
    complaintPrompt: string;
    complaintFiled: string;
    complaintDismissed: string;
    complaintBackfired: string;
    complaintMail: string;
    complaintNews: string;
    boostEnded: string;
  };
  pawn: PlaceText & {
    buttons: { loot: string; wood: string; silver: string };
    lootSold: string;
    lotGood: string;
    lotBad: string;
    lotLine: string;
  };
  mournes: PlaceText & {
    buttons: { spy: string; undercut: string; hold: string; truce: string };
    spyOk: string;
    spyCaught: string;
    undercutWin: string;
    undercutLose: string;
    holdDone: string;
    truceDone: string;
    truceLead: string;
    truceActive: string;
  };
}

export const PLACES_B_STARTER: PlacesBContent = {
  cast: {
    coroner: "Dr. Ignatius Grimble",
    pawnbroker: "Cousin Sal",
    mournes: "Augustus Mourne",
    sons: "Ned and Rollo",
  },

  pictures: {
    coroner: { fg: "people/m_old_7", bg: "places/prep-table" },
    health: { fg: "people/inspector-mudge", bg: "places/city-hall" },
    pawn: { fg: "people/morty", bg: "places/black-market" },
    mournes: { fg: "people/m_adult_5", bg: "places/parlor-3" },
  },

  hints: {
    tipHeld: "You already hold a tip",
    certWait: "Paperwork needs a few days to pile up again",
    noLoot: "Nothing to pawn",
    boostOn: "A clean bill of health is already posted",
    citationOpen: "Pay the fine first",
    noCitation: "No fine outstanding",
    truceOn: "There is a truce",
    karmaTooLow: "Too respectable for this",
    stanceChosen: "You have taken your stand today",
    noRivals: "No rival parlors to complain about",
  },

  coroner: {
    title: "County Coroner's Office",
    note: "The Coroner's Office smells of formaldehyde and instant coffee. Both are strong.",
    greeting:
      '`w{coroner}: `y"{player}. Sit. Not there, that one is occupied. Business is always brisk: people keep dying, and I keep being the first to know."',
    leave: "Leave",
    back: "Back",
    buttons: {
      tip: "Buy a Tip on Tomorrow's Deceased",
      certificate: "Fast-Track a Death Certificate",
      favour: "Ask About a Favour",
      burial: "Give Them a Proper Burial",
      quiet: "Sign Them Over, No Questions",
    },
    tipBought:
      "`${coroner} slides a folded note across the desk. \"Next family through your door. I've read the file. You didn't get it from me.\" `5(-${price})`$",
    tipLoved: "`8The note says: {loved}`$",
    tipTrait: "`8The note adds: {trait}.`$",
    tipCheap: "`8Scrawled in the margin: {cheap}`$",
    certBought:
      "`${coroner} stamps a stack of certificates before the ink on the last one is dry. Families hear that you get paperwork done fast. `5(+{reviews} reputation)`$",
    favourIntro:
      '`$Down the hall a cooler door is open. "Unclaimed," says {coroner}. "Nobody has asked after this one in nine days. The county pays for a pauper\'s plot, or the body could be made useful to someone with fewer questions." He waits.',
    burialDone:
      "`$You pay for a plain pine box and a plot with a view of the dumpster. A handful of strangers turn up. It was the least you could do. `5(+{karma} karma, +{luck} luck)`$",
    quietDone:
      '`${coroner} signs a form without reading it. "Wonderful. Nobody will ever ask." You are paid, in cash, promptly. `5(+${money}, {karma} karma)`$',
    quietTalk:
      "`4Somebody noticed the paperwork. The whole town is now talking about the way you do business.`$",
  },

  health: {
    title: "Health Department",
    note: "The Health Department's waiting room has a poster about handwashing. It has been there since the poster was new.",
    greeting:
      '`w{inspector}: `y"{player}. I look at {parlor}, I write what I see. Or I write what I am paid to see. It is a very flexible profession."',
    leave: "Leave",
    back: "Back",
    buttons: {
      inspect: "Request an Inspection",
      buy: "Buy a Clean Bill of Health",
      fine: "Pay the Fine",
      complaint: "File a Complaint",
    },
    passed:
      "`${inspector} walks through your parlor in six minutes and signs. A framed certificate goes up by your door for `w{days}`$ days. `5(+{reviews} reputation)`$",
    failed:
      '`4{inspector} finds a finger in the coffee maker. "That is not on the menu." A citation for `w${fine}`4 goes on file, and the neighbours hear about it. `5(-{reviews} reputation)`$',
    bought:
      '`${inspector} counts the envelope without looking at it. "Spotless. Truly." The certificate hangs by your door for `w{days}`$ days. `5({karma} karma, +{reviews} reputation)`$',
    finePaid:
      "`$You pay the citation in small bills. The clerk pins a receipt to it and, a few days later, the town forgets. `5(+{reviews} reputation)`$",
    complaintPrompt:
      "Which parlor has been breaking the rules? It will cost `w${price}`$ to be heard.",
    complaintFiled:
      '`${inspector} takes your complaint and files it where complaints are filed. "I will look into {name}\'s kitchen." `5({karma} karma)`$',
    complaintDismissed:
      "`${inspector} reads the complaint and puts it down. {name} holds a current certificate, so there is nothing to look into. The ${price} stays in his drawer.",
    complaintBackfired:
      "`4The complaint is traced straight back to you. Citation for `w${fine}`4 for wasting an inspector's time. `5({reviews} reputation)`$",
    complaintMail:
      "`4A complaint was filed against {parlor} with the Health Department. Somebody in town does not like you. Your reputation dipped.`$",
    complaintNews:
      "`7COMPLAINT AT {parlor}\n`^The Health Department has received a complaint about {name}'s parlor. Nobody will say who made it.\n\n",
    boostEnded:
      "`$The health certificate by your door has gone yellow and fallen off. Your reputation slips back with it.",
  },

  pawn: {
    title: "Cousin Sal's Pawn",
    note: "Cousin Sal's Pawn: Cash for Anything, Especially Things With Names Engraved On Them.",
    greeting:
      '`w{pawnbroker}: `y"{player}! Family. What have you got for me, and where did you get it? Actually, never mind the second part."',
    leave: "Leave",
    back: "Back",
    buttons: {
      loot: "Pawn Your Loot",
      wood: "Second-Hand Wood Lot",
      silver: "Second-Hand Silver Lot",
    },
    lootSold:
      '`${pawnbroker} turns the pieces over under a lamp and counts out `w${money}`$. "No receipts, no names, no problem."',
    lotGood:
      '`${pawnbroker} loads {count} "gently used" caskets into your trunk. They are, for once, exactly as described. `5(-${price})`$',
    lotBad:
      '`4The bottom of the lot is water-damaged. Only {count} of them is worth putting a body in. "No refunds," says {pawnbroker}. `5(-${price})`$',
    lotLine:
      "`w{name}`$, `w${price}`$: {count} caskets at {percent}% of the Di-Mart price. {risk}% of lots turn out bad.\n",
  },

  mournes: {
    title: "Mourne & Sons, Funeral Directors",
    note: "Mourne & Sons, Deathville's other undertakers since 1931. The brass is polished. The prices are printed. They have been waiting for you.",
    greeting:
      '`w{mourne}: `y"{player}. Do come in, and mind the carpet. My sons {sons} are out on a call, which means they will hear about this."',
    leave: "Leave",
    back: "Back",
    buttons: {
      spy: "Spy on the Mournes",
      undercut: "Undercut Their Prices",
      hold: "Hold Your Prices",
      truce: "Offer a Truce",
    },
    spyOk:
      "`$You wander through their showroom with a clipboard and nobody stops you. Ned's price list is plain as day. Next time you meet a family, you will know what they will pay for. `5(-${price})`$",
    spyCaught:
      '`4Rollo catches you copying prices out of the back of the brochure. "Gentlemen!" says {mourne}. "We have a visitor." You leave the way you came: loudly. `5(-${price}, {karma} karma, {reviews} reputation)`$',
    undercutWin:
      "`$You put a banner over the door: FUNERALS, FOR LESS. The Mournes cannot match it without losing money, and by supper the whole town knows. `5(-${price}, +{reviews} reputation, +{luck} luck)`$",
    undercutLose:
      "`4The Mournes match your price, then beat it, and their sons stand at the end of your road handing out coupons. `5(-${price}, {reviews} reputation)`$",
    holdDone:
      '`$You keep your prices where they are. {mourne} nods across the street, one professional to another. "Admirable." `5(+{karma} karma)`$',
    truceDone:
      "`$You and {mourne} shake on it in the middle of the street. For `w{days}`$ days neither of you will undercut the other. `5(+{karma} karma, -${price})`$",
    truceLead:
      "`$As a gesture, the Mournes send you a family they are too busy to take. `5(+{leads} lead)`$",
    truceActive: "`$The truce holds through day `w{until}`$.",
  },
};
