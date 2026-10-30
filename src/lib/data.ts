import pro from "../../data/pro.json";
import roles from "../../data/roles.json";
import type { RoleMap } from "./draft/roles";
import type { ProData } from "./predict/types";

export const PRO = pro as unknown as ProData;
export const ROLE_MAP = roles as RoleMap;
export const CHAMPION_IDS = Object.keys(PRO.champions).sort((a, b) => PRO.champions[a].name.localeCompare(PRO.champions[b].name));

export const champImg = (id: string) => `https://ddragon.leagueoflegends.com/cdn/${PRO.meta.ddragonVersion}/img/champion/${id}.png`;
export const champName = (id: string | null | undefined) => (id ? (PRO.champions[id]?.name ?? id) : "");

export const fullSplashImg = (id: string) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`;
