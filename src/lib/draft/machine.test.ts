import { describe, expect, it } from "vitest";
import { ACTION_SECONDS, DRAFT_ORDER } from "./config";
import { createDraft, currentStep, hover, isAvailable, lock, setSwapReady, swapRoles, timeout } from "./machine";

const pool = Array.from({ length: 40 }, (_, i) => `C${i}`);

function playAll() {
  let s = createDraft(0);
  DRAFT_ORDER.forEach((step, i) => {
    s = lock(s, step.side, `C${i}`, 0);
  });
  return s;
}

describe("draft machine", () => {
  it("follows the official 20-step order", () => {
    expect(DRAFT_ORDER).toHaveLength(20);
    expect(DRAFT_ORDER.filter((x) => x.type === "ban")).toHaveLength(10);
    const s = playAll();
    expect(s.phase).toBe("swap");
    expect(s.bans.blue).toEqual(["C0", "C2", "C4", "C13", "C15"]);
    expect(s.bans.red).toEqual(["C1", "C3", "C5", "C12", "C14"]);
    expect(s.picks.blue).toEqual(["C6", "C9", "C10", "C17", "C18"]);
    expect(s.picks.red).toEqual(["C7", "C8", "C11", "C16", "C19"]);
  });

  it("rejects wrong side and unavailable champions", () => {
    let s = createDraft(0, ["C39"]);
    expect(() => lock(s, "red", "C1", 0)).toThrow();
    expect(() => lock(s, "blue", "C39", 0)).toThrow(); // Fearless locked
    s = lock(s, "blue", "C1", 0);
    expect(() => lock(s, "red", "C1", 0)).toThrow();
    expect(isAvailable(s, "C1")).toBe(false);
  });

  it("timeout: locks hovered, else no ban, else random pick", () => {
    let s = createDraft(0);
    expect(timeout(s, 1000, pool)).toBe(s); // not expired
    s = hover(s, "blue", "C5");
    s = timeout(s, ACTION_SECONDS * 1000, pool);
    expect(s.bans.blue).toEqual(["C5"]);
    s = timeout(s, s.deadline, pool);
    expect(s.bans.red).toEqual([null]);
    for (let i = 0; i < 4; i++) s = lock(s, currentStep(s)!.side, `X${i}`, 0);
    expect(currentStep(s)).toEqual({ side: "blue", type: "pick" });
    s = timeout(s, s.deadline, pool, () => 0);
    expect(s.picks.blue).toEqual(["C0"]);
  });

  it("role swap then done", () => {
    let s = playAll();
    s = swapRoles(s, "blue", 0, 4);
    expect(s.picks.blue[0]).toBe("C18");
    s = setSwapReady(s, "blue");
    expect(swapRoles(s, "blue", 0, 1)).toBe(s); // locked after ready
    expect(s.phase).toBe("swap");
    expect(setSwapReady(s, "red").phase).toBe("done");
    expect(timeout(s, s.deadline, pool).phase).toBe("done");
  });
});
