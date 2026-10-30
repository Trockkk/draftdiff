import type { Side } from "./draft/config";
import type { DraftState } from "./draft/machine";
import type { Series } from "./draft/series";
import type { AnalyzeResult } from "@/components/ResultView";

// No 0/O/1/I so codes are easy to read aloud.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function normalizeCode(s: string) {
  const c = s.trim().toUpperCase();
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}

export type RoomPlayer = { name: string; connected: boolean; ready: boolean };

// What the room server sends to every client (no secrets).
export type RoomView = {
  phase: "empty" | "lobby" | "countdown" | "draft" | "result";
  host: Side | null;
  players: Partial<Record<Side, RoomPlayer>>;
  spectators: number;
  startAt: number;
  series: Series;
  draft: DraftState | null;
  result: AnalyzeResult | null;
};

export type ServerMsg =
  | { t: "state"; room: RoomView; you: { side: Side | null }; serverNow: number }
  | { t: "error"; msg: string };

export type ClientMsg =
  | { t: "create"; name: string; token: string; side: Side | "random"; format: 1 | 3 | 5; fearless: boolean }
  | { t: "join"; name: string; token: string }
  | { t: "ready" }
  | { t: "swapSides" }
  | { t: "hover"; champ: string | null }
  | { t: "lock"; champ: string | null }
  | { t: "swap"; i: number; j: number }
  | { t: "swapReady" }
  | { t: "result"; result: AnalyzeResult }
  | { t: "next" };
