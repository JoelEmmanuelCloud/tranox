import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

type LockRecord = { id: string; name: string; owner: string; heartbeat_at: string };

export type LockStore = {
  find(name: string): Promise<LockRecord | null>;
  get(id: string): Promise<LockRecord | null>;
  create(rec: Omit<LockRecord, "id">): Promise<LockRecord | null>;
  touch(id: string, heartbeatAt: string): Promise<void>;
  remove(id: string): Promise<void>;
};

export function createLease(store: LockStore, name: string, ttlMs: number, now: () => number = Date.now) {
  const owner = `${hostname()}:${process.pid}:${randomUUID()}`;
  let heldId: string | undefined;

  async function acquire(): Promise<boolean> {
    const existing = await store.find(name);
    if (existing) {
      if (existing.owner === owner) {
        heldId = existing.id;
        await store.touch(existing.id, new Date(now()).toISOString());
        return true;
      }
      const beat = Date.parse(existing.heartbeat_at);
      if (!Number.isNaN(beat) && now() - beat < ttlMs) return false;
      await store.remove(existing.id);
    }
    const created = await store.create({ name, owner, heartbeat_at: new Date(now()).toISOString() });
    if (!created) return false;
    heldId = created.id;
    return true;
  }

  async function hold(): Promise<boolean> {
    if (!heldId) return acquire();
    const current = await store.get(heldId);
    if (!current || current.owner !== owner) {
      heldId = undefined;
      return acquire();
    }
    await store.touch(heldId, new Date(now()).toISOString());
    return true;
  }

  async function release(): Promise<void> {
    if (!heldId) return;
    const current = await store.get(heldId);
    if (current && current.owner === owner) await store.remove(heldId);
    heldId = undefined;
  }

  return { owner, hold, release };
}
