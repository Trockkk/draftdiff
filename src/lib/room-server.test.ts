import { describe, expect, it } from "vitest";
import { DRAFT_ORDER } from "./draft/config";
import { emptyRoom, reduce, seatOf, tick, view, type RoomState } from "./room-server";

const pool = Array.from({ length: 60 }, (_, i) => `C${i}`);
const ctx = (connId: string, now = 0) => ({ connId, now, pool, roles: {} });

function lobby() {
  let st = reduce(emptyRoom(), { t: "create", name: "Host", token: "th", side: "blue", format: 3, fearless: true }, ctx("a"));
  st = reduce(st, { t: "join", name: "Friend", token: "tf" }, ctx("b"));
  return st;
}

describe("online room", () => {
  it("rejects joining a room that was never created", () => {
    expect(() => reduce(emptyRoom(), { t: "join", name: "x", token: "t" }, ctx("a"))).toThrow(/introuvable/);
  });

  it("seats host and friend, third visitor is spectator, reconnect by token", () => {
    let st = lobby();
    expect(seatOf(st, "a")).toBe("blue");
    expect(seatOf(st, "b")).toBe("red");
    st = reduce(st, { t: "join", name: "Spec", token: "ts" }, ctx("c"));
    expect(seatOf(st, "c")).toBeNull();
    expect(() => reduce(st, { t: "ready" }, ctx("c"))).toThrow();
    st = reduce(st, { t: "join", name: "Friend", token: "tf" }, ctx("b2"));
    expect(seatOf(st, "b2")).toBe("red");
    expect(view(st, 1).players.red?.name).toBe("Friend");
    expect(JSON.stringify(view(st, 1))).not.toContain("tf"); // tokens never leave the server
  });

  it("host can swap sides in lobby", () => {
    const st = reduce(lobby(), { t: "swapSides" }, ctx("a"));
    expect(seatOf(st, "a")).toBe("red");
    expect(st.host).toBe("red");
  });

  it("full flow: ready, countdown, draft with turn checks, result, fearless next game", () => {
    let st: RoomState = reduce(lobby(), { t: "ready" }, ctx("a"));
    expect(st.phase).toBe("lobby");
    st = reduce(st, { t: "ready" }, ctx("b", 1000));
    expect(st.phase).toBe("countdown");
    st = tick(st, st.startAt, pool, {});
    expect(st.phase).toBe("draft");
    expect(() => reduce(st, { t: "lock", champ: "C0" }, ctx("b"))).toThrow(); // red can't act on blue's turn

    DRAFT_ORDER.forEach((step, i) => {
      st = reduce(st, { t: "lock", champ: `C${i}` }, ctx(step.side === "blue" ? "a" : "b"));
    });
    expect(st.draft?.phase).toBe("swap");
    st = reduce(st, { t: "swapReady" }, ctx("a"));
    st = reduce(st, { t: "swapReady" }, ctx("b"));
    expect(st.draft?.phase).toBe("done");

    const result = { blueWin: 0.7, factors: [], analysis: {} as never, ai: false };
    st = reduce(st, { t: "result", result }, { ...ctx("b"), rand: () => 0.1 });
    expect(st.phase).toBe("result");
    expect(st.series.games[0].winner).toBe("blue");

    st = reduce(st, { t: "next" }, ctx("a", 5000));
    st = tick(st, st.startAt, pool, {});
    expect(st.draft?.locked).toHaveLength(10); // Fearless
  });
});
