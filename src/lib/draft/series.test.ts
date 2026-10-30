import { describe, expect, it } from "vitest";
import { autoRoles } from "./roles";
import { isOver, lockedChampions, newSeries, recordGame, score } from "./series";

describe("series", () => {
  it("fearless locks previous picks for both teams, Bo3 ends at 2 wins", () => {
    let s = newSeries(3, true);
    s = recordGame(s, ["A", "B", "C", "D", "E"], ["F", "G", "H", "I", "J"], 0.6, () => 0.1);
    expect(lockedChampions(s)).toHaveLength(10);
    expect(isOver(s)).toBe(false);
    s = recordGame(s, ["K", "L", "M", "N", "O"], ["P", "Q", "R", "S", "T"], 0.6, () => 0.1);
    expect(score(s)).toEqual({ blue: 2, red: 0 });
    expect(isOver(s)).toBe(true);
    expect(lockedChampions({ ...s, fearless: false })).toEqual([]);
  });

  it("autoRoles places champions on their main role", () => {
    const roles = { Jinx: ["BOT"], Leona: ["SUPPORT"], Gnar: ["TOP"], Hwei: ["MID", "SUPPORT"], Vi: ["JUNGLE"] } as const;
    expect(autoRoles(["Hwei", "Leona", "Jinx", "Vi", "Gnar"], roles as never)).toEqual(["Gnar", "Vi", "Hwei", "Jinx", "Leona"]);
    expect(autoRoles(["X", "Y", "Jinx", "Z", "W"], roles as never)).toEqual(["X", "Y", "Z", "Jinx", "W"]);
  });
});
