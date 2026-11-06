import type { Action, ChatLine, RichText, View } from "@fq/protocol";
import type { Transport, Unsubscribe } from "../transport/types.js";
import {
  ALL_FIXTURES,
  CHAT_SEED,
  FIXTURES,
  HUD,
  negotiation,
  news,
  OVERLAY_FIXTURES,
  PLACES,
} from "./fixtures.js";

export interface MockOptions {
  /** Artificial delay for connect and send. Default 120. Use 0 in tests. */
  latencyMs?: number;
  /** How often a rival "speaks" in the cafe. Default 9000; 0 turns pushes off. */
  pushIntervalMs?: number;
  /** Start on this fixture (a key of ALL_FIXTURES) instead of the lobby; for the dev server. */
  start?: string;
}

const sp = (text: string, color?: "white" | "yellow" | "purple" | "green" | "cyan") =>
  color ? { text, color } : { text };

const RIVAL_LINES = [
  "business is slow, who died?",
  "I heard the hospital is full tonight",
  "silver tags are going to the moon",
  "does anyone know where Gravy buried the hearse?",
];

/**
 * A scripted stand-in for the server. It walks a fixed graph of fixture Views in response to
 * actions and enforces the one rule the real server also enforces: an action must match a
 * button or overlay the last View offered. It has no game logic. To use a real server,
 * implement `Transport` over HTTP and WebSocket and pass it to `<App>` in `main.tsx`.
 */
export class MockTransport implements Transport {
  private current: View = FIXTURES.lobby;
  private listeners = new Set<(view: View) => void>();
  private chat: ChatLine[] = [...CHAT_SEED];
  private place = "";
  private negotiationStep = 0;
  private strikes = 0;
  private open = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private rivalIndex = 0;
  private readonly latency: number;
  private readonly pushEvery: number;
  private readonly start: View;

  constructor(options: MockOptions = {}) {
    this.latency = options.latencyMs ?? 120;
    this.pushEvery = options.pushIntervalMs ?? 9000;
    this.start = (options.start && ALL_FIXTURES[options.start]) || FIXTURES.lobby;
  }

  connect(): Promise<View> {
    this.open = true;
    this.current = this.start;
    this.chat = [...CHAT_SEED];
    this.negotiationStep = 0;
    this.strikes = 0;
    return this.delay(() => this.current);
  }

  send(action: Action): Promise<View> {
    if (!this.open) return Promise.reject(new Error("not connected"));
    return this.delay(() => {
      const next = this.route(action);
      this.current = next;
      this.syncPush();
      return next;
    });
  }

  onPush(listener: (view: View) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.open = false;
    this.stopPush();
  }

  /** Pushes a view as if the server had sent it unprompted. Handy from the dev console. */
  push(view: View): void {
    this.current = view;
    for (const l of this.listeners) l(view);
  }

  private delay<T>(make: () => T): Promise<T> {
    if (this.latency <= 0) return Promise.resolve().then(make);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(make());
        } catch (e) {
          reject(e);
        }
      }, this.latency);
    });
  }

  private cafeView(): View {
    return { ...FIXTURES.cafe, chat: [...this.chat] };
  }

  private syncPush(): void {
    if (this.current.scene === "cafe") this.startPush();
    else this.stopPush();
  }

  private startPush(): void {
    if (this.timer || this.pushEvery <= 0) return;
    this.timer = setInterval(() => {
      if (!this.open || this.current.scene !== "cafe") return;
      const line = RIVAL_LINES[this.rivalIndex++ % RIVAL_LINES.length] ?? "";
      this.chat.push({ text: [sp("Skelly", "white"), sp(`: ${line}`, "yellow")] });
      this.push(this.cafeView());
    }, this.pushEvery);
  }

  private stopPush(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private placeView(placeId: string): View {
    const label = PLACES.find((p) => p.id === placeId)?.label ?? placeId;
    this.place = placeId;
    return {
      scene: "location",
      title: label,
      note: [
        sp(
          `You arrive at ${label}. Nothing much is happening, which in Deathville is its own kind of news.`,
        ),
      ],
      text: [sp("You look around for a while.")],
      picture: { bg: "places/palors" },
      hud: HUD,
      buttons: [
        { id: "look", label: "Look" },
        { id: "leave", label: "Leave" },
      ],
    };
  }

  /** The fixed script. Throws when the action does not match what the last View offered. */
  private route(action: Action): View {
    const view = this.current;
    const overlay = view.overlay;

    if (action.type === "chat") {
      if (view.scene !== "cafe") throw new Error("no chat here");
      this.chat.push({ text: [sp("You", "white"), sp(`: ${action.text}`, "yellow")] });
      return this.cafeView();
    }

    if (action.type === "visit") {
      if (!view.map?.some((p) => p.id === action.placeId)) throw new Error("unknown place");
      if (action.placeId === "store") return FIXTURES.shop;
      if (action.placeId === "cafe") return this.cafeView();
      return this.placeView(action.placeId);
    }

    if (action.type === "submitText") {
      if (overlay?.kind !== "textInput" || overlay.id !== action.overlayId)
        throw new Error("no such prompt");
      if (overlay.id === "name") return action.text ? FIXTURES.news : FIXTURES.lobby;
      if (!action.text) return news("front", false);
      return {
        ...news("front", false),
        overlay: {
          kind: "message",
          id: "msg1",
          text: [
            sp("Your announcement is on the front page: "),
            sp(action.text.slice(0, 80), "cyan"),
          ] satisfies RichText,
        },
      };
    }

    if (action.type === "pickPlayer") {
      if (overlay?.kind !== "playerPicker" || overlay.id !== action.overlayId)
        throw new Error("no such picker");
      if (action.playerId === null) return FIXTURES.rankings;
      this.strikes = 0;
      return FIXTURES.battle;
    }

    if (action.type === "confirm") {
      if (overlay?.kind !== "confirm" || overlay.id !== action.overlayId)
        throw new Error("no such question");
      if (!action.accepted) return FIXTURES.shop;
      return {
        ...FIXTURES.shop,
        overlay: {
          kind: "message",
          id: "msg2",
          text: [
            sp("The clerk hands over your tag. "),
            sp("Thank you for shopping at Di-Mart.", "yellow"),
          ],
        },
        sounds: ["cash"],
      };
    }

    if (action.type === "dismiss") {
      if (overlay?.kind !== "message" || overlay.id !== action.overlayId)
        throw new Error("no such message");
      const { overlay: _gone, ...rest } = view;
      return rest;
    }

    if (action.type === "exit") return view;

    // press
    const button = view.buttons.find((b) => b.id === action.buttonId);
    if (!button || button.enabled === false) throw new Error("no such button");
    return this.press(view, action.buttonId);
  }

  private press(view: View, id: string): View {
    switch (view.scene) {
      case "lobby":
        if (id === "login") return OVERLAY_FIXTURES.textInputSingle;
        if (id === "guest") return FIXTURES.news;
        return {
          ...FIXTURES.lobby,
          overlay: {
            kind: "message",
            id: "msg3",
            text: [sp("New players are not open in this demo. Try Play As Guest.")],
          },
        };
      case "news":
        if (id === "continue") return FIXTURES.desk;
        if (id === "crime") return FIXTURES.newsCrime;
        if (id === "front") return FIXTURES.news;
        if (id === "yesterday")
          return view.news?.isYesterday ? FIXTURES.news : FIXTURES.newsYesterday;
        return OVERLAY_FIXTURES.textInput;
      case "desk":
        if (id === "wait") return FIXTURES.wait;
        if (id === "map") return FIXTURES.map;
        if (id === "cafe") return this.cafeView();
        if (id === "stats") return FIXTURES.stats;
        return FIXTURES.rankings;
      case "map":
        return FIXTURES.desk;
      case "cafe":
        return FIXTURES.map;
      case "stats":
        return FIXTURES.desk;
      case "rankings":
        return id === "attack" ? OVERLAY_FIXTURES.playerPicker : FIXTURES.desk;
      case "location":
        return this.pressLocation(view, id);
    }
  }

  private pressLocation(view: View, id: string): View {
    if (view.battle) {
      if (id === "flee") {
        return {
          ...FIXTURES.desk,
          overlay: {
            kind: "message",
            id: "msg4",
            text: [sp("You ran away like a coward. Skelly laughs behind you.")],
          },
        };
      }
      this.strikes++;
      if (this.strikes >= 3) {
        return {
          ...FIXTURES.rankings,
          overlay: {
            kind: "message",
            id: "msg5",
            text: [sp("Skelly goes down. You are the talk of Deathville.", "yellow")],
          },
          sounds: ["gong"],
        };
      }
      const them = Math.max(0, 51 - this.strikes * 20);
      return {
        ...FIXTURES.battle,
        text: [sp(id === "dodge" ? "You dodge and Skelly stumbles." : "You land a solid blow.")],
        battle: {
          me: { name: "You", hp: 42 - this.strikes * 7, hpMax: 60 },
          them: { name: "Skelly", hp: them, hpMax: 60 },
        },
        sounds: ["thump"],
      };
    }
    if (view.customer) {
      if (id === "done") return OVERLAY_FIXTURES.message;
      this.negotiationStep++;
      return negotiation(this.negotiationStep % 3);
    }
    if (view.title === "Waiting") {
      if (id === "meet") {
        this.negotiationStep = 0;
        return FIXTURES.negotiation;
      }
      return FIXTURES.desk;
    }
    if (view.title === "Di-Mart") {
      if (id === "buy") return OVERLAY_FIXTURES.confirm;
      if (id === "look")
        return {
          ...FIXTURES.shop,
          text: [sp("Shelves of lilies, scratch-off tickets and one very tired clerk.")],
        };
      return FIXTURES.map;
    }
    // generic place
    if (id === "look")
      return { ...view, text: [sp("You look closer. Dust, mostly, and a faint smell of lilies.")] };
    return this.place ? FIXTURES.map : FIXTURES.desk;
  }
}
