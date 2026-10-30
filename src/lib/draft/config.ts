// Single source of truth for tournament draft timing and order.
export type Side = "blue" | "red";
export type ActionType = "ban" | "pick";
export type Step = { side: Side; type: ActionType };

export const ACTION_SECONDS = 30;
export const ROLE_SWAP_SECONDS = 30;
export const START_COUNTDOWN_SECONDS = 3;

export const ROLES = ["TOP", "JUNGLE", "MID", "BOT", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

const b = (type: ActionType): Step => ({ side: "blue", type });
const r = (type: ActionType): Step => ({ side: "red", type });

// Official pro tournament draft (20 actions).
export const DRAFT_ORDER: Step[] = [
  // Ban phase 1: B1 R1 B2 R2 B3 R3
  b("ban"), r("ban"), b("ban"), r("ban"), b("ban"), r("ban"),
  // Pick phase 1: B1, R1 R2, B2 B3, R3
  b("pick"), r("pick"), r("pick"), b("pick"), b("pick"), r("pick"),
  // Ban phase 2: R4 B4 R5 B5
  r("ban"), b("ban"), r("ban"), b("ban"),
  // Pick phase 2: R4, B4 B5, R5
  r("pick"), b("pick"), b("pick"), r("pick"),
];
