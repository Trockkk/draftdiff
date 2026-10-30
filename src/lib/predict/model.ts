import { ROLES, type Role } from "../draft/config";
import type { ProData, Rec, TeamPicks, Weights } from "./types";

// Bayesian smoothing: K virtual games at 50 %, so small samples stay near neutral.
const K = 10;
export const MIN_GAMES = 3; // below this a stat is flagged "peu de données"

export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// `minus` removes one game's own contribution (leave-one-out while training).
function rate(r: Rec | undefined, minus?: { g: number; w: number }) {
  const g = (r?.g ?? 0) - (minus?.g ?? 0);
  const w = (r?.w ?? 0) - (minus?.w ?? 0);
  return { g, wr: (w + K / 2) / (g + K) };
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function matchupRate(data: ProData, role: Role, a: string, b: string, minus?: { g: number; w: number }) {
  const key = `${role}|${pairKey(a, b)}`;
  const r = rate(data.matchups[key], minus);
  return a < b ? r : { g: r.g, wr: 1 - r.wr };
}

export type Factor = {
  kind: "champ" | "matchup" | "synergy" | "comp";
  role?: Role; // lane factors only
  label: string; // short title
  detail: string; // one plain sentence with the real numbers
  value: number; // contribution to the blue logit
  lowData: boolean;
};

const pctOf = (r: Rec | undefined) => (r && r.g >= 1 ? `${Math.round((r.w / r.g) * 100)} % de victoires sur ${Math.round(r.g)} games` : "aucune game pro");

// Damage profile and frontline from Data Dragon classes (no hand tagging).
export function compScore(data: ProData, team: TeamPicks) {
  const champs = team.map((id) => data.champions[id]).filter(Boolean);
  const ad = champs.reduce((s, c) => s + c.attack, 0);
  const ap = champs.reduce((s, c) => s + c.magic, 0);
  const apShare = ap / Math.max(1, ad + ap);
  const front = champs.filter((c) => c.tags[0] === "Tank" || (c.tags.includes("Tank") && c.tags.includes("Fighter"))).length;
  // Penalise one-dimensional damage and teams without frontline.
  return { apShare, front, score: -Math.abs(apShare - 0.5) * 2 + Math.min(front, 2) * 0.5 };
}

// Raw features: blue minus red. `own` = the game's own weighted result to subtract (training only).
export function features(data: ProData, blue: TeamPicks, red: TeamPicks, own?: { blueWon: boolean; weight: number }) {
  const factors: (Omit<Factor, "value"> & { raw: number })[] = [];
  const sub = (won: boolean) => (own ? { g: own.weight, w: won ? own.weight : 0 } : undefined);
  const blueWon = own?.blueWon ?? false;
  const sums = { champ: 0, matchup: 0, synergy: 0, comp: 0 };

  ROLES.forEach((role, i) => {
    const b = blue[i], r = red[i];
    const cb = rate(data.champions[b]?.roles[role], sub(blueWon));
    const cr = rate(data.champions[r]?.roles[role], sub(!blueWon));
    const champ = logit(cb.wr) - logit(cr.wr);
    sums.champ += champ;
    factors.push({
      kind: "champ",
      role,
      label: `${role} : forme de ${name(data, b)} et ${name(data, r)}`,
      detail: `En pro à ce poste : ${name(data, b)} ${pctOf(data.champions[b]?.roles[role])}, ${name(data, r)} ${pctOf(data.champions[r]?.roles[role])}.`,
      raw: champ,
      lowData: cb.g < MIN_GAMES || cr.g < MIN_GAMES,
    });

    const m = matchupRate(data, role, b, r, sub(b < r ? blueWon : !blueWon));
    const mu = logit(m.wr);
    sums.matchup += mu;
    const mrec = data.matchups[`${role}|${pairKey(b, r)}`];
    const games = Math.round(mrec?.g ?? 0);
    const rawWr = mrec && mrec.g ? (b < r ? mrec.w / mrec.g : 1 - mrec.w / mrec.g) : 0.5; // shown to users, unsmoothed
    factors.push({
      kind: "matchup",
      role,
      label: `${role} : ${name(data, b)} contre ${name(data, r)}`,
      detail:
        m.g < MIN_GAMES
          ? `Face-à-face presque jamais joué en pro (${games} game${games > 1 ? "s" : ""}) : pas de conclusion.`
          : `En face-à-face pro, ${name(data, b)} gagne ${Math.round(rawWr * 100)} % du temps contre ${name(data, r)} (${games} games).`,
      raw: mu,
      lowData: m.g < MIN_GAMES,
    });
  });

  for (const [team, sign, won] of [[blue, 1, blueWon], [red, -1, !blueWon]] as const) {
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const s = rate(data.synergies[pairKey(team[i], team[j])], sub(won));
        sums.synergy += sign * logit(s.wr);
      }
  }
  factors.push({
    kind: "synergy",
    label: "Synergies entre champions",
    detail: "Compare à quel point les duos de chaque équipe gagnent souvent ensemble en pro.",
    raw: sums.synergy,
    lowData: false,
  });

  const cb = compScore(data, blue), cr = compScore(data, red);
  sums.comp = cb.score - cr.score;
  factors.push({
    kind: "comp",
    label: "Équilibre de la composition",
    detail: `Dégâts magiques : ${Math.round(cb.apShare * 100)} % contre ${Math.round(cr.apShare * 100)} % (50 % = mélange idéal AP/AD). Tanks en première ligne : ${cb.front} contre ${cr.front}.`,
    raw: sums.comp,
    lowData: false,
  });

  return { sums, factors };
}

const name = (data: ProData, id: string) => data.champions[id]?.name ?? id;

export function linear(w: Weights, s: { champ: number; matchup: number; synergy: number; comp: number }) {
  return w.bias + w.champ * s.champ + w.matchup * s.matchup + w.synergy * s.synergy + w.comp * s.comp;
}

export type Prediction = { blueWin: number; factors: Factor[] };

// The verdict judges the drafts only: the blue side bonus learned in training (bias) is left out.
export function predict(data: ProData, blue: TeamPicks, red: TeamPicks): Prediction {
  const w = { ...data.meta.weights, bias: 0 };
  const { sums, factors } = features(data, blue, red);
  const scale: Record<Factor["kind"], number> = { champ: w.champ, matchup: w.matchup, synergy: w.synergy, comp: w.comp };
  const out: Factor[] = factors.map(({ raw, ...f }) => ({ ...f, value: raw * scale[f.kind] }));
  return { blueWin: sigmoid(linear(w, sums)), factors: out };
}

// Percentage-point effect of one factor on the final probability.
export function factorPoints(pred: Prediction, f: Factor) {
  const x = logit(pred.blueWin);
  return (pred.blueWin - sigmoid(x - f.value)) * 100;
}
