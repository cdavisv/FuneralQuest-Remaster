import type { BankPanel, Button, View } from "@fq/protocol";
import { isBlocking } from "../../classic/blocking.js";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { bankModule } from "../../classic/modules/bank.js";
import { atoi } from "../../classic/parse.js";
import { expModForceTotal, tournamentEndsToday } from "../../classic/players.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import type { PlayerState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { modValue } from "../modifiers.js";
import { refreshRating } from "../parlor.js";
import { karmaMod, moneyMod, reviewsMod, xr } from "../players.js";
import { wholesalePrice } from "../scoring.js";
import {
  activePlayers,
  cash,
  life,
  lifeOf,
  newLife,
  off,
  TOWN_MODIFIER_KEYS,
  today,
  townScreen,
  tr,
  xt,
} from "./life.js";

/**
 * The bank under Expanded rules (docs/expanded-rules.md section 21): the
 * Classic tag exchange, plus savings with interest, loans with consequences,
 * and tag transfers to other players with limits and a fee. Button ids:
 * `bank:savings`, `bank:deposit`, `bank:withdraw`, `bank:depositall`,
 * `bank:withdrawall`, `bank:loan`, `bank:borrow`, `bank:repay`,
 * `bank:transfer` (picker `bank:tpick`), `bank:ttier:<0|1|2>` (prompt
 * `bank:tcount`); prompts `bank:depositamt`, `bank:withdrawamt`, `bank:borrowamt`.
 */
const BANK = "bank";
const TIERS = ["wood", "silver", "gold"] as const;
const AMOUNT_LENGTH = 9;

function screen(turn: Turn, text: string, buttons: Button[], vault = false): View {
  const pics = xt(turn).pictures;
  const view = townScreen(turn, {
    title: turn.text.places.bank.location,
    note: turn.text.places.bank.note,
    text,
    buttons,
    ...((vault ? pics.vault : undefined) ?? pics.bank),
  });
  view.bank = bankPanel(turn);
  return view;
}

/**
 * Section 11.5: savings, the loan terms and today's transfer limits, as data.
 * Read-only: a player who never used the town reads as a new record.
 */
export function bankPanel(turn: Turn): BankPanel {
  const p = turn.player;
  const day = turn.town.day;
  const l = p.expanded?.life ?? newLife();
  const counted = l.today.day === day;
  const sent = counted ? l.today.sent : 0;
  const received = counted ? l.today.received : 0;
  const b = tr(turn).bank;
  const rate = savingsRate(turn);
  const why = loanRefusalOf(turn, l);
  const loan: BankPanel["loan"] = {
    limit: loanLimit(turn, p),
    rate: loanRate(turn),
    fee: b.loan.fee,
    termDays: b.loan.days,
    dueIfTaken: dueDay(turn),
    canBorrow: why === "",
  };
  if (why !== "") loan.reason = why;
  if (l.loan) {
    loan.owed = l.loan.owed;
    loan.due = l.loan.due;
    loan.daysLeft = Math.max(0, l.loan.due - day);
  }
  const t = xt(turn).text.bank;
  let sendWhy = "";
  if (day - p.dayCreated < b.transfer.minAccountDays) sendWhy = t.transferTooNew;
  else if (sent >= b.transfer.dailyMax) sendWhy = fill(t.transferLimit, { left: 0 });
  const transfers: BankPanel["transfers"] = {
    sent,
    received,
    dailyMax: b.transfer.dailyMax,
    feeShare: b.transfer.feeShare,
    values: [tagValue(turn, 0), tagValue(turn, 1), tagValue(turn, 2)],
    canSend: sendWhy === "",
  };
  if (sendWhy !== "") transfers.reason = sendWhy;
  return {
    savings: l.savings,
    savingsRate: rate,
    savingsCap: b.savings.capBase,
    interestTonight: l.savings > 0 ? Math.floor(Math.min(l.savings, b.savings.capBase) * rate) : 0,
    canDeposit: !l.loan,
    loan,
    transfers,
  };
}

function back(turn: Turn): Button {
  return button(`go:${BANK}`, xt(turn).text.bank.buttons.back);
}

function prompt(view: View, id: string, text: string): View {
  return {
    ...view,
    buttons: [],
    overlay: { kind: "textInput", id, prompt: text, maxLength: AMOUNT_LENGTH },
  };
}

// ---------------------------------------------------------------- 21.2 savings

export function savingsRate(turn: Turn): number {
  return Math.max(
    0,
    modValue(turn.town, TOWN_MODIFIER_KEYS.savingsRate, tr(turn).bank.savings.rate),
  );
}

function savingsView(turn: Turn, message = ""): View {
  const t = xt(turn).text.bank;
  const hints = xt(turn).text.hints;
  const s = tr(turn).bank.savings;
  const p = turn.player;
  const l = life(turn);
  let text = fill(t.savingsIntro, {
    savings: intToCash(l.savings),
    rate: Math.round(savingsRate(turn) * 10000) / 100,
    cash: intToCash(p.money),
    cap: intToCash(s.capBase),
  });
  if (message !== "") text = `${message}\n\n${text}`;
  let deposit = button(`${BANK}:deposit`, t.buttons.deposit);
  let all: Button = {
    ...button(`${BANK}:depositall`, `${t.buttons.deposit} ${cash(p.money)}`),
    group: "more",
  };
  if (l.loan) {
    deposit = off(deposit, t.noDepositWithLoan);
    all = off(all, t.noDepositWithLoan);
  } else if (p.money <= 0) {
    deposit = off(deposit, hints.notEnoughCash);
    all = off(all, hints.notEnoughCash);
  }
  let withdraw = button(`${BANK}:withdraw`, t.buttons.withdraw);
  let out: Button = {
    ...button(`${BANK}:withdrawall`, `${t.buttons.withdraw} ${cash(l.savings)}`),
    group: "more",
  };
  if (l.savings <= 0) {
    withdraw = off(withdraw, hints.notEnoughCash);
    out = off(out, hints.notEnoughCash);
  }
  return screen(turn, text, [deposit, withdraw, all, out, back(turn)], true);
}

function deposit(turn: Turn, amount: number): View {
  const t = xt(turn).text.bank;
  const p = turn.player;
  const l = life(turn);
  if (l.loan) return savingsView(turn, t.noDepositWithLoan);
  if (!(amount > 0) || amount > p.money) return savingsView(turn, t.badAmount);
  moneyMod(p, -amount);
  l.savings += amount;
  return savingsView(turn, fill(t.deposited, { money: intToCash(amount) }));
}

function withdraw(turn: Turn, amount: number): View {
  const t = xt(turn).text.bank;
  const l = life(turn);
  if (!(amount > 0) || amount > l.savings) return savingsView(turn, t.badAmount);
  l.savings -= amount;
  moneyMod(turn.player, amount);
  return savingsView(turn, fill(t.withdrew, { money: intToCash(amount) }));
}

// ---------------------------------------------------------------- 21.3 loans

/** Section 21.3: the most the bank will lend (plots are the collateral). */
export function loanLimit(turn: Turn, p: PlayerState): number {
  const l = tr(turn).bank.loan;
  return Math.min(l.max, l.base + l.perPlot * p.plots);
}

export function loanRate(turn: Turn): number {
  return Math.max(0, modValue(turn.town, TOWN_MODIFIER_KEYS.loanRate, tr(turn).bank.loan.rate));
}

/** Whether the bank lends today ("" or the reason it does not). */
function loanRefusal(turn: Turn): string {
  return loanRefusalOf(turn, life(turn));
}

function loanRefusalOf(turn: Turn, l: { deadbeat: boolean; loan: unknown }): string {
  const t = xt(turn).text.bank;
  const s = turn.town.settings;
  if (l.deadbeat) return t.deadbeat;
  if (l.loan) return xt(turn).text.hints.alreadyHave;
  if (s.tournamentActive && turn.town.day > s.tournamentDays - tr(turn).bank.loan.closedLastDays)
    return t.loanClosed;
  return "";
}

function dueDay(turn: Turn): number {
  const s = turn.town.settings;
  const due = turn.town.day + tr(turn).bank.loan.days;
  return s.tournamentActive ? Math.min(due, s.tournamentDays) : due;
}

function loanView(turn: Turn, message = ""): View {
  const t = xt(turn).text.bank;
  const p = turn.player;
  const l = life(turn);
  let text = l.loan
    ? fill(t.loanOwed, { owed: intToCash(l.loan.owed), due: l.loan.due })
    : fill(t.loanIntro, {
        limit: intToCash(loanLimit(turn, p)),
        rate: Math.round(loanRate(turn) * 1000) / 10,
        fee: Math.round(tr(turn).bank.loan.fee * 1000) / 10,
        days: tr(turn).bank.loan.days,
      });
  if (message !== "") text = `${message}\n\n${text}`;
  let borrow = button(`${BANK}:borrow`, t.buttons.borrow);
  const why = loanRefusal(turn);
  if (why !== "") borrow = off(borrow, why);
  let repay: Button = button(`${BANK}:repay`, t.buttons.repay);
  if (!l.loan) repay = off(repay, xt(turn).text.hints.notNow);
  else if (p.money <= 0) repay = off(repay, xt(turn).text.hints.notEnoughCash);
  else repay = { ...repay, detail: cash(Math.min(p.money, l.loan.owed)) };
  return screen(turn, text, [borrow, repay, back(turn)], true);
}

function borrow(turn: Turn, amount: number): View {
  const t = xt(turn).text.bank;
  const p = turn.player;
  if (loanRefusal(turn) !== "") throw new Error("No loan");
  if (!(amount > 0) || amount > loanLimit(turn, p)) return loanView(turn, t.badAmount);
  const due = dueDay(turn);
  // Section 21.3: the first day's interest is charged when the money is lent.
  const owed = Math.ceil(amount * (1 + tr(turn).bank.loan.fee));
  life(turn).loan = { owed, due };
  moneyMod(p, amount);
  return loanView(turn, fill(t.borrowed, { money: intToCash(amount), due }));
}

function repay(turn: Turn): View {
  const l = life(turn);
  const p = turn.player;
  if (!l.loan || p.money <= 0) throw new Error("Nothing to repay");
  const paid = Math.min(p.money, l.loan.owed);
  moneyMod(p, -paid);
  l.loan.owed -= paid;
  if (l.loan.owed <= 0) l.loan = null;
  return loanView(turn, fill(xt(turn).text.bank.repaid, { money: intToCash(paid) }));
}

/**
 * Section 21.3: a loan past due is collected from cash, then savings, then
 * caskets in stock at wholesale. What is left is written off: 1 BP per
 * `defaultDollarsPerBp` dollars, word of mouth, karma, and no more loans
 * this season. A default always costs more BP than the money could buy.
 */
export function collectLoan(turn: Turn, p: PlayerState): void {
  const town = turn.town;
  const l = lifeOf(town, p);
  const loan = l.loan;
  if (!loan) return;
  const t = xt(turn).text.bank;
  const rules = xr(turn);
  let left = loan.owed;
  const fromCash = Math.min(p.money, left);
  moneyMod(p, -fromCash);
  left -= fromCash;
  const fromSavings = Math.min(l.savings, left);
  l.savings -= fromSavings;
  left -= fromSavings;
  const x = p.expanded;
  if (x) {
    for (const tier of [2, 1, 0] as const) {
      const value = wholesalePrice(rules, turn.rules.casketPrices[tier] ?? 0);
      while (left > 0 && x.stock[tier] > 0) {
        x.stock[tier]--;
        left -= value;
      }
    }
  }
  l.loan = null;
  const collected = loan.owed - Math.max(0, left);
  if (left > 0) {
    const d = rules.town.bank.loan;
    const bp = Math.ceil(left / d.defaultDollarsPerBp);
    expModForceTotal(p, -bp);
    reviewsMod(p, rules, d.reviews);
    karmaMod(p, d.karma);
    l.deadbeat = true;
    refreshRating(turn.rules, p);
    sendPacket(town, p.id, {
      type: "text",
      text: fill(t.loanDefault, { left: intToCash(left), bp }),
    });
  } else {
    sendPacket(town, p.id, {
      type: "text",
      text: fill(t.loanCollected, { money: intToCash(collected) }),
    });
  }
  mailContinue(turn, p.id);
}

/** Section 21, at midnight: interest on savings and loans, then loans past due. */
export function bankMidnight(turn: Turn): void {
  const town = turn.town;
  const s = tr(turn).bank.savings;
  const rate = savingsRate(turn);
  const lrate = loanRate(turn);
  for (const p of activePlayers(town)) {
    const l = lifeOf(town, p);
    if (l.savings > 0) l.savings += Math.floor(Math.min(l.savings, s.capBase) * rate);
    if (!l.loan) continue;
    if (town.day > l.loan.due || tournamentEndsToday(town)) collectLoan(turn, p);
    else l.loan.owed = Math.ceil(l.loan.owed * (1 + lrate));
  }
}

// ---------------------------------------------------------------- 21.1 transfers

function tagValue(turn: Turn, tier: number): number {
  return turn.rules.places.tagValues[tier] ?? 1;
}

/** Section 21.1: the teller's fee on sending `count` tags (of one tier). */
export function transferFee(turn: Turn, count: number): number {
  return Math.ceil(count * tr(turn).bank.transfer.feeShare);
}

function transferRefusal(turn: Turn, to: PlayerState | undefined): string {
  const t = xt(turn).text.bank;
  const tt = tr(turn).bank.transfer;
  const p = turn.player;
  if (!to?.active || !to.expanded || isBlocking(turn.town, to.id, p.id))
    return xt(turn).text.hints.noRivals;
  if (to.id === p.id) return t.transferSelf;
  if (turn.town.day - p.dayCreated < tt.minAccountDays) return t.transferTooNew;
  if (today(turn).sent >= tt.dailyMax) return fill(t.transferLimit, { left: 0 });
  if (lifeOf(turn.town, to).today.received >= tt.dailyMax) return t.transferTheirLimit;
  return "";
}

function transferView(turn: Turn, message = ""): View {
  const t = xt(turn).text.bank;
  const tt = tr(turn).bank.transfer;
  let text = fill(t.transferIntro, {
    sent: today(turn).sent,
    max: tt.dailyMax,
    fee: Math.round(tt.feeShare * 100),
  });
  if (message !== "") text = `${message}\n\n${text}`;
  let pick = button(`${BANK}:transfer`, t.buttons.transfer);
  if (turn.town.day - turn.player.dayCreated < tt.minAccountDays)
    pick = off(pick, t.transferTooNew);
  else if (today(turn).sent >= tt.dailyMax) pick = off(pick, fill(t.transferLimit, { left: 0 }));
  return screen(turn, text, [pick, back(turn)]);
}

function transferPicker(turn: Turn): View {
  const players = turn.town.players
    // A player who blocked the sender is not offered (classic/blocking.ts).
    .filter(
      (q) =>
        q.active &&
        q.expanded &&
        q.id !== turn.player.id &&
        !isBlocking(turn.town, q.id, turn.player.id),
    )
    .map((q) => ({ id: q.id, name: q.name }));
  return {
    ...transferView(turn),
    buttons: [],
    overlay: {
      kind: "playerPicker",
      id: `${BANK}:tpick`,
      prompt: xt(turn).text.bank.transferPick,
      players,
    },
  };
}

function tierView(turn: Turn, to: PlayerState): View {
  const t = xt(turn).text.bank;
  turn.session.sceneData = { to: to.id };
  const buttons: Button[] = [0, 1, 2].map((tier) => {
    const b = button(`${BANK}:ttier:${tier}`, t.buttons[TIERS[tier] as "wood" | "silver" | "gold"]);
    return (turn.player.tags[tier] ?? 0) < 2 ? off(b, t.transferNotEnough) : b;
  });
  buttons.push(button(`${BANK}:transferhome`, t.buttons.back));
  return screen(turn, fill(t.transferTier, { name: to.name }), buttons);
}

function pendingTransfer(turn: Turn): { to: number; tier?: number } {
  const d = turn.session.sceneData;
  if (!d || typeof d !== "object" || Array.isArray(d) || typeof d.to !== "number")
    throw new Error("No transfer");
  return { to: d.to, ...(typeof d.tier === "number" ? { tier: d.tier } : {}) };
}

/**
 * Section 21.1: send `count` tags of one tier. The fee (rounded up) stays at
 * the bank; the receiver gets the rest. Both sides' daily limits count the
 * wood-equivalent value sent. Tags are only ever moved or destroyed.
 */
export function sendTags(turn: Turn, to: PlayerState, tier: number, count: number): string {
  const t = xt(turn).text.bank;
  const tt = tr(turn).bank.transfer;
  const p = turn.player;
  const why = transferRefusal(turn, to);
  if (why !== "") return why;
  const value = tagValue(turn, tier);
  const fee = transferFee(turn, count);
  const room = Math.min(
    tt.dailyMax - today(turn).sent,
    tt.dailyMax - lifeOf(turn.town, to).today.received,
  );
  if (!(count > fee) || count > (p.tags[tier] ?? 0)) return t.transferNotEnough;
  if (count * value > room) return fill(t.transferLimit, { left: Math.floor(room / value) });
  p.tags[tier] = (p.tags[tier] ?? 0) - count;
  to.tags[tier] = (to.tags[tier] ?? 0) + (count - fee);
  today(turn).sent += count * value;
  lifeOf(turn.town, to).today.received += count * value;
  const tierName = TIERS[tier] ?? "wood";
  sendPacket(turn.town, to.id, {
    type: "text",
    text: fill(t.transferMail, { count: count - fee, tier: tierName, name: p.name }),
  });
  mailContinue(turn, to.id);
  return fill(t.transferred, { count: count - fee, tier: tierName, name: to.name, fee });
}

// ---------------------------------------------------------------- the module

function withButtons(turn: Turn, view: View): View {
  const t = xt(turn).text.bank;
  const extra: Button[] = [
    { ...button(`${BANK}:savings`, t.buttons.savings), group: "more" },
    { ...button(`${BANK}:loan`, t.buttons.loan), group: "more" },
    { ...button(`${BANK}:transferhome`, t.buttons.transfer), group: "more" },
  ];
  const leave = view.buttons.findIndex((b) => b.id === "go:map");
  if (leave < 0) return view;
  view.buttons.splice(leave, 0, ...extra);
  view.bank = bankPanel(turn);
  return view;
}

export const expandedBankModule: LocationModule = {
  ...bankModule,
  enter(turn, arg) {
    const view = bankModule.enter?.(turn, arg);
    if (!view) throw new Error("No bank");
    return withButtons(turn, view);
  },
  press(turn, command) {
    const [verb = "", arg = ""] = command.split(":");
    const t = xt(turn).text.bank;
    const l = life(turn);
    switch (verb) {
      case "savings":
        return savingsView(turn);
      case "deposit":
        if (l.loan || turn.player.money <= 0) throw new Error("Cannot deposit");
        return prompt(savingsView(turn), `${BANK}:depositamt`, t.depositPrompt);
      case "withdraw":
        if (l.savings <= 0) throw new Error("Nothing saved");
        return prompt(savingsView(turn), `${BANK}:withdrawamt`, t.withdrawPrompt);
      case "depositall":
        if (l.loan || turn.player.money <= 0) throw new Error("Cannot deposit");
        return deposit(turn, turn.player.money);
      case "withdrawall":
        if (l.savings <= 0) throw new Error("Nothing saved");
        return withdraw(turn, l.savings);
      case "loan":
        return loanView(turn);
      case "borrow":
        if (loanRefusal(turn) !== "") throw new Error("No loan");
        return prompt(loanView(turn), `${BANK}:borrowamt`, t.borrowPrompt);
      case "repay":
        return repay(turn);
      case "transferhome":
        return transferView(turn);
      case "transfer":
        return transferPicker(turn);
      case "ttier": {
        const pending = pendingTransfer(turn);
        const tier = Number(arg);
        if (!(tier >= 0 && tier <= 2)) throw new Error("No such tier");
        const to = turn.town.players[pending.to];
        if (!to || (turn.player.tags[tier] ?? 0) < 2) throw new Error("Not enough tags");
        const view = tierView(turn, to);
        turn.session.sceneData = { to: pending.to, tier };
        return prompt(view, `${BANK}:tcount`, t.transferCount);
      }
    }
    if (!bankModule.press) throw new Error("No bank");
    const view = bankModule.press(turn, command);
    return view.buttons.some((b) => b.id === "go:map") ? withButtons(turn, view) : view;
  },
  submitText(turn, overlayId, text) {
    const amount = text === null ? 0 : Math.trunc(atoi(text));
    switch (overlayId) {
      case `${BANK}:depositamt`:
        return text === null ? savingsView(turn) : deposit(turn, amount);
      case `${BANK}:withdrawamt`:
        return text === null ? savingsView(turn) : withdraw(turn, amount);
      case `${BANK}:borrowamt`:
        return text === null ? loanView(turn) : borrow(turn, amount);
      case `${BANK}:tcount`: {
        const pending = pendingTransfer(turn);
        turn.session.sceneData = null;
        const to = turn.town.players[pending.to];
        if (text === null || !to || pending.tier === undefined) return transferView(turn);
        return transferView(turn, sendTags(turn, to, pending.tier, amount));
      }
    }
    if (!bankModule.submitText) throw new Error("No bank");
    return bankModule.submitText(turn, overlayId, text);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== `${BANK}:tpick`) throw new Error(`Unknown overlay ${overlayId}`);
    const to = playerId === null ? undefined : turn.town.players[playerId];
    if (!to) return transferView(turn);
    const why = transferRefusal(turn, to);
    if (why !== "") return transferView(turn, why);
    return tierView(turn, to);
  },
};
