import { START_COUNTDOWN_SECONDS, type Side } from "./draft/config";
import { createDraft, hover, lock, setSwapReady, swapRoles, timeout } from "./draft/machine";
import { arrangeOnSwap, type RoleMap } from "./draft/roles";
import { isOver, lockedChampions, newSeries, recordGame } from "./draft/series";
import type { ClientMsg, RoomView } from "./room";

// Authoritative online room logic, pure so it can be unit tested. party/room.ts only wires it to sockets.
export type Seat = { name: string; token: string; connId: string | null; ready: boolean };
export type RoomState = Omit<RoomView, "players" | "spectators"> & {
  seats: Partial<Record<Side, Seat>>;
  lastActive: number;
};

export const IDLE_MS = 2 * 60 * 60 * 1000; // rooms are wiped after 2 h without activity

export const emptyRoom = (): RoomState => ({
  phase: "empty",
  host: null,
  seats: {},
  startAt: 0,
  series: newSeries(1, false),
  draft: null,
  result: null,
  lastActive: Date.now(),
});

type Ctx = { connId: string; now: number; pool: string[]; roles: RoleMap; rand?: () => number };

const other = (s: Side): Side => (s === "blue" ? "red" : "blue");
export const seatOf = (st: RoomState, connId: string): Side | null =>
  (["blue", "red"] as const).find((s) => st.seats[s]?.connId === connId) ?? null;

function startCountdown(st: RoomState, now: number): RoomState {
  return { ...st, phase: "countdown", startAt: now + START_COUNTDOWN_SECONDS * 1000, draft: null, result: null };
}

export function reduce(st: RoomState, msg: ClientMsg, ctx: Ctx): RoomState {
  const { connId, now } = ctx;
  const name = (n: string) => n.trim().slice(0, 20) || "Joueur";
  st = { ...st, lastActive: now };

  if (msg.t === "create" && st.phase === "empty") {
    const side: Side = msg.side === "random" ? ((ctx.rand ?? Math.random)() < 0.5 ? "blue" : "red") : msg.side;
    return {
      ...st,
      phase: "lobby",
      host: side,
      seats: { [side]: { name: name(msg.name), token: msg.token, connId, ready: false } },
      series: newSeries([1, 3, 5].includes(msg.format) ? msg.format : 1, !!msg.fearless),
    };
  }
  if (msg.t === "create" || msg.t === "join") {
    if (st.phase === "empty") throw new Error("Partie introuvable. Vérifie le code ou crée une nouvelle partie.");
    const mine = (["blue", "red"] as const).find((s) => st.seats[s]?.token === msg.token);
    if (mine) return { ...st, seats: { ...st.seats, [mine]: { ...st.seats[mine]!, connId } } };
    const free = (["blue", "red"] as const).find((s) => !st.seats[s]);
    if (!free) return st; // room full: spectator
    return { ...st, seats: { ...st.seats, [free]: { name: name(msg.name), token: msg.token, connId, ready: false } } };
  }

  const side = seatOf(st, connId);
  if (!side) throw new Error("Tu es spectateur");

  switch (msg.t) {
    case "ready": {
      if (st.phase !== "lobby") return st;
      const seats = { ...st.seats, [side]: { ...st.seats[side]!, ready: true } };
      const next = { ...st, seats };
      return seats.blue?.ready && seats.red?.ready ? startCountdown(next, now) : next;
    }
    case "swapSides": {
      if (st.phase !== "lobby" || st.host !== side) return st;
      const unready = (s?: Seat) => s && { ...s, ready: false };
      return { ...st, host: other(side), seats: { blue: unready(st.seats.red), red: unready(st.seats.blue) } };
    }
    case "hover":
    case "lock":
    case "swap":
    case "swapReady": {
      if (st.phase !== "draft" || !st.draft) return st;
      const d = st.draft;
      const next =
        msg.t === "hover" ? hover(d, side, msg.champ)
        : msg.t === "lock" ? lock(d, side, msg.champ, now)
        : msg.t === "swap" ? swapRoles(d, side, msg.i, msg.j)
        : setSwapReady(d, side);
      return { ...st, draft: arrangeOnSwap(d, next, ctx.roles) };
    }
    case "result": {
      // shortcut: the result comes from a player's browser (it calls /api/analyze); fine between friends.
      if (st.phase !== "draft" || st.draft?.phase !== "done" || st.result) return st;
      const p = msg.result.blueWin;
      if (!(p >= 0 && p <= 1)) throw new Error("Résultat invalide");
      return {
        ...st,
        phase: "result",
        result: msg.result,
        series: recordGame(st.series, st.draft.picks.blue, st.draft.picks.red, p, ctx.rand),
      };
    }
    case "next": {
      if (st.phase !== "result") return st;
      const series = isOver(st.series) ? newSeries(st.series.format, st.series.fearless) : st.series;
      return startCountdown({ ...st, series }, now);
    }
  }
}

// Timers: countdown -> draft, draft deadlines.
export function tick(st: RoomState, now: number, pool: string[], roles: RoleMap): RoomState {
  if (st.phase === "countdown" && now >= st.startAt)
    return { ...st, phase: "draft", draft: createDraft(now, lockedChampions(st.series)) };
  if (st.phase === "draft" && st.draft && st.draft.phase !== "done") {
    const next = timeout(st.draft, now, pool);
    return next === st.draft ? st : { ...st, draft: arrangeOnSwap(st.draft, next, roles) };
  }
  return st;
}

export function nextAlarm(st: RoomState): number {
  if (st.phase === "countdown") return st.startAt;
  if (st.phase === "draft" && st.draft && st.draft.phase !== "done") return st.draft.deadline;
  return st.lastActive + IDLE_MS;
}

export function view(st: RoomState, spectators: number): RoomView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip server-only field
  const { seats, lastActive, ...rest } = st;
  const players: RoomView["players"] = {};
  for (const s of ["blue", "red"] as const) {
    const seat = seats[s];
    if (seat) players[s] = { name: seat.name, connected: !!seat.connId, ready: seat.ready };
  }
  return { ...rest, players, spectators };
}
