import { migrateSave, summarize } from "./saves.js";
import type { SaveSummary, SoloSave } from "./types.js";

/** Where saves live. Slots are any short names ("autosave", "slot-1"). */
export interface SaveStorage {
  list(): Promise<SaveSummary[]>;
  read(slot: string): Promise<SoloSave | null>;
  write(slot: string, save: SoloSave): Promise<void>;
  remove(slot: string): Promise<void>;
}

/** Saves in memory (tests, or a session that should not persist). Stored as JSON text, like a real store. */
export class MemorySaveStorage implements SaveStorage {
  private readonly slots = new Map<string, string>();

  async list(): Promise<SaveSummary[]> {
    return [...this.slots]
      .map(([slot, text]) => summarize(slot, JSON.parse(text) as SoloSave))
      .sort(bySavedAt);
  }

  async read(slot: string): Promise<SoloSave | null> {
    const text = this.slots.get(slot);
    return text === undefined ? null : migrateSave(JSON.parse(text));
  }

  async write(slot: string, save: SoloSave): Promise<void> {
    this.slots.set(slot, JSON.stringify(save));
  }

  async remove(slot: string): Promise<void> {
    this.slots.delete(slot);
  }
}

function bySavedAt(a: SaveSummary, b: SaveSummary): number {
  return b.savedAt - a.savedAt || a.slot.localeCompare(b.slot);
}

const STORE = "saves";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves in the browser's IndexedDB: one object store, keyed by slot, holding
 * `{ slot, summary, save }`. Works in a page or a Web Worker.
 */
export class IndexedDbSaveStorage implements SaveStorage {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly options: { name?: string; factory?: IDBFactory } = {}) {}

  private open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    const factory = this.options.factory ?? globalThis.indexedDB;
    if (!factory) return Promise.reject(new Error("IndexedDB is not available here."));
    const req = factory.open(this.options.name ?? "funeral-quest-solo", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "slot" });
      }
    };
    this.db = request(req);
    return this.db;
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async list(): Promise<SaveSummary[]> {
    const rows = (await request((await this.store("readonly")).getAll())) as {
      summary: SaveSummary;
    }[];
    return rows.map((r) => r.summary).sort(bySavedAt);
  }

  async read(slot: string): Promise<SoloSave | null> {
    const row = (await request((await this.store("readonly")).get(slot))) as
      | { save: string }
      | undefined;
    return row ? migrateSave(JSON.parse(row.save)) : null;
  }

  async write(slot: string, save: SoloSave): Promise<void> {
    // Stored as text so the shape stays exactly the JSON an export writes.
    await request(
      (await this.store("readwrite")).put({
        slot,
        summary: summarize(slot, save),
        save: JSON.stringify(save),
      }),
    );
  }

  async remove(slot: string): Promise<void> {
    await request((await this.store("readwrite")).delete(slot));
  }

  /** Closes the database connection. */
  async close(): Promise<void> {
    if (!this.db) return;
    (await this.db).close();
    this.db = null;
  }
}
