import type { Side } from "./config";

export type SeriesFormat = 1 | 3 | 5;
export type PlayedGame = { blue: string[]; red: string[]; blueWin: number; winner: Side };
export type Series = { format: SeriesFormat; fearless: boolean; games: PlayedGame[] };

export const newSeries = (format: SeriesFormat, fearless: boolean): Series => ({ format, fearless, games: [] });

export function score(s: Series): Record<Side, number> {
  return {
    blue: s.games.filter((g) => g.winner === "blue").length,
    red: s.games.filter((g) => g.winner === "red").length,
  };
}

export function isOver(s: Series) {
  const sc = score(s);
  return Math.max(sc.blue, sc.red) > s.format / 2;
}

// Fearless (Riot rule, unchanged for 2026): every champion picked in an earlier game of the
// series is unavailable to BOTH teams for the rest of the series. Bans reset each game.
export function lockedChampions(s: Series): string[] {
  return s.fearless ? s.games.flatMap((g) => [...g.blue, ...g.red]) : [];
}

// The draft does not play the game: the series result is drawn from the predicted win chance.
export function recordGame(s: Series, blue: string[], red: string[], blueWin: number, rand = Math.random): Series {
  const winner: Side = rand() < blueWin ? "blue" : "red";
  return { ...s, games: [...s.games, { blue, red, blueWin, winner }] };
}
