import { ROLES } from "./config";
import { currentStep, isAvailable, type DraftState } from "./machine";
import { mainRole, type RoleMap } from "./roles";
import { logit, matchupRate } from "../predict/model";
import type { ProData } from "../predict/types";

// Draft bot for "Solo vs IA": bans high-presence champions, picks strong champions for
// its missing roles and counters the enemy champion already known in that role.
export function aiChoice(s: DraftState, data: ProData, roles: RoleMap, rand = Math.random): string {
  const step = currentStep(s)!;
  const enemy = step.side === "blue" ? "red" : "blue";
  const free = Object.keys(data.champions).filter((c) => isAvailable(s, c));
  const presence = (c: string) => data.champions[c].picks + data.champions[c].bans;

  let scored: [string, number][];
  if (step.type === "ban") {
    scored = free.map((c) => [c, presence(c)]);
  } else {
    const taken = s.picks[step.side].map((c) => mainRole(c, roles));
    const open = ROLES.filter((r) => !taken.includes(r));
    scored = free.flatMap((c): [string, number][] => {
      const role = mainRole(c, roles) ?? (Object.keys(roles).length ? undefined : open[0]);
      if (!role || !open.includes(role)) return [];
      const rec = data.champions[c].roles[role];
      let v = logit(((rec?.w ?? 0) + 5) / ((rec?.g ?? 0) + 10)) + 0.15 * Math.log1p(presence(c));
      const opp = s.picks[enemy].find((e) => mainRole(e, roles) === role);
      if (opp) v += logit(matchupRate(data, role, c, opp).wr);
      return [[c, v]];
    });
    if (!scored.length) scored = free.map((c) => [c, presence(c)]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  // Pick among the top 3 so two games against the bot are not identical.
  const top = scored.slice(0, 3);
  return top[Math.floor(rand() * top.length)][0];
}
