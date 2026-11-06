import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { enterHospitalRoom, richTextToPlain, step, Turn } from "../src/index.js";
import { atPlace, buttonIds, me, type Placed, plain, pressOn, reload } from "./support/places.js";

/** Shows the sick room to player 0 the way the battle module will (commands_battle.cpp:658). */
function sickRoom(p: Placed): Placed {
  const turn = new Turn(structuredClone(p.town), p.ctx, 0);
  const view = JSON.parse(JSON.stringify(enterHospitalRoom(turn))) as View;
  turn.commit();
  const session = turn.town.sessions["0"];
  if (session) session.view = view;
  return { ...p, town: turn.town, view, effects: [] };
}

describe("Church: script/public/church.c", () => {
  it("is a script screen with Father Smyth, the church art and one Leave button", () => {
    const { view, town } = atPlace("church");
    expect(plain(view)).toBe(
      'Father Smyth: "Why hello there, Skelly.  Isn\'t it a wonderfully fantastic day today?  Praise the Lord."',
    );
    expect(richTextToPlain(view.note ?? [])).toBe(
      "Father Smyth greets you warmly, a little too warmly.  You wonder if he has anything on under that robe.",
    );
    expect(view.scene).toBe("location");
    expect(view.map).toBeUndefined();
    expect(view.status).toBeUndefined();
    expect(view.picture).toEqual({ bg: "background/background_church", fg: "people/churchguy_h" });
    expect(view.buttons.map((b) => b.label)).toEqual(["Leave"]);
    expect(buttonIds(view)).toEqual(["go:map"]);
    expect(town.sessions["0"]?.script?.id).toBe("public/church");
    expect(town.sessions["0"]?.location).toBe("Church");
  });

  it("Leave ends the script and shows the map", () => {
    const p = pressOn(atPlace("church"), "go:map");
    expect(p.view.scene).toBe("map");
    expect(p.town.sessions["0"]?.script).toBeNull();
  });

  it("survives a save and load", () => {
    const p = reload(atPlace("church"));
    expect(p.town.sessions["0"]?.script?.journal.length).toBeGreaterThan(0);
    expect(pressOn(p, "go:map").view.scene).toBe("map");
  });

  it("only the Leave button is accepted", () => {
    const p = atPlace("church");
    expect(step(p.town, 0, { type: "press", buttonId: "script:1" }, p.ctx).rejected).toBeDefined();
  });
});

describe("Hospital: command_hospital.cpp", () => {
  it("the front desk greets by name (:21-49)", () => {
    const { view, town } = atPlace("hospital");
    expect(plain(view)).toBe('Nurse: "Hi Skelly.  I don\'t recall you having a pick-up today."');
    expect(richTextToPlain(view.note ?? [])).toBe(
      "You are at the city hospital.  A nurse smiles at you.",
    );
    expect(view.picture).toEqual({ bg: "places/hospital_desk" });
    expect(buttonIds(view)).toEqual(["go:map"]);
    expect(view.buttons[0]?.label).toBe("Leave");
    expect(town.sessions["0"]?.location).toBe("Hospital");
  });

  it("the sick room, where a battle loser wakes, then the nurse's line (:51-103)", () => {
    for (const [male, prince] of [
      [true, "prince charming"],
      [false, "sleeping beauty"],
    ] as const) {
      const base = atPlace("hospital", {
        setup: (t) => {
          (t.players[0] as { male: boolean }).male = male;
        },
      });
      const room = sickRoom(base);
      expect(plain(room.view)).toBe("Your whole body aches.");
      expect(richTextToPlain(room.view.note ?? [])).toBe(
        "You are lying on a bed, it doesn't look like your own.",
      );
      expect(room.view.picture).toEqual({ bg: "places/hospital_room", fg: "blank" });
      expect(room.view.battle).toBeUndefined();
      expect(buttonIds(room.view)).toEqual(["hospital:leave-room"]);
      expect(room.town.sessions["0"]?.location).toBe("Hospital");
      const up = pressOn(room, "hospital:leave-room");
      expect(plain(up.view)).toBe(
        `Nurse: "I see you finally woke up, ${prince}.  Hope you'll be more careful next time."`,
      );
      expect(up.view.picture).toEqual({ bg: "places/hospital_desk" });
      expect(buttonIds(up.view)).toEqual(["go:map"]);
      expect(me(up).hp).toBe(me(base).hp);
    }
  });
});
