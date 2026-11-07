import { ClientModel } from "./client.js";
import type { Step } from "./session.js";

/** The policy's own dice (never the game's generators). */
export class Dice {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0x100000000;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)] as T;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  /** One of `options`, by weight. */
  weighted<T>(options: readonly (readonly [T, number])[]): T {
    const total = options.reduce((a, [, w]) => a + w, 0);
    let r = this.next() * total;
    for (const [v, w] of options) {
      r -= w;
      if (r < 0) return v;
    }
    return (options[options.length - 1] as readonly [T, number])[0];
  }
}

/** The client's own controls (commands.h:7-47). */
export const CMD = {
  quit: 1,
  wait: 2,
  stats: 3,
  main: 4,
  news: 5,
  yesterday: 7,
  announcement: 8,
  ranking: 9,
  map: 12,
  yangs: 13,
  chatStart: 23,
  chatUpdate: 24,
  spirit: 36,
  hospital: 37,
  comp: 38,
  bank: 39,
  store: 40,
  front: 41,
  crime: 42,
  script: 44,
} as const;

/** The map's buildings (welcome.swf buttons; legacy-compat PLACE_COMMANDS). */
const PLACES: readonly (readonly [number, number])[] = [
  [CMD.main, 2],
  [CMD.bank, 3],
  [CMD.store, 3],
  [CMD.yangs, 3],
  [CMD.comp, 6],
  [CMD.script, 1],
  [CMD.hospital, 1],
  [CMD.spirit, 3],
  [CMD.chatStart, 1],
];

const TEXTS = ["1", "2", "3", "5", "0", "12", "-2", "abc", "7", "100"];
const NOTES = [
  "Grand opening sale at my parlor!",
  "Visit [www.rtsoft.com] today",
  "Caskets half off",
];
const CHAT = ["hello", "/me waves a femur", "/info", "/who", "/tv", "/?", "/all", "/give a wood"];
const LETTERS = ["Hello neighbour.", "You will regret this.", "Nice parlor."];

export interface WalkerOptions {
  /** Names (or name prefixes) the walker types into name prompts. */
  names: readonly string[];
  /** Weight of waiting for customers at the desk while turns are left. */
  waitWeight?: number;
  /** Map buildings by weight, replacing the default mix (command numbers as in PLACES). */
  places?: readonly (readonly [number, number])[];
  /** Plaque labels to prefer (weight 6 against 1 for the others), for focused families. */
  prefer?: readonly string[];
}

/**
 * A random client for one player: looks at what the original's client would
 * be showing and picks something it offers. The same step then goes to both
 * sides.
 */
export class Walker {
  readonly model = new ClientModel();
  constructor(
    readonly p: number,
    private readonly dice: Dice,
    private readonly options: WalkerOptions,
  ) {}

  private pickButton() {
    const prefer = this.options.prefer;
    if (!prefer) return this.dice.pick(this.model.plaque);
    return this.dice.weighted(
      this.model.plaque.map((b) => [b, prefer.includes(b.label) ? 6 : 1] as const),
    );
  }

  next(): Step {
    const { model: m, dice, p } = this;
    switch (m.overlay) {
      case "i_get_text":
        if (dice.chance(0.1)) return { kind: "text", p, text: null };
        return { kind: "text", p, text: dice.pick(TEXTS) };
      case "i_getname":
        return {
          kind: "name",
          p,
          text: dice.pick([...this.options.names, "zzz"]),
          accept: dice.chance(0.8),
          cancel: dice.chance(0.05),
        };
      case "i_message":
      case "i_namenext":
      case "i_mail":
        // The client closes these itself; nothing is sent.
        m.overlay = null;
        break;
      default:
        break;
    }
    if (m.object === "m_main" && m.deskMenu) {
      const waitWeight = m.turns > 0 ? (this.options.waitWeight ?? 12) : 0;
      const choice = dice.weighted<string>([
        ["wait", waitWeight],
        ["map", 3],
        ["news", 1],
        ["stats", 1],
        ["rankings", 1],
        ["mail", 0.5],
        ["plaque", m.plaque.length > 0 ? 3 : 0],
      ]);
      switch (choice) {
        case "wait":
          return { kind: "cmd", p, command: CMD.wait };
        case "map":
          return { kind: "cmd", p, command: CMD.map };
        case "news":
          return { kind: "cmd", p, command: CMD.news };
        case "stats":
          return { kind: "cmd", p, command: CMD.stats };
        case "rankings":
          return { kind: "cmd", p, command: CMD.ranking };
        case "mail":
          return {
            kind: "mail",
            p,
            to: dice.pick([...this.options.names, "zzz"]),
            text: dice.pick(LETTERS),
          };
        default: {
          const b = this.pickButton();
          if (b.command === "21") return { kind: "reply", p, text: dice.pick(LETTERS) };
          return { kind: "press", p, label: b.label };
        }
      }
    }
    if (m.plaque.length > 0) {
      const b = this.pickButton();
      // Reply is the client's own (welcome.swf sprite 450): it opens the pad.
      if (b.command === "21") return { kind: "reply", p, text: dice.pick(LETTERS) };
      return { kind: "press", p, label: b.label };
    }
    switch (m.object) {
      case "i_map": {
        const command = dice.weighted(this.options.places ?? PLACES);
        if (command === CMD.script) {
          return { kind: "cmd", p, command, extra: { st_extra_text: "church.c" } };
        }
        return { kind: "cmd", p, command };
      }
      case "news": {
        const choice = dice.weighted<number>([
          [CMD.main, 4],
          [CMD.front, 1],
          [CMD.crime, 1],
          [CMD.yesterday, 1],
          [CMD.announcement, 0.4],
        ]);
        if (choice === CMD.announcement) {
          return { kind: "cmd", p, command: choice, extra: { st_note: dice.pick(NOTES) } };
        }
        return { kind: "cmd", p, command: choice };
      }
      case "rankings":
        return { kind: "rankClose", p };
      case "i_chat":
        if (dice.chance(0.4)) return { kind: "cmd", p, command: CMD.map };
        return { kind: "cmd", p, command: CMD.chatUpdate, extra: { st_input: dice.pick(CHAT) } };
      default:
        return { kind: "cmd", p, command: CMD.main };
    }
  }
}
