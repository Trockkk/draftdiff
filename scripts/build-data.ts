// npm run data:update
// Reads Oracle's Elixir CSVs from data/raw/ (downloads them if missing), joins with Data Dragon,
// writes data/pro.json and fits the prediction weights with an honest holdout.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ROLES } from "../src/lib/draft/config";
import { features, linear, pairKey, sigmoid } from "../src/lib/predict/model";
import type { ChampionInfo, ProData, Rec, Weights } from "../src/lib/predict/types";

const RAW = "data/raw";
const OUT = "data/pro.json";
const PATCH_WINDOW = Number(process.env.PATCH_WINDOW ?? 10); // most recent N patches
const RECENCY = 0.9; // weight multiplier per patch of age
const HOLDOUT = 0.15; // most recent share of games kept out of training for evaluation
// shortcut: hand-picked league weights, edit when Riot reshapes the leagues.
const INTERNATIONAL = new Set(["WLDs", "MSI", "FST", "EWC"]);
const MAJOR = new Set(["LCK", "LPL", "LEC", "LCS", "LTA", "LTA N", "LTA S", "LCP", "CBLOL", "PCS", "VCS", "LJL"]);

// Oracle's Elixir publishes yearly CSVs in this Google Drive folder.
const DRIVE_FOLDER = "1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH";

const POS: Record<string, number> = { top: 0, jng: 1, mid: 2, bot: 3, sup: 4 };

type Game = {
  id: string;
  date: string;
  league: string;
  patch: string;
  blue: string[];
  red: string[];
  bans: string[];
  blueWin: boolean;
  weight: number;
};

async function download() {
  mkdirSync(RAW, { recursive: true });
  const year = new Date().getFullYear();
  const html = await (await fetch(`https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER}`)).text();
  const files = [...html.matchAll(/file\/d\/([\w-]+)[\s\S]*?flip-entry-title">(\d{4})_LoL/g)];
  for (const [, id, y] of files) {
    if (Number(y) < year - 1 || existsSync(`${RAW}/${y}.csv`)) continue;
    console.log(`Téléchargement ${y}...`);
    const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
    const body = await res.text();
    if (!body.startsWith("gameid,")) {
      console.warn(
        `  Google Drive refuse le téléchargement de ${y} (quota dépassé, réessaie plus tard).\n` +
          `  Sinon télécharge-le à la main : https://drive.google.com/drive/folders/${DRIVE_FOLDER}\n` +
          `  et enregistre-le sous ${RAW}/${y}.csv`,
      );
      continue;
    }
    writeFileSync(`${RAW}/${y}.csv`, body);
  }
}

// Minimal RFC 4180 line splitter (OE quotes fields that contain commas).
function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export function parseGames(csv: string, toId: (name: string) => string | undefined): Game[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const h = splitCsv(lines[0]);
  const col = (n: string) => h.indexOf(n);
  const [cId, cLeague, cDate, cPatch, cSide, cPos, cChamp, cRes] = ["gameid", "league", "date", "patch", "side", "position", "champion", "result"].map(col);
  const bansCols = [1, 2, 3, 4, 5].map((i) => col(`ban${i}`));
  const games = new Map<string, Game>();
  const missing = new Set<string>();

  for (const line of lines.slice(1)) {
    const f = splitCsv(line);
    const id = f[cId];
    let g = games.get(id);
    if (!g) {
      g = { id, date: f[cDate], league: f[cLeague], patch: f[cPatch], blue: [], red: [], bans: [], blueWin: false, weight: 1 };
      games.set(id, g);
    }
    const blue = f[cSide] === "Blue";
    if (f[cPos] === "team") {
      if (blue) g.blueWin = f[cRes] === "1";
      for (const c of bansCols) {
        const b = f[c] && toId(f[c]);
        if (b) g.bans.push(b);
      }
      continue;
    }
    const role = POS[f[cPos]];
    if (role === undefined || !f[cChamp]) continue;
    const champ = toId(f[cChamp]);
    if (!champ) missing.add(f[cChamp]);
    else (blue ? g.blue : g.red)[role] = champ;
  }
  if (missing.size) console.warn(`Champions inconnus de Data Dragon (ignorés) : ${[...missing].join(", ")}`);
  // Only complete drafts with a patch are usable.
  return [...games.values()].filter((g) => g.patch && g.blue.filter(Boolean).length === 5 && g.red.filter(Boolean).length === 5);
}

// A champion's roles = the ones that make up at least ROLE_SHARE of its pro picks, most played first.
// Uses every loaded game (not just the patch window) so rarely picked champions still get a role.
const ROLE_SHARE = 0.15;
export function roleMap(games: Game[], ids: string[]): Record<string, string[]> {
  const count: Record<string, number[]> = Object.fromEntries(ids.map((id) => [id, [0, 0, 0, 0, 0]]));
  for (const g of games) for (const team of [g.blue, g.red]) team.forEach((c, i) => count[c] && count[c][i]++);
  return Object.fromEntries(
    ids.map((id) => {
      const n = count[id], total = n.reduce((a, b) => a + b, 0);
      const keep = ROLES.map((r, i) => [r, n[i]] as const).filter(([, k]) => total && k / total >= ROLE_SHARE);
      return [id, keep.sort((a, b) => b[1] - a[1]).map(([r]) => r)];
    }),
  );
}

const patchNum = (p: string) => {
  const [a, b] = p.split(".").map(Number);
  return a * 100 + b;
};

function add(map: Record<string, Rec>, key: string, weight: number, won: boolean) {
  const r = (map[key] ??= { g: 0, w: 0 });
  r.g += weight;
  if (won) r.w += weight;
}

function buildStats(games: Game[], base: Record<string, ChampionInfo>): ProData {
  const champions: Record<string, ChampionInfo> = {};
  for (const [id, c] of Object.entries(base)) champions[id] = { ...c, roles: {}, bans: 0, picks: 0 };
  const matchups: Record<string, Rec> = {};
  const synergies: Record<string, Rec> = {};
  const blueSide: Rec = { g: 0, w: 0 };

  for (const g of games) {
    add({ s: blueSide }, "s", g.weight, g.blueWin);
    for (const b of g.bans) if (champions[b]) champions[b].bans += 1;
    for (const [team, won] of [[g.blue, g.blueWin], [g.red, !g.blueWin]] as const) {
      ROLES.forEach((role, i) => {
        const c = champions[team[i]];
        c.picks += 1;
        add(c.roles as Record<string, Rec>, role, g.weight, won);
      });
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) add(synergies, pairKey(team[i], team[j]), g.weight, won);
    }
    ROLES.forEach((role, i) => {
      const [b, r] = [g.blue[i], g.red[i]];
      add(matchups, `${role}|${pairKey(b, r)}`, g.weight, b < r ? g.blueWin : !g.blueWin);
    });
  }
  const weights: Weights = { bias: 0, champ: 0, matchup: 0, synergy: 0, comp: 0 };
  return {
    meta: { generatedAt: "", ddragonVersion: "", games: games.length, patches: [], leagues: [], weights, eval: null },
    champions,
    matchups,
    synergies,
    blueSide,
  };
}

type Sample = { x: number[]; y: number };

function samples(data: ProData, games: Game[], leaveOneOut: boolean): Sample[] {
  return games.map((g) => {
    const { sums } = features(data, g.blue, g.red, leaveOneOut ? { blueWon: g.blueWin, weight: g.weight } : undefined);
    return { x: [1, sums.champ, sums.matchup, sums.synergy, sums.comp], y: g.blueWin ? 1 : 0 };
  });
}

// Plain logistic regression by gradient descent, light L2 to keep weights sane on small samples.
export function fit(data: Sample[], iters = 3000, lr = 0.05, l2 = 0.01): Weights {
  const w = [0, 0, 0, 0, 0];
  for (let it = 0; it < iters; it++) {
    const grad = [0, 0, 0, 0, 0];
    for (const s of data) {
      const p = sigmoid(s.x.reduce((a, v, k) => a + v * w[k], 0));
      for (let k = 0; k < 5; k++) grad[k] += (p - s.y) * s.x[k];
    }
    for (let k = 0; k < 5; k++) w[k] -= lr * (grad[k] / Math.max(1, data.length) + (k ? l2 * w[k] : 0));
  }
  return { bias: w[0], champ: w[1], matchup: w[2], synergy: w[3], comp: w[4] };
}

function evaluate(w: Weights, data: Sample[]) {
  let correct = 0, ll = 0;
  const base = data.reduce((a, s) => a + s.y, 0) / Math.max(1, data.length);
  let bll = 0;
  for (const s of data) {
    const p = sigmoid(linear(w, { champ: s.x[1], matchup: s.x[2], synergy: s.x[3], comp: s.x[4] }));
    if (p >= 0.5 === (s.y === 1)) correct++;
    ll -= Math.log(s.y ? p : 1 - p);
    bll -= Math.log(s.y ? base : 1 - base);
  }
  const n = Math.max(1, data.length);
  return { holdoutGames: data.length, accuracy: correct / n, logLoss: ll / n, baselineLogLoss: bll / n };
}

// Drop single-game pairs from the published file to keep the bundle small (they read as neutral anyway).
const prune = (m: Record<string, Rec>) =>
  Object.fromEntries(
    Object.entries(m)
      .filter(([, r]) => r.g >= 1.5)
      .map(([k, r]) => [k, { g: +r.g.toFixed(2), w: +r.w.toFixed(2) }]),
  );

async function main() {
  await download();

  const versions: string[] = await (await fetch("https://ddragon.leagueoflegends.com/api/versions.json")).json();
  const ddragonVersion = versions[0];
  const dd = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`)).json();
  const base: Record<string, ChampionInfo> = {};
  const byName = new Map<string, string>();
  for (const c of Object.values(dd.data) as { id: string; name: string; tags: string[]; info: { attack: number; magic: number } }[]) {
    base[c.id] = { id: c.id, name: c.name, tags: c.tags, attack: c.info.attack, magic: c.info.magic, roles: {}, bans: 0, picks: 0 };
    byName.set(norm(c.name), c.id);
    byName.set(norm(c.id), c.id);
  }
  const toId = (n: string) => byName.get(norm(n));

  const csvs = existsSync(RAW) ? readdirSync(RAW).filter((f) => /^\d{4}\.csv$/.test(f)) : [];
  let games = csvs.flatMap((f) => parseGames(readFileSync(`${RAW}/${f}`, "utf8"), toId));
  const allGames = games;

  const patches = [...new Set(games.map((g) => g.patch))].sort((a, b) => patchNum(b) - patchNum(a)).slice(0, PATCH_WINDOW);
  games = games.filter((g) => patches.includes(g.patch)).sort((a, b) => a.date.localeCompare(b.date));
  for (const g of games) {
    const age = patches.indexOf(g.patch);
    g.weight = RECENCY ** age * (INTERNATIONAL.has(g.league) ? 1.5 : MAJOR.has(g.league) ? 1.2 : 1);
  }
  console.log(`${games.length} games pro sur ${patches.length} patchs (${patches.at(-1) ?? "-"} → ${patches[0] ?? "-"})`);

  // Honest evaluation: train on older games, test on the most recent ones with train-only stats.
  let evalResult: ProData["meta"]["eval"] = null;
  const cut = Math.floor(games.length * (1 - HOLDOUT));
  if (games.length >= 200) {
    const train = buildStats(games.slice(0, cut), base);
    const w = fit(samples(train, games.slice(0, cut), true));
    evalResult = evaluate({ ...w, bias: 0 }, samples(train, games.slice(cut), false)); // judged like the site: drafts only
    console.log(`Holdout ${evalResult.holdoutGames} games : précision ${(evalResult.accuracy * 100).toFixed(1)} %, log loss ${evalResult.logLoss.toFixed(4)} (base ${evalResult.baselineLogLoss.toFixed(4)})`);
  }

  const data = buildStats(games, base);
  // Too few games to fit: fall back to fixed, conservative weights.
  data.meta.weights = games.length >= 200 ? fit(samples(data, games, true)) : { bias: 0, champ: 0.5, matchup: 0.5, synergy: 0.1, comp: 0.1 };
  data.meta = {
    ...data.meta,
    generatedAt: new Date().toISOString(),
    ddragonVersion,
    patches,
    leagues: [...new Set(games.map((g) => g.league))].sort(),
    eval: evalResult,
  };
  data.matchups = prune(data.matchups);
  data.synergies = prune(data.synergies);
  for (const c of Object.values(data.champions))
    for (const [r, rec] of Object.entries(c.roles)) c.roles[r as keyof typeof c.roles] = { g: +rec.g.toFixed(2), w: +rec.w.toFixed(2) };

  writeFileSync(OUT, JSON.stringify(data));
  // Small file for the room server and the role filter: champion pool + real roles.
  writeFileSync("data/roles.json", JSON.stringify(roleMap(allGames, Object.keys(base))));
  console.log(`Écrit ${OUT} — poids :`, data.meta.weights);
}

if (process.argv[1]?.includes("build-data")) main();
