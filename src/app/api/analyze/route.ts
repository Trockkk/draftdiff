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

const SYSTEM = `Tu es un analyste esport League of Legends (niveau caster pro). On te donne une draft terminée et le résultat d'un modèle statistique entraîné sur les games pro récentes.
Règles :
- Ne recalcule pas et ne contredis pas la probabilité : explique-la.
- Écris en français, clair, concret, sans jargon inutile. Phrases courtes.
- Base-toi sur les facteurs chiffrés fournis et sur ta connaissance des champions (kits, power spikes, synergies). Signale quand un facteur repose sur peu de données.
- 3 à 5 raisons, triées par importance. winConditions : 2-3 par équipe. keyLane.role : TOP, JUNGLE, MID, BOT ou SUPPORT.`;

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
      facteurs: pred.factors.map((f) => ({ facteur: f.label, pointsPourBlue: +factorPoints(pred, f).toFixed(2), peuDeDonnees: f.lowData })),
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
