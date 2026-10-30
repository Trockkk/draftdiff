import { ROLES, type Role } from "./config";

// champion id -> roles sorted by pro games played (data/roles.json, from npm run data:update)
export type RoleMap = Record<string, Role[]>;

// Order 5 picks by role (TOP..SUPPORT): each champion goes to its most-played free role.
export function autoRoles(picks: string[], roles: RoleMap): string[] {
  const out: (string | undefined)[] = new Array(5);
  const rest: string[] = [];
  for (let rank = 0; rank < ROLES.length; rank++) {
    for (const c of picks) {
      if (out.includes(c)) continue;
      const role = roles[c]?.[rank];
      const i = role ? ROLES.indexOf(role) : -1;
      if (i >= 0 && !out[i]) out[i] = c;
    }
  }
  for (const c of picks) if (!out.includes(c)) rest.push(c);
  return Array.from(out, (c) => c ?? rest.shift()!);
}

export const mainRole = (c: string, roles: RoleMap): Role | undefined => roles[c]?.[0];

// When the draft enters the role-swap phase, pre-fill each team's roles from pro data.
export function arrangeOnSwap<T extends { phase: string; picks: Record<"blue" | "red", string[]> }>(prev: T, next: T, roles: RoleMap): T {
  if (prev.phase !== "draft" || next.phase !== "swap") return next;
  return { ...next, picks: { blue: autoRoles(next.picks.blue, roles), red: autoRoles(next.picks.red, roles) } };
}
