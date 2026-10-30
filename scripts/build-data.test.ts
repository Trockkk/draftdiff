import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fit, parseGames } from "./build-data";

describe("Oracle's Elixir parsing", () => {
  it("reads picks by role, bans and winner", () => {
    const csv = readFileSync("test/fixtures/oe-sample.csv", "utf8");
    const toId = (n: string) => n.replace(/[^A-Za-z]/g, "");
    const [g] = parseGames(csv, toId);
    expect(g.league).toBe("LFL2");
    expect(g.blue).toEqual(["Gnar", "Maokai", "Hwei", "Jinx", "Leona"]);
    expect(g.red).toEqual(["Renekton", "Ivern", "Orianna", "Varus", "Braum"]);
    expect(g.bans).toContain("KSante");
    expect(g.blueWin).toBe(false);
  });

  it("logistic fit recovers the sign of a real signal", () => {
    const data = Array.from({ length: 400 }, (_, i) => {
      const x = (i % 20) / 10 - 1;
      return { x: [1, x, 0, 0, 0], y: x + ((i * 7919) % 13) / 13 - 0.5 > 0 ? 1 : 0 };
    });
    expect(fit(data).champ).toBeGreaterThan(0.5);
  });
});
