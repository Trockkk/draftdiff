import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ROLES } from "@/lib/draft/config";
import { PRO, champName } from "@/lib/data";
import { AnalysisSchema, templateAnalysis, type Analysis } from "@/lib/predict/explain";
import { factorPoints, predict } from "@/lib/predict/model";

const Body = z.object({
  blue: z.array(z.string()).length(5),
  red: z.array(z.string()).length(5),
  names: z.object({ blue: z.string().max(40), red: z.string().max(40) }),
});

// shortcut: in-memory rate limit is per server instance, move to Redis/KV if abused at scale.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

const SYSTEM = `Tu es un caster League of Legends qui explique une draft à un joueur moyen. On te donne une draft terminée et le résultat d'un modèle statistique entraîné sur les games pro récentes. Le modèle juge uniquement les drafts : le side (bleu/rouge) n'entre pas en compte, n'en parle pas.
Règles d'écriture :
- Français simple, phrases courtes, tutoiement interdit, pas de jargon statistique (pas de "logit", "points", "modèle", "facteur").
- Ne recalcule pas et ne contredis pas la probabilité : explique pourquoi elle est ce qu'elle est.
- Cite les champions par leur nom et dis concrètement ce qu'ils font (engage, poke, split push, scaling...).
- Appuie-toi sur les chiffres fournis (détails) quand ils sont parlants ; si un face-à-face a peu de données, dis-le en une phrase ou ignore-le.
- summary : 1 à 2 phrases, qui gagne et la raison principale.
- reasons : 3 à 4 raisons triées par importance. title : 6 mots maximum. detail : 1 à 2 phrases. side = l'équipe que la raison avantage.
- winConditions : 2 ou 3 phrases courtes par équipe, en commençant par un verbe ("Grouper autour de...", "Jouer le split push...").
- keyLane.role : TOP, JUNGLE, MID, BOT ou SUPPORT ; why : 1 phrase.
- upset : 1 phrase sur ce qui pourrait renverser la game.`;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (limited(ip)) return Response.json({ error: "Trop de requêtes, réessaie dans une minute." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Draft invalide" }, { status: 400 });
  const { blue, red, names } = parsed.data;
  if ([...blue, ...red].some((c) => !PRO.champions[c])) return Response.json({ error: "Champion inconnu" }, { status: 400 });

  const pred = predict(PRO, blue, red);
  let analysis: Analysis = templateAnalysis(pred, names);
  let ai = false;

  if (process.env.ANTHROPIC_API_KEY) {
    const facts = {
      equipes: names,
      blue: ROLES.map((r, i) => `${r}: ${champName(blue[i])}`),
      red: ROLES.map((r, i) => `${r}: ${champName(red[i])}`),
      probabiliteVictoireBlue: `${(pred.blueWin * 100).toFixed(1)} %`,
      // pourcentPourBlue: how much this factor moves blue's win chance (negative = helps red).
      facteurs: pred.factors.map((f) => ({ facteur: f.label, detail: f.detail, pourcentPourBlue: +factorPoints(pred, f).toFixed(1), peuDeDonnees: f.lowData })),
      donnees: { games: PRO.meta.games, patchs: PRO.meta.patches, ligues: PRO.meta.leagues.length },
    };
    try {
      const client = new Anthropic();
      const res = await client.beta.messages.parse({
        model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(AnalysisSchema) },
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(facts) }],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) {
        analysis = res.parsed_output;
        ai = true;
      }
    } catch (e) {
      console.error("Analyse Claude échouée:", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    }
  }

  return Response.json({ blueWin: pred.blueWin, factors: pred.factors.map((f) => ({ ...f, points: factorPoints(pred, f) })), analysis, ai });
}
