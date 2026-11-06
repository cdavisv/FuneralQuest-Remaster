import type { SoundId } from "@fq/audio";
import type { View } from "@fq/protocol";

/**
 * One-shots that come from what the engine now says as data (docs/expanded-rules.md 11.5), added to
 * the cue map's own (packages/audio `pickCue`, which works from pictures, scenes and a few words).
 * Nothing here reads text: a round's outcome, an upgrade's state, a loan, the cards held, an
 * injury list and the karma band each change a field, and the change is the cue.
 */
export interface DataMemory {
  /** The last club round, as JSON, so an unchanged round pushed again is not heard twice. */
  round?: string;
  money?: number;
  owned?: number;
  level?: number;
  owed?: number;
  cards?: number;
  injuries?: number;
  band?: number;
}

export function dataSounds(
  prev: DataMemory,
  view: View,
): { sounds: SoundId[]; memory: DataMemory } {
  const sounds: SoundId[] = [];
  const memory: DataMemory = { ...prev };
  const money = view.hud?.money;

  // A Reaper Club round: what came back says how it went.
  const round = view.club?.lastRound;
  if (round) {
    const key = JSON.stringify(round);
    const moved = money !== undefined && prev.money !== undefined && money !== prev.money;
    if (key !== prev.round || moved) {
      if (round.outcome === "win") sounds.push(round.net >= 1000 ? "cash-register" : "coins");
      else if (round.outcome === "lose") sounds.push("fail-trombone");
    }
    memory.round = key;
  } else delete memory.round;

  // The office: an upgrade bought, a building level gained.
  const office = view.office;
  if (office) {
    const owned = office.upgrades.filter((u) => u.state === "owned").length;
    if (prev.level !== undefined && office.level > prev.level) sounds.push("level-up");
    else if (prev.owned !== undefined && owned > prev.owned) sounds.push("ui-coin");
    memory.owned = owned;
    memory.level = office.level;
  }

  // The bank: a loan taken (cash arrives) or paid off.
  if (view.bank) {
    const owed = view.bank.loan.owed ?? 0;
    if (prev.owed !== undefined && owed > 0 && prev.owed === 0) sounds.push("coins");
    else if (prev.owed !== undefined && owed === 0 && prev.owed > 0) sounds.push("harp-good-news");
    memory.owed = owed;
  }

  // Bingo: a card bought.
  if (view.bingo) {
    const cards = view.bingo.mine.length;
    if (prev.cards !== undefined && cards > prev.cards) sounds.push("bingo-ball");
    memory.cards = cards;
  }

  // Injuries: one more, or fewer.
  const injuries =
    view.hud?.injuryList?.length ??
    (view.hud?.injuries !== undefined ? view.hud.injuries : undefined);
  if (injuries !== undefined) {
    if (prev.injuries !== undefined && injuries > prev.injuries) sounds.push("slap");
    else if (prev.injuries !== undefined && injuries < prev.injuries) sounds.push("harp-good-news");
    memory.injuries = injuries;
  }

  // Karma: a step up the bands is heard as angelic, a step down as a growl.
  const band = view.hud?.karmaPath?.min;
  if (band !== undefined) {
    if (prev.band !== undefined && band > prev.band) sounds.push("angelic");
    else if (prev.band !== undefined && band < prev.band) sounds.push("growl");
    memory.band = band;
  }

  if (money !== undefined) memory.money = money;
  return { sounds, memory };
}
