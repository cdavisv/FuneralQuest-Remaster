import type { PersonalityId } from "./personalities.js";

/**
 * What the rival parlors say: newspaper announcements, cafe lines, battle
 * quotes, Yang's fortunes and letters. Short, in character, and free of the
 * characters the game strips from names.
 */
export interface LinePool {
  announce: string[];
  cafe: string[];
  quote: string[];
  fortune: string[];
  letter: string[];
}

const POOLS: Record<PersonalityId, LinePool> = {
  mourner: {
    announce: [
      "Grief counselling with every plot. Tissues are free, the plot is not.",
      "We listen. We nod. We bury. Gentle Repose, open late.",
      "Remember: it is never too early to pre-plan.",
    ],
    cafe: [
      "Rough week. Three widows and a very sad goldfish.",
      "Does anyone else hum hymns to the freezer?",
      "I just think people deserve a little kindness at the end.",
    ],
    quote: ["I am so sorry it came to this.", "Rest now. You look tired."],
    fortune: ["May your caskets be light and your customers grateful."],
    letter: ["Please stop. We are all just trying to bury people here."],
  },
  shark: {
    announce: [
      "Why bury cheap when you can bury LARGE? Gold caskets, no questions.",
      "Last Gasp Caskets: we upsell so you do not have to think.",
      "This week only: a second coffin at full price!",
    ],
    cafe: [
      "Sold a gold casket to a guy who came in for directions.",
      "Mourning is a buyer's market and I am the buyer.",
      "If they cry, you are not pitching hard enough.",
    ],
    quote: ["Nothing personal. Strictly business.", "Should have bought the upgrade."],
    fortune: ["Your luck has been repossessed."],
    letter: ["Saw your sales figures. Adorable.", "Sell your parlor to me. Cheap."],
  },
  gambler: {
    announce: [
      "Double or Nothing Burials: spin the wheel, pick your plot!",
      "Feeling lucky? So were our clients. Briefly.",
      "Every funeral comes with a scratch card. Odds not guaranteed.",
    ],
    cafe: [
      "Anyone want to bet on whose hearse breaks down first?",
      "Found a lottery ticket in a suit pocket again. Lost again.",
      "Luck is just a skill nobody can teach.",
    ],
    quote: ["Snake eyes, friend.", "The house always wins."],
    fortune: ["Your number is up, but only slightly."],
    letter: ["Rematch? Same time tomorrow? Double the stakes."],
  },
  saboteur: {
    announce: [
      "A reminder that some parlors in this town have very flimsy locks.",
      "Spite and Sons: we will be seeing you. Soon.",
      "Smoke detectors are a sign of weakness.",
    ],
    cafe: [
      "Lovely night for a stroll past a rival's parlor.",
      "Who leaves their tags lying around like that? Asking for a friend.",
      "I did not do it. Whatever it was.",
    ],
    quote: ["Lock your doors next time.", "Tell the nurse I said hello.", "That is for the tiger."],
    fortune: ["Something is watching your parlor tonight."],
    letter: ["Sleep well. Or try to.", "Nice padlock. Shame about it."],
  },
  builder: {
    announce: [
      "Eternal Expansions: now with a bigger hearse and bigger plans.",
      "Coming soon: a new wing for the recently departed.",
      "Ask about our grave development opportunities.",
    ],
    cafe: [
      "Saving every gold tag for the Crown Sovereign. Every single one.",
      "Turns out a bigger hearse means more customers. Who knew?",
      "Thinking of adding a drive-through viewing window.",
    ],
    quote: ["Should have invested in yourself.", "Build first, fight never."],
    fortune: ["Your foundations are cracking."],
    letter: ["Thinking of buying your block. Interested?"],
  },
  scholar: {
    announce: [
      "Analytical Interment: we know what you can afford before you do.",
      "Free lecture tonight: the psychology of the bereaved wallet.",
      "Every sale a perfect sale. Ask about our methods.",
    ],
    cafe: [
      "Hit a spending limit to the dollar today. Exquisite.",
      "Resistance is just a number. Usually around forty percent.",
      "I took another psychology class. The professor cried.",
    ],
    quote: ["A textbook case.", "I read you like a death certificate."],
    fortune: ["You will misjudge a customer today."],
    letter: ["I have analysed your methods. Disappointing."],
  },
  saint: {
    announce: [
      "Gentle Hands: honest prices, blessed caskets, and nobody pockets the rings.",
      "Bingo at the church tonight. Bring a wood tag and a clean conscience.",
      "We pray for every customer. Even the ones who haggle.",
    ],
    cafe: [
      "Father Smyth says I tithe too much. I say heaven has no ceiling.",
      "Gave a widow a discount today. She cried. I cried. We all cried.",
      "Please return lost wedding rings to the church, no questions asked.",
    ],
    quote: ["Forgive me.", "Bless you, and goodbye."],
    fortune: ["Kindness is never wasted."],
    letter: ["I will pray for you. You need it."],
  },
  necromancer: {
    announce: [
      "Restless Rest: our mourners never leave. Ever.",
      "Seances nightly at the Reaper Club. Bring the deceased's favourite snack.",
      "Why bury the dead when they could help with the lifting?",
    ],
    cafe: [
      "Raised a choir of twelve today. Only nine of them were mine.",
      "The graveyard is lovely at night. Lots of fresh stock.",
      "Anyone know a good cleaner for grave dirt on velvet?",
    ],
    quote: ["Rise.", "You will make a fine mourner."],
    fortune: ["The dead are watching you. Closely."],
    letter: ["I know where your plots are."],
  },
  tycoon: {
    announce: [
      "Gilded Gates: because your loved one was worth every penny.",
      "Now accepting pre-need payment plans at very reasonable interest.",
      "Ask about our monument financing. Your name, in marble, forever.",
    ],
    cafe: [
      "Compound interest is the eighth wonder of the world. Coffins are the ninth.",
      "Bought another storeroom of caskets. Wholesale, of course.",
      "My savings account has its own savings account.",
    ],
    quote: ["Nothing personal. Just business.", "Consider this a write-off."],
    fortune: ["A fortune is coming. Invest it wisely."],
    letter: ["Our accountants will be in touch."],
  },
  politician: {
    announce: [
      "Vote for a funeral director who listens. And then buries.",
      "A plot in every family and a hearse in every garage!",
      "My opponent has never once embalmed a voter. Think about it.",
    ],
    cafe: [
      "Lovely to see you all. Remember me on election day.",
      "I am not saying I fixed the speed limit. I am saying you are welcome.",
      "Shook forty hands today. Two were warm.",
    ],
    quote: ["No comment.", "This will not affect my polling."],
    fortune: ["You will win a close race."],
    letter: ["I hope I can count on your vote."],
  },
  organiser: {
    announce: [
      "United Undertakers: join the chain, split the caskets, share the dead.",
      "Franchise opportunities available. Ask about our partner discount.",
      "Together we bury more. Membership has its privileges.",
    ],
    cafe: [
      "Two more parlors signed up today. The chain grows.",
      "Bulk caskets, five percent off. Synergy, people.",
      "Anyone want to merge? I have paperwork.",
    ],
    quote: ["You should have joined us.", "The chain remembers."],
    fortune: ["A partnership will make you rich."],
    letter: ["The invitation to join us still stands."],
  },
  pacifist: {
    announce: [
      "Olive Branch Rest has signed the Peace Pledge. Please do not break in.",
      "Gentle funerals for gentle people. No duels, ever.",
      "Violence is never the answer. Cremation sometimes is.",
    ],
    cafe: [
      "Has anyone else read the Peace Pledge fine print? It is lovely.",
      "Someone tried to challenge me in the graveyard. I gave them a leaflet.",
      "I pay my insurance and I sleep like the dead.",
    ],
    quote: ["I forgive you.", "Peace be with you."],
    fortune: ["Calm waters run deep."],
    letter: ["Let us settle this peacefully."],
  },
};

export function linesFor(personality: PersonalityId): LinePool {
  return POOLS[personality];
}
