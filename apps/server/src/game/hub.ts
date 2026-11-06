import type { ServerMessage } from "../wire.js";

/** What the hub needs from a WebSocket. */
export interface PlayerSocket {
  send(data: string): void;
  close(code: number, reason: string): void;
  /** Bytes queued but not yet written; a slow client is dropped past a limit. */
  readonly bufferedAmount: number;
  readonly ip: string;
}

/** Drop a client that falls this far behind rather than buffer without bound. */
const MAX_BUFFERED = 1_000_000;

export type PresenceListener = (event: {
  townId: string;
  playerId: number;
  /** Sockets now open for this player in this town. */
  sockets: number;
  connected: boolean;
}) => void;

/**
 * Which sockets belong to which player in which town. The hub knows nothing
 * about the game; it routes already-built `ServerMessage`s.
 */
export class Hub {
  private readonly towns = new Map<string, Map<number, Set<PlayerSocket>>>();
  private presence: PresenceListener | null = null;

  /** Called when a player's first socket opens or last one closes. */
  onPresence(listener: PresenceListener | null): void {
    this.presence = listener;
  }

  attach(townId: string, playerId: number, socket: PlayerSocket): () => void {
    let players = this.towns.get(townId);
    if (!players) {
      players = new Map();
      this.towns.set(townId, players);
    }
    let sockets = players.get(playerId);
    if (!sockets) {
      sockets = new Set();
      players.set(playerId, sockets);
    }
    sockets.add(socket);
    if (sockets.size === 1) {
      this.presence?.({ townId, playerId, sockets: 1, connected: true });
    }
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      const set = this.towns.get(townId)?.get(playerId);
      if (!set?.delete(socket)) return;
      if (set.size === 0) {
        this.towns.get(townId)?.delete(playerId);
        this.presence?.({ townId, playerId, sockets: 0, connected: false });
      }
    };
  }

  sendTo(townId: string, playerId: number, message: ServerMessage): void {
    const sockets = this.towns.get(townId)?.get(playerId);
    if (!sockets) return;
    const data = JSON.stringify(message);
    for (const socket of sockets) this.write(socket, data);
  }

  /** To every connected player in the town. */
  broadcast(townId: string, message: ServerMessage): void {
    const players = this.towns.get(townId);
    if (!players) return;
    const data = JSON.stringify(message);
    for (const sockets of players.values()) for (const socket of sockets) this.write(socket, data);
  }

  closePlayer(townId: string, playerId: number, code: number, reason: string): void {
    const sockets = this.towns.get(townId)?.get(playerId);
    if (!sockets) return;
    for (const socket of [...sockets]) socket.close(code, reason);
  }

  closeTown(townId: string, code: number, reason: string): void {
    const players = this.towns.get(townId);
    if (!players) return;
    for (const sockets of [...players.values()]) {
      for (const socket of [...sockets]) socket.close(code, reason);
    }
  }

  closeAll(code: number, reason: string): void {
    for (const townId of [...this.towns.keys()]) this.closeTown(townId, code, reason);
  }

  /** Closes sockets whose address `matches`, for a new IP ban. Returns how many. */
  closeWhere(matches: (ip: string) => boolean, code: number, reason: string): number {
    let n = 0;
    for (const players of this.towns.values()) {
      for (const sockets of players.values()) {
        for (const socket of [...sockets]) {
          if (matches(socket.ip)) {
            socket.close(code, reason);
            n++;
          }
        }
      }
    }
    return n;
  }

  connectedPlayers(townId: string): number[] {
    return [...(this.towns.get(townId)?.keys() ?? [])];
  }

  socketCount(townId?: string): number {
    let n = 0;
    for (const [id, players] of this.towns) {
      if (townId !== undefined && id !== townId) continue;
      for (const sockets of players.values()) n += sockets.size;
    }
    return n;
  }

  private write(socket: PlayerSocket, data: string): void {
    if (socket.bufferedAmount > MAX_BUFFERED) {
      socket.close(1013, "too slow");
      return;
    }
    try {
      socket.send(data);
    } catch {
      // The socket is closing; its close handler detaches it.
    }
  }
}
