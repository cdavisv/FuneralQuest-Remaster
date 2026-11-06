/**
 * The banned-terms part of the content policy (packages/content/EDITS.md, docs/REMASTER_PLAN.md
 * 3.2): real brands and products, real people (celebrities, politicians, real killers), and slurs.
 * New content that uses one fails the build; lines inherited unchanged from the reviewed Classic
 * pack are exempt (EDITS.md lists the references that review decided to keep, such as Elvis).
 *
 * The lists cannot be complete: they catch the usual suspects and typos of habit (a real cleaner
 * named in a joke), not every brand in the world. Reviewers still read new content.
 *
 * Slurs are stored as hashes so the repository does not spell them out. A word of a line is
 * banned when the hash of its lowercase letters (or of two neighbouring words written together, for
 * slurs of two words) is in `SLUR_HASHES`. To add one, paste the output of
 *   pnpm --filter @fq/content exec tsx -e 'import("./src/banned.ts").then((m) => console.log(m.slurHash("word")))'
 * Ambiguous words that are
 * also ordinary English (a cookie, a small bite, an armour gap, a rodent) are deliberately absent;
 * reviewers catch those uses.
 */

/** cyrb53, a small public-domain 53-bit string hash (pure, so this file stays browser-safe). */
export function slurHash(word: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < word.length; i++) {
    const ch = word.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Ethnic, racial, religious, homophobic, transphobic, ableist and class slurs (hashed). */
export const SLUR_HASHES: ReadonlySet<string> = new Set([
  "29krqq48gq9",
  "2an9oh2fhrj",
  "1bs6qvigxo2",
  "ktdy0yozki",
  "l2tqv6dg0e",
  "g68s6r4hz6",
  "2974rs2qyq2",
  "25gch0qp5r9",
  "nfbfdvsr9d",
  "dkebjtdhd6",
  "203f4cis43s",
  "odwcrgc5sr",
  "18l69yy60mx",
  "1bymdul9lyv",
  "1mvk3ss0qf8",
  "1tiejo7900f",
  "23sri1w9frr",
  "pwgrswrf7h",
  "29io4u9y554",
  "ajhjh2iw8t",
  "16xmqfxze3k",
  "yu7ia21spl",
  "20pqn2ul52w",
  "o26wh2jrbz",
  "12oicjyf6g8",
  "yhr0050u11",
  "6dovtsllww",
  "1pr4610zgsn",
  "1paph74w6ql",
  "1y96kffli5o",
  "117xot3dw34",
  "z8e4cdlrtk",
  "1stcheg892i",
  "zc1v48wbyu",
  "2bfho0lj1lc",
  "cc31stapha",
  "niyzzy487q",
  "zfhy7d586c",
  "1aj488857gv",
  "wifubnew8x",
  "1ntllclsdhj",
  "12t7ucwkuup",
  "8etyf2yh3l",
  "21m2kayp8h4",
  "vx6iat0hp5",
  "1dylxaaq2bw",
  "2eypc49hohs",
  "yz9o5245vg",
  "bwtmlpxw4i",
  "245yvk884qu",
  "1i59lhb4cz0",
  "1kuoravlfv3",
  "5u12nhsf9i",
  "jxl1levyv6",
  "21f97jcn91r",
  "1xy06lirf0c",
  "1474mghf1x1",
  "2ny5u0e1nc",
]);

/**
 * Real brands and products, including trademarks people use as ordinary words (a gelatin dessert,
 * a hot tub, a hook-and-loop fastener): the original invents its brands (Di-Mart, DuraRest,
 * Forever Fragrant) and so does new content. Matched as whole words, case-insensitively.
 */
export const BANNED_BRANDS: readonly string[] = [
  // Shops, restaurants, food and drink
  "Walmart",
  "Wal-Mart",
  "Kmart",
  "K-Mart",
  "Target Store",
  "Costco",
  "Sears",
  "Home Depot",
  "IKEA",
  "Blockbuster",
  "McDonald's",
  "McDonalds",
  "Burger King",
  "Wendy's",
  "KFC",
  "Taco Bell",
  "Pizza Hut",
  "Domino's",
  "Subway sandwich",
  "Starbucks",
  "Dunkin",
  "Denny's",
  "Applebee's",
  "Hooters",
  "Coca-Cola",
  "Coca Cola",
  "Pepsi",
  "Dr Pepper",
  "Mountain Dew",
  "Red Bull",
  "Budweiser",
  "Coors",
  "Miller Lite",
  "Heineken",
  "Jack Daniel's",
  "Jack Daniels",
  "Smirnoff",
  "Twinkie",
  "Twinkies",
  "Doritos",
  "Cheetos",
  "Oreo",
  "Oreos",
  "Jell-O",
  "Jello",
  "Spam musubi",
  "Velveeta",
  "Kool-Aid",
  "Hostess",
  "Hershey",
  "Snickers",
  "Skittles",
  "Pop-Tart",
  "Pop-Tarts",
  "Popsicle",
  "Tupperware",
  "Crock-Pot",
  "Ziploc",
  "Pringles",
  "Slurpee",
  "7-Eleven",
  // Household, medicine, cars
  "Windex",
  "Lysol",
  "Clorox",
  "Kleenex",
  "Febreze",
  "Q-tip",
  "Q-tips",
  "Band-Aid",
  "Band-Aids",
  "Vaseline",
  "Tylenol",
  "Advil",
  "Prozac",
  "Viagra",
  "Xanax",
  "Botox",
  "Pepto",
  "Listerine",
  "Velcro",
  "Jacuzzi",
  "Frisbee",
  "Styrofoam",
  "Taser",
  "Kevlar",
  "Teflon",
  "Formica",
  "Thermos",
  "Post-it",
  "Rolodex",
  "Bubble Wrap",
  "Jet Ski",
  "Zamboni",
  "Segway",
  "Roomba",
  "Muzak",
  "Cadillac",
  "Chevy",
  "Chevrolet",
  "Ford Motor",
  "Toyota",
  "Honda",
  "Tesla",
  "Harley-Davidson",
  "Harley",
  "Winnebago",
  "Rolex",
  "Gucci",
  "Prada",
  "Nike",
  "Adidas",
  "Hallmark",
  // Tech, media, games, toys
  "Microsoft",
  "Google",
  "Facebook",
  "Twitter",
  "TikTok",
  "Instagram",
  "YouTube",
  "Netflix",
  "Amazon.com",
  "eBay",
  "PayPal",
  "iPhone",
  "iPod",
  "iPad",
  "Walkman",
  "Nikon",
  "Kodak",
  "Polaroid",
  "Xerox",
  "AOL",
  "WebTV",
  "Napster",
  "Sony",
  "Nintendo",
  "PlayStation",
  "Xbox",
  "Sega",
  "Atari",
  "Pokemon",
  "Pac-Man",
  "Tetris",
  "Lego",
  "Barbie",
  "Ouija",
  "Monopoly",
  "Scrabble",
  "Nerf",
  "Tamagotchi",
  "Slinky",
  "Hula Hoop",
  "Disney",
  "Pixar",
  "MTV",
  "HBO",
  "ESPN",
  "CNN",
  "Fox News",
  "TNN",
  "Six Feet Under",
  "Walking Dead",
  "Evil Dead",
  "Star Wars",
  "Star Trek",
  "Harry Potter",
  "Simpsons",
  "X-Files",
  "Ghostbusters",
  "Scooby-Doo",
  "Scooby Doo",
  "Grateful Dead",
  "Beatles",
  "Rolling Stones",
  "Metallica",
  // Real funeral industry names
  "Forest Lawn",
  "Batesville",
  "Service Corporation International",
  "Dignity Memorial",
];

/** Real people: celebrities, politicians, famous killers and the like. Whole words. */
export const BANNED_PEOPLE: readonly string[] = [
  "Elvis",
  "Presley",
  "Tupac",
  "2Pac",
  "Michael Jackson",
  "Madonna",
  "Oprah",
  "Beyonce",
  "Taylor Swift",
  "Kardashian",
  "Bieber",
  "Britney",
  "Elon Musk",
  "Bezos",
  "Zuckerberg",
  "Bill Gates",
  "Steve Jobs",
  "Trump",
  "Obama",
  "Biden",
  "Clinton",
  "Reagan",
  "Nixon",
  "Kennedy",
  "JFK",
  "George Bush",
  "Hitler",
  "Stalin",
  "Mussolini",
  "Bin Laden",
  "Manson",
  "Dahmer",
  "Ted Bundy",
  "Kevorkian",
  "Jay Leno",
  "Letterman",
  "Milli Vanilli",
  "Paul Crouch",
  "Mister Rogers",
  "Mr. Rogers",
  "Bob Ross",
  "Martha Stewart",
  "Dr. Phil",
  "Jerry Springer",
  "Larry King",
  "Stephen King",
  "Tom Cruise",
  "Schwarzenegger",
  "Stallone",
  "Chuck Norris",
  "Shatner",
  "Betty White",
  "John Wayne",
  "Clint Eastwood",
  "Dolly Parton",
  "Willie Nelson",
  "Elton John",
  "Ozzy",
  "Sinatra",
  "Liberace",
  "Marilyn Monroe",
  "James Dean",
  "Houdini",
  "Kurt Cobain",
  "Jim Morrison",
  "Jimi Hendrix",
  "Janis Joplin",
  "Princess Diana",
];

export interface BannedHit {
  term: string;
  kind: "brand" | "person" | "slur";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(terms: readonly string[]): RegExp {
  // Word boundaries that also work for terms starting or ending with a digit or punctuation.
  const alternatives = terms
    .map((t) => escapeRegExp(t).replace(/\s+/g, "\\s+"))
    .sort((a, b) => b.length - a.length)
    .join("|");
  return new RegExp(`(?<![A-Za-z0-9])(?:${alternatives})(?![A-Za-z0-9])`, "gi");
}

const BRAND_RE = termPattern(BANNED_BRANDS);
const PEOPLE_RE = termPattern(BANNED_PEOPLE);

/**
 * Every banned term in `text` (colour codes and placeholders are ignored). `slurs` is the hash set
 * to use (tests pass their own, so they need not spell a slur either).
 */
export function bannedTerms(text: string, slurs: ReadonlySet<string> = SLUR_HASHES): BannedHit[] {
  const plain = text
    .replace(/`./g, "")
    .replace(/\{\w+\}/g, " ")
    .replace(/\\n/g, " ");
  const hits: BannedHit[] = [];
  for (const m of plain.matchAll(BRAND_RE)) hits.push({ term: m[0], kind: "brand" });
  for (const m of plain.matchAll(PEOPLE_RE)) hits.push({ term: m[0], kind: "person" });
  const tokens = plain.toLowerCase().match(/[a-z]+/g) ?? [];
  tokens.forEach((t, i) => {
    const pair = i + 1 < tokens.length ? `${t}${tokens[i + 1]}` : "";
    if (slurs.has(slurHash(t))) hits.push({ term: "(a slur)", kind: "slur" });
    else if (pair !== "" && slurs.has(slurHash(pair))) {
      hits.push({ term: "(a slur)", kind: "slur" });
    }
  });
  return hits;
}
