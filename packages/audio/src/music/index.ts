import type { Score } from "../seq/score.js";
import { battle, negotiation, sneak } from "./action.js";
import { cityHall, club, defeat, newDay, victory } from "./civic.js";
import { mainStinger, mainTheme } from "./mainTheme.js";
import { bank, dimart, hospital, university, yangs } from "./places.js";
import { ceremony, endDay, graveyard, meteor } from "./solemn.js";
import { cafe, desk, town } from "./town.js";

/** Every composition, in the order the report lists them. */
export function allScores(): Score[] {
  return [
    mainTheme(),
    mainStinger(),
    town(),
    desk(),
    negotiation(),
    ceremony(),
    cafe(),
    yangs(),
    dimart(),
    university(),
    bank(),
    hospital(),
    sneak(),
    battle(),
    graveyard(),
    cityHall(),
    club(),
    meteor(),
    victory(),
    defeat(),
    newDay(),
    endDay(),
  ];
}
