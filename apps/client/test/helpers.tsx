import type { Action, View } from "@fq/protocol";
import { render } from "@testing-library/react";
import { App, type AppProps } from "../src/App.js";
import type { ConnectionState, LiveTransport, Notice, Transport } from "../src/transport/types.js";

/** A transport that records what the client sends and answers from a function. */
export class ScriptedTransport implements Transport {
  sent: Action[] = [];
  closed = false;
  private listeners = new Set<(view: View) => void>();

  constructor(
    private readonly first: View,
    private readonly responder: (action: Action) => View | Error = () => this.first,
  ) {}

  connect(): Promise<View> {
    return Promise.resolve(this.first);
  }

  send(action: Action): Promise<View> {
    this.sent.push(action);
    const out = this.responder(action);
    return out instanceof Error ? Promise.reject(out) : Promise.resolve(out);
  }

  onPush(listener: (view: View) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  close(): void {
    this.closed = true;
  }

  push(view: View): void {
    for (const l of this.listeners) l(view);
  }
}

export function renderGame(transport: Transport, props: Partial<AppProps> = {}) {
  return render(
    <App
      transport={transport}
      settings={{ typewriter: "off", layout: "classic", ...props.settings }}
      {...(props.assetBase ? { assetBase: props.assetBase } : {})}
      {...(props.audio ? { audio: props.audio } : {})}
      {...(props.onLeave ? { onLeave: props.onLeave } : {})}
    />,
  );
}

export const viewWith = (view: Partial<View> & Pick<View, "scene">): View => ({
  title: "Test place",
  text: [{ text: "Hello there." }],
  buttons: [],
  ...view,
});

/** A scripted transport with a push channel: tests emit notices and connection changes. */
export class LiveScriptedTransport extends ScriptedTransport implements LiveTransport {
  private noticeListeners = new Set<(notice: Notice) => void>();
  private connectionListeners = new Set<(state: ConnectionState) => void>();

  onNotice(listener: (notice: Notice) => void) {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  onConnection(listener: (state: ConnectionState) => void) {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  notice(notice: Notice): void {
    for (const l of this.noticeListeners) l(notice);
  }

  connection(state: ConnectionState): void {
    for (const l of this.connectionListeners) l(state);
  }
}
