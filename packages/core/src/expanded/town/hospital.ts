import type { Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { battleModule } from "../../classic/modules/battle.js";
import { hospitalModule } from "../../classic/modules/hospital.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import { fill, intToCash } from "../../text/format.js";
import { modValue } from "../modifiers.js";
import { karmaMod, moneyMod, xr } from "../players.js";
import {
  addInjury,
  arrive,
  card,
  cash,
  chainHit,
  chooseInjury,
  injuryDef,
  life,
  line,
  off,
  spent,
  TOWN_MODIFIER_KEYS,
  today,
  townScreen,
  tr,
  xt,
} from "./life.js";

/**
 * The hospital, the Nurse (docs/expanded-rules.md section 19): injuries from
 * fights persist until they heal (one day each midnight) or are treated for
 * money; the ambulance chaser pays the nurse for a customer lead. The sick
 * room after a lost parlor fight is the Classic one. Button ids:
 * `hospital:treat:<injury id>`, `hospital:lead`, and Classic's `hospital:leave-room`.
 */
export const HOSPITAL_X = "hospital";

/** Section 19.1: today's price to treat an injury. */
export function treatPrice(turn: Turn, id: string): number {
  const def = injuryDef(turn, id);
  const step = xr(turn).customer.limitStep;
  const raw = modValue(turn.town, TOWN_MODIFIER_KEYS.treatPrice, def?.treatPrice ?? 0);
  return Math.round(raw / step) * step;
}

function desk(turn: Turn, message = ""): View {
  const t = xt(turn).text.hospital;
  const hints = xt(turn).text.hints;
  const lead = tr(turn).hospital.lead;
  const p = turn.player;
  const l = life(turn);
  let text = fill(t.greeting, { player: p.name, nurse: xt(turn).cast.nurse });
  const buttons: Button[] = [];
  if (l.injuries.length === 0) text += `\n\n${t.noInjuries}`;
  for (const i of l.injuries) {
    const def = injuryDef(turn, i.id);
    if (!def) continue;
    const price = treatPrice(turn, i.id);
    text += `\n${fill(t.injuryLine, { name: def.name, days: i.days, price: intToCash(price) })}`;
    const b = card(
      `${HOSPITAL_X}:treat:${i.id}`,
      fill(t.buttons.treat, { name: def.name }),
      cash(price),
    );
    buttons.push(p.money < price ? off(b, hints.notEnoughCash) : b);
  }
  text += `\n\n${fill(t.leadIntro, { price: intToCash(lead.price), karma: lead.karma, nurse: xt(turn).cast.nurse })}`;
  let chase: Button = { ...button(`${HOSPITAL_X}:lead`, t.buttons.lead), detail: cash(lead.price) };
  if (l.leads >= lead.max) chase = off(chase, t.leadMax);
  else if (today(turn).bribes >= lead.perDay) chase = off(chase, hints.doneToday);
  else if (p.money < lead.price) chase = off(chase, hints.notEnoughCash);
  buttons.push(chase, goButton("map", t.buttons.leave));
  if (message !== "") text = `${message}\n\n${text}`;
  return townScreen(turn, {
    title: t.title,
    note: t.note,
    text,
    buttons,
    ...(xt(turn).pictures.hospitalDesk ?? xt(turn).pictures.hospital),
  });
}

function treat(turn: Turn, id: string): View {
  const l = life(turn);
  const p = turn.player;
  const price = treatPrice(turn, id);
  if (!l.injuries.some((i) => i.id === id) || p.money < price) throw new Error("Cannot treat that");
  moneyMod(p, -price);
  spent(turn, "hospital", price);
  l.injuries = l.injuries.filter((i) => i.id !== id);
  const name = injuryDef(turn, id)?.name ?? id;
  return desk(turn, fill(xt(turn).text.hospital.treated, { name }));
}

/** Section 19.2: pay the nurse for a lead (karma cost); the next customer is sure and richer. */
function buyLead(turn: Turn): View {
  const lead = tr(turn).hospital.lead;
  const l = life(turn);
  const d = today(turn);
  const p = turn.player;
  if (l.leads >= lead.max || d.bribes >= lead.perDay || p.money < lead.price)
    throw new Error("Cannot buy a lead");
  moneyMod(p, -lead.price);
  spent(turn, "leads", lead.price);
  karmaMod(p, lead.karma);
  d.bribes++;
  l.leads++;
  return desk(turn, line(turn, xt(turn).text.hospital.leadBought));
}

export const expandedHospitalModule: LocationModule = {
  ...hospitalModule,
  id: HOSPITAL_X,
  enter(turn, arg) {
    if (arg === "room") {
      const room = hospitalModule.enter?.(turn, arg) as View;
      // Section 25.4: a pack that draws the desk apart from the sick room shows its room here.
      const pics = xt(turn).pictures;
      if (pics.hospitalDesk) {
        room.picture = {};
        if (pics.hospital.fg) room.picture.fg = pics.hospital.fg;
        room.picture.bg = pics.hospital.bg;
      }
      return room;
    }
    arrive(turn, xt(turn).text.hospital.title, HOSPITAL_X);
    return desk(turn);
  },
  press(turn, command) {
    if (command.startsWith("treat:")) return treat(turn, command.slice(6));
    if (command === "lead") return buyLead(turn);
    if (!hospitalModule.press) throw new Error("No hospital");
    return hospitalModule.press(turn, command);
  },
};

/**
 * Section 19.1: the Classic parlor fight with injuries. Whoever drops to 0
 * hit points is injured (one of the duel injuries, at random); a beaten
 * victim counts toward their chain's shelter (section 23.3).
 */
export const expandedBattleModule: LocationModule = {
  ...battleModule,
  press(turn, command) {
    if (!battleModule.press) throw new Error("No battle");
    const him = turn.town.players[turn.session.hisId];
    const before = { me: turn.player.hp, him: him?.hp ?? 0 };
    const view = battleModule.press(turn, command);
    if (him && before.him > 0 && him.hp <= 0) {
      const id = chooseInjury(turn, "fight");
      if (id) {
        chainHit(turn, him);
        const text = addInjury(turn, him, id);
        if (text !== "") {
          sendPacket(turn.town, him.id, { type: "text", text });
          mailContinue(turn, him.id);
        }
      }
    }
    if (before.me > 0 && turn.player.hp <= 0) {
      const id = chooseInjury(turn, "fight");
      const text = id ? addInjury(turn, turn.player, id) : "";
      if (text !== "") {
        sendPacket(turn.town, turn.player.id, { type: "text", text });
      }
    }
    return view;
  },
};
