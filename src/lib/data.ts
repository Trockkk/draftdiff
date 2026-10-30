import pro from "../../data/pro.json";
import roles from "../../data/roles.json";
import type { RoleMap } from "./draft/roles";
import type { ProData } from "./predict/types";

export const PRO = pro as unknown as ProData;
export const ROLE_MAP = roles as RoleMap;
export const CHAMPION_IDS = Object.keys(PRO.champions).sort((a, b) => PRO.champions[a].name.localeCompare(PRO.champions[b].name));

export const champImg = (id: string) => `https://ddragon.leagueoflegends.com/cdn/${PRO.meta.ddragonVersion}/img/champion/${id}.png`;
export const champName = (id: string | null | undefined) => (id ? (PRO.champions[id]?.name ?? id) : "");

export function champStats(id: string) {
  const c = PRO.champions[id];
  const games = PRO.meta.games || 1;
  const played = Object.values(c.roles).reduce((s, r) => ({ g: s.g + (r?.g ?? 0), w: s.w + (r?.w ?? 0) }), { g: 0, w: 0 });
  return {
    pickRate: c.picks / games,
    banRate: c.bans / games,
    presence: (c.picks + c.bans) / games,
    winrate: played.g ? played.w / played.g : null,
  };
}

export const splashImg = (id: string) => `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`;
export const mapImg = () => `https://ddragon.leagueoflegends.com/cdn/${PRO.meta.ddragonVersion}/img/map/map11.png`;
