import { routePartykitRequest, Server, type Connection, type WSMessage } from "partyserver";
import roles from "../data/roles.json";
import type { RoleMap } from "../src/lib/draft/roles";
import type { ClientMsg, ServerMsg } from "../src/lib/room";
import { IDLE_MS, emptyRoom, nextAlarm, reduce, seatOf, tick, view, type RoomState } from "../src/lib/room-server";

const ROLES = roles as RoleMap;
const POOL = Object.keys(ROLES);

// One Durable Object = one online draft (room name = invite code). The server is the only source of truth.
// State is saved on every change, so the room survives hibernation and restarts.
export class Room extends Server {
  static options = { hibernate: true };
  state: RoomState = emptyRoom();

  async onStart() {
    this.state = (await this.ctx.storage.get<RoomState>("state")) ?? emptyRoom();
  }

  onConnect(conn: Connection) {
    this.send(conn);
  }

  onClose(conn: Connection) {
    const side = seatOf(this.state, conn.id);
    if (side) this.commit({ ...this.state, seats: { ...this.state.seats, [side]: { ...this.state.seats[side]!, connId: null } } });
    else this.broadcastState();
  }

  onMessage(sender: Connection, raw: WSMessage) {
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
      // Idle for 2 h: forget the room (keep PartyServer's own __ps_name key).
      this.state = emptyRoom();
      await this.ctx.storage.delete("state");
      return;
    }
    this.commit(tick(this.state, now, POOL, ROLES));
  }

  commit(next: RoomState) {
    const changed = next !== this.state;
    this.state = next;
    if (changed) void this.ctx.storage.put("state", next);
    if (next.phase !== "empty") void this.ctx.storage.setAlarm(nextAlarm(next));
    this.broadcastState();
  }

  spectators() {
    let n = 0;
    for (const c of this.getConnections()) if (!seatOf(this.state, c.id)) n++;
    return n;
  }

  send(conn: Connection, spectators = this.spectators()) {
    const msg: ServerMsg = { t: "state", room: view(this.state, spectators), you: { side: seatOf(this.state, conn.id) }, serverNow: Date.now() };
    conn.send(JSON.stringify(msg));
  }

  broadcastState() {
    const n = this.spectators();
    for (const c of this.getConnections()) this.send(c, n);
  }
}

const worker = {
  async fetch(request: Request, env: Record<string, unknown>) {
    return (await routePartykitRequest(request, env)) || new Response("Not Found", { status: 404 });
  },
};

export default worker;
