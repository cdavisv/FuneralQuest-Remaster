/**
 * Tunables of the Expanded town and living world (docs/expanded-rules.md
 * sections 16 to 25). Every number here is specified, with the reasoning, in
 * that document; the section is named on each group. Money is dollars, tags
 * are wood-tag equivalents unless a field says otherwise, chances are
 * percent unless a field says "share".
 */
export interface ExpandedTownRules {
  /** Section 16. */
  graveyard: {
    /** Monument tiers, bought in order: price, one-time BP, rating while owned. */
    monuments: { price: number; bp: number; rating: number }[];
    tend: {
      perDay: number;
      turns: number;
      karmaAtLeast: number;
      reviews: number;
      /** Church Associates add this much word of mouth on top. */
      associateReviews: number;
      luck: { min: number; max: number };
      /** Chance (percent) a mourner leaves a lead. */
      leadChance: number;
    };
    rob: {
      karmaAtMost: number;
      turns: number;
      luckWeight: number;
      money: { min: number; max: number };
      /** One success in this many is a silver tag instead of cash. */
      silverOneIn: number;
      fine: number;
      karma: number;
      reviews: number;
      /** Injury id the groundskeeper's dog gives. */
      injury: string;
    };
    duel: {
      /** Duels a player may start a day. */
      perDay: number;
      /** Duels a player may lose to challengers a day. */
      perVictimPerDay: number;
      turns: number;
      /** Share of the parlor-fight gain curve (section 9.1) a duel pays. */
      gainShare: number;
      shove: { base: number; perStrength: number; min: number; max: number };
      /** Damage taken falling into a grave. */
      graveDamage: { min: number; max: number };
      /** Share of the stake a player who yields still loses. */
      yieldShare: number;
      /** Chance (percent) the rival tries a shove instead of a swing. */
      aiShove: number;
      /**
       * A shove that lands costs the shoved side their next move (they climb out of the
       * grave). Off is the rule before the engine pass, kept for the comparison test.
       */
      shoveCostsMove: boolean;
      /** Injury ids given to the loser (picked at random). */
      injuries: string[];
    };
  };
  /** Section 17. */
  church: {
    bingo: { cards: number; maxPerPlayer: number; price: number; cut: number };
    confession: { first: number; step: number; perDay: number; upTo: number };
    holyWater: { price: number; max: number; karmaAtLeast: number };
    service: { turns: number; reviews: number; bpBase: number; ratingDiv: number };
    /** BP per step times `goodMult` at Trusted karma or better, `evilMult` at Grave Robber or worse. */
    tithe: { step: number; bpPerStep: number; perDay: number; goodMult: number; evilMult: number };
  };
  /** Section 18. */
  cityHall: {
    permits: Record<string, number>;
    inspection: {
      /** Pass chance = base + rating x ratingWeight + (karma - 50) x karmaWeight, clamped. */
      base: number;
      ratingWeight: number;
      karmaWeight: number;
      min: number;
      max: number;
      certificate: { price: number; days: number; reviews: number };
      bribe: { price: number; karma: number; days: number; karmaAtMost: number };
      fine: { share: number; max: number; reviews: number };
      passReviews: number;
    };
    ordinance: {
      every: number;
      candidates: number;
      lobby: { price: number; max: number };
    };
    election: {
      fileUntil: number;
      voteUntil: number;
      fee: number;
      ads: { price: number; max: number };
      perks: { turns: number; rating: number; ordinanceVotes: number };
    };
  };
  /** Section 23. */
  chains: {
    maxMembers: number;
    found: number;
    join: number;
    dues: number;
    rating: number;
    stockMult: number;
    leaveCooldown: number;
    /** Successful attacks on a chain's members per day before the rest are sheltered. */
    shelterAfter: number;
  };
  /** Section 19. */
  hospital: {
    maxInjuries: number;
    lead: { price: number; karma: number; max: number; perDay: number; incomeShift: number };
  };
  /** Section 20. */
  club: {
    cover: number;
    stakes: number[];
    dailyStakeMax: number;
    draw: { tieLoss: number };
    /** Reel strip (symbol ids, each slot equally likely) and the paytable. */
    slots: {
      reel: string[];
      triple: Record<string, number>;
      /** Pays this multiple when the first reel shows `symbol`, unless a triple paid. */
      first: { symbol: string; pays: number };
    };
    shots: { glasses: number; payout: number; injury: string };
    market: { slots: number };
    hit: {
      base: number;
      perBp: number;
      karma: number;
      foilPerLevel: number;
      sanctuary: number;
      /** Share of the parlor-fight curve the victim loses. */
      lossShare: number;
      rumourLuck: number;
      snitch: number;
      fine: number;
      reviews: number;
      injury: string;
    };
    bodyguard: { price: number };
    seance: { turns: number; luckWeight: number; leads: number; failLuck: number };
  };
  /** Section 21. */
  bank: {
    transfer: { dailyMax: number; feeShare: number; minAccountDays: number };
    savings: { rate: number; capBase: number };
    loan: {
      base: number;
      perPlot: number;
      max: number;
      rate: number;
      /**
       * Share of the amount added to the debt when the money is lent: the first
       * day's interest, so a loan repaid before midnight is not free credit.
       */
      fee: number;
      days: number;
      /** No new loans in the last this-many days of a season. */
      closedLastDays: number;
      /** Default penalty: 1 BP per this many dollars written off. */
      defaultDollarsPerBp: number;
      reviews: number;
      karma: number;
    };
  };
  /** Section 22. */
  world: { newsChance: number; newsFromDay: number; arcChance: number };
  /** Section 24. */
  challenge: {
    turns: number;
    money: number;
    stock: [number, number, number];
    psych: number;
    hearse: number;
    tags: [number, number, number];
  };
}

export const EXPANDED_TOWN: ExpandedTownRules = {
  graveyard: {
    monuments: [
      { price: 3000, bp: 60, rating: 1 },
      { price: 8000, bp: 130, rating: 1 },
      { price: 20000, bp: 260, rating: 2 },
      { price: 45000, bp: 160, rating: 2 },
      { price: 90000, bp: 180, rating: 3 },
    ],
    tend: {
      perDay: 2,
      turns: 0,
      karmaAtLeast: 70,
      reviews: 1,
      associateReviews: 1,
      luck: { min: 1, max: 3 },
      leadChance: 30,
    },
    rob: {
      karmaAtMost: 30,
      turns: 0,
      luckWeight: 0.75,
      money: { min: 500, max: 2000 },
      silverOneIn: 4,
      fine: 1000,
      karma: -2,
      reviews: -2,
      injury: "dog-bite",
    },
    duel: {
      perDay: 1,
      perVictimPerDay: 2,
      turns: 1,
      gainShare: 0.75,
      shove: { base: 25, perStrength: 5, min: 10, max: 60 },
      graveDamage: { min: 1, max: 4 },
      yieldShare: 0.5,
      aiShove: 15,
      shoveCostsMove: true,
      injuries: ["sprained-ankle", "cracked-skull"],
    },
  },
  church: {
    bingo: { cards: 12, maxPerPlayer: 6, price: 1, cut: 0.1 },
    confession: { first: 400, step: 200, perDay: 5, upTo: 60 },
    holyWater: { price: 600, max: 3, karmaAtLeast: 50 },
    service: { turns: 1, reviews: 3, bpBase: 20, ratingDiv: 4 },
    tithe: { step: 1000, bpPerStep: 8, perDay: 10000, goodMult: 1.5, evilMult: 0.5 },
  },
  cityHall: {
    permits: { signage: 1500, zoning: 4000, crematory: 6000 },
    inspection: {
      base: 30,
      ratingWeight: 0.5,
      karmaWeight: 0.5,
      min: 10,
      max: 90,
      certificate: { price: 1000, days: 7, reviews: 1 },
      bribe: { price: 500, karma: -2, days: 7, karmaAtMost: 30 },
      fine: { share: 0.05, max: 3000, reviews: -2 },
      passReviews: 1,
    },
    ordinance: { every: 7, candidates: 3, lobby: { price: 2500, max: 2 } },
    election: {
      fileUntil: 7,
      voteUntil: 10,
      fee: 6000,
      ads: { price: 5000, max: 5 },
      perks: { turns: 0, rating: 1, ordinanceVotes: 2 },
    },
  },
  chains: {
    maxMembers: 4,
    found: 10000,
    join: 5000,
    dues: 150,
    rating: 4,
    stockMult: 0.9,
    leaveCooldown: 3,
    shelterAfter: 3,
  },
  hospital: {
    maxInjuries: 3,
    lead: { price: 1500, karma: -2, max: 3, perDay: 2, incomeShift: 25 },
  },
  club: {
    cover: 2,
    stakes: [100, 500, 1000, 5000],
    dailyStakeMax: 25000,
    draw: { tieLoss: 0.5 },
    slots: {
      // 16 slots a reel: 1 skull, 2 coffins, 3 bones, 4 roses, 6 worms.
      reel: [
        "skull",
        "coffin",
        "coffin",
        "bone",
        "bone",
        "bone",
        "rose",
        "rose",
        "rose",
        "rose",
        "worm",
        "worm",
        "worm",
        "worm",
        "worm",
        "worm",
      ],
      triple: { skull: 500, coffin: 100, bone: 30, rose: 12, worm: 4 },
      first: { symbol: "skull", pays: 1 },
    },
    shots: { glasses: 6, payout: 0.19, injury: "pickled-liver" },
    market: { slots: 3 },
    // Engine pass (tuning log, "Loose ends"): base 5,000 -> 3,000, perBp 2 -> 1, lossShare 0.5 -> 0.75.
    hit: {
      base: 3000,
      perBp: 1,
      karma: -5,
      foilPerLevel: 20,
      sanctuary: 25,
      lossShare: 0.75,
      rumourLuck: 60,
      snitch: 50,
      fine: 2000,
      reviews: -3,
      injury: "kneecapped",
    },
    bodyguard: { price: 3000 },
    seance: { turns: 1, luckWeight: 0.8, leads: 2, failLuck: -3 },
  },
  bank: {
    transfer: { dailyMax: 10, feeShare: 0.1, minAccountDays: 3 },
    savings: { rate: 0.0015, capBase: 100000 },
    loan: {
      base: 3000,
      perPlot: 100,
      max: 50000,
      rate: 0.03,
      fee: 0.03,
      days: 10,
      closedLastDays: 3,
      defaultDollarsPerBp: 40,
      reviews: -10,
      karma: -5,
    },
  },
  world: { newsChance: 0.6, newsFromDay: 2, arcChance: 0.35 },
  challenge: {
    turns: 20,
    money: 5000,
    stock: [3, 2, 1],
    psych: 2,
    hearse: 1,
    tags: [2, 0, 0],
  },
};
