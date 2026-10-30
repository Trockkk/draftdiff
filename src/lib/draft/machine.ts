import { ACTION_SECONDS, DRAFT_ORDER, ROLE_SWAP_SECONDS, type Side, type Step } from "./config";

// Pure draft state machine: no React, no network. Used by the browser (sandbox / vs IA)
// and by the online room server, which is the authority in online games.
export type DraftState = {
  phase: "draft" | "swap" | "done";
  step: number; // index in DRAFT_ORDER while phase === "draft"
  bans: Record<Side, (string | null)[]>; // null = no ban (timer ran out)
  picks: Record<Side, string[]>; // during "swap" and after: index = role (TOP..SUPPORT)
  hover: Record<Side, string | null>;
  swapReady: Record<Side, boolean>;
  deadline: number; // epoch ms
  locked: string[]; // Fearless: champions picked earlier in the series, unavailable to both teams
};

export function createDraft(now: number, locked: string[] = []): DraftState {
  return {
    phase: "draft",
    step: 0,
    bans: { blue: [], red: [] },
    picks: { blue: [], red: [] },
    hover: { blue: null, red: null },
    swapReady: { blue: false, red: false },
    deadline: now + ACTION_SECONDS * 1000,
    locked,
  };
}

export function currentStep(s: DraftState): Step | null {
  return s.phase === "draft" ? DRAFT_ORDER[s.step] : null;
}

export function isAvailable(s: DraftState, champ: string): boolean {
  const used = [...s.bans.blue, ...s.bans.red, ...s.picks.blue, ...s.picks.red, ...s.locked];
  return !used.includes(champ);
}

export function hover(s: DraftState, side: Side, champ: string | null): DraftState {
  const step = currentStep(s);
  if (!step || step.side !== side) return s;
  if (champ && !isAvailable(s, champ)) return s;
  return { ...s, hover: { ...s.hover, [side]: champ } };
}

// champ === null means "no ban" (only valid for bans).
export function lock(s: DraftState, side: Side, champ: string | null, now: number): DraftState {
  const step = currentStep(s);
  if (!step || step.side !== side) throw new Error("Ce n'est pas ton tour");
  if (champ === null && step.type === "pick") throw new Error("Choisis un champion");
  if (champ !== null && !isAvailable(s, champ)) throw new Error("Champion indisponible");

  const next: DraftState = {
    ...s,
    bans: { ...s.bans },
    picks: { ...s.picks },
    hover: { blue: null, red: null },
  };
  if (step.type === "ban") next.bans[side] = [...s.bans[side], champ];
  else next.picks[side] = [...s.picks[side], champ as string];

  next.step = s.step + 1;
  if (next.step >= DRAFT_ORDER.length) {
    next.phase = "swap";
    next.deadline = now + ROLE_SWAP_SECONDS * 1000;
  } else {
    next.deadline = now + ACTION_SECONDS * 1000;
  }
  return next;
}

// Timer ran out: hovered champion is locked, else no ban / random available pick (like the client).
export function timeout(s: DraftState, now: number, pool: string[], rand = Math.random): DraftState {
  if (now < s.deadline) return s;
  if (s.phase === "swap") return { ...s, phase: "done" };
  const step = currentStep(s);
  if (!step) return s;
  const hovered = s.hover[step.side];
  if (hovered && isAvailable(s, hovered)) return lock(s, step.side, hovered, now);
  if (step.type === "ban") return lock(s, step.side, null, now);
  const free = pool.filter((c) => isAvailable(s, c));
  return lock(s, step.side, free[Math.floor(rand() * free.length)], now);
}

// Role swap phase: exchange two of a team's champions (indexes are roles).
export function swapRoles(s: DraftState, side: Side, i: number, j: number): DraftState {
  const picks = s.picks[side];
  if (s.phase !== "swap" || s.swapReady[side] || !picks[i] || !picks[j]) return s;
  const next = [...picks];
  [next[i], next[j]] = [next[j], next[i]];
  return { ...s, picks: { ...s.picks, [side]: next } };
}

export function setSwapReady(s: DraftState, side: Side): DraftState {
  if (s.phase !== "swap") return s;
  const swapReady = { ...s.swapReady, [side]: true };
  return { ...s, swapReady, phase: swapReady.blue && swapReady.red ? "done" : "swap" };
}
