import type * as Party from "partykit/server";
import roles from "../data/roles.json";
import type { RoleMap } from "../src/lib/draft/roles";
import type { ClientMsg, ServerMsg } from "../src/lib/room";
import { IDLE_MS, emptyRoom, nextAlarm, reduce, seatOf, tick, view, type RoomState } from "../src/lib/room-server";

const ROLES = roles as RoleMap;
const POOL = Object.keys(ROLES);

// One PartyKit room = one online draft (room id = invite code). The server is the only source of truth.
export default class Room implements Party.Server {
  state: RoomState = emptyRoom();

  constructor(readonly room: Party.Room) {}

  async onStart() {
    this.state = (await this.room.storage.get<RoomState>("state")) ?? emptyRoom();
  }

  onConnect(conn: Party.Connection) {
    this.send(conn);
  }

  onClose(conn: Party.Connection) {
    const side = seatOf(this.state, conn.id);
    if (side) this.commit({ ...this.state, seats: { ...this.state.seats, [side]: { ...this.state.seats[side]!, connId: null } } });
    else this.broadcast();
  }

  onMessage(raw: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    if (typeof raw !== "string" || raw.length > 20_000) return;
    try {
      const msg = JSON.parse(raw) as ClientMsg;
      this.commit(reduce(this.state, msg, { connId: sender.id, now: Date.now(), pool: POOL, roles: ROLES }));
    } catch (e) {
      sender.send(JSON.stringify({ t: "error", msg: e instanceof Error ? e.message : "Action invalide" } satisfies ServerMsg));
    }
  }

  async onAlarm() {
    const now = Date.now();
    const running = this.state.phase === "countdown" || (this.state.phase === "draft" && this.state.draft?.phase !== "done");
    if (!running && now >= this.state.lastActive + IDLE_MS) {
      // Idle for 2 h: forget the room.
      this.state = emptyRoom();
      await this.room.storage.deleteAll();
      return;
    }
    this.commit(tick(this.state, now, POOL, ROLES));
  }

  commit(next: RoomState) {
    const changed = next !== this.state;
    this.state = next;
    if (changed) void this.room.storage.put("state", next);
    if (next.phase !== "empty") void this.room.storage.setAlarm(nextAlarm(next));
    this.broadcast();
  }

  spectators() {
    let n = 0;
    for (const c of this.room.getConnections()) if (!seatOf(this.state, c.id)) n++;
    return n;
  }

  send(conn: Party.Connection, spectators = this.spectators()) {
    const side = seatOf(this.state, conn.id);
    const msg: ServerMsg = { t: "state", room: view(this.state, spectators), you: { side }, serverNow: Date.now() };
    conn.send(JSON.stringify(msg));
  }

  broadcast() {
    const n = this.spectators();
    for (const c of this.room.getConnections()) this.send(c, n);
  }
}
