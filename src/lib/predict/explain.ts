import { z } from "zod";
import { factorPoints, type Prediction } from "./model";

export const AnalysisSchema = z.object({
  summary: z.string(),
  reasons: z.array(z.object({ side: z.enum(["blue", "red"]), title: z.string(), detail: z.string() })),
  winConditions: z.object({ blue: z.array(z.string()), red: z.array(z.string()) }),
  powerSpike: z.object({ blue: z.enum(["early", "mid", "late"]), red: z.enum(["early", "mid", "late"]) }),
  keyLane: z.object({ role: z.string(), why: z.string() }),
  upset: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// Used when there is no API key or the call fails: built only from the model's factors.
export function templateAnalysis(pred: Prediction, names: { blue: string; red: string }): Analysis {
  const ranked = pred.factors
    .map((f) => ({ f, pts: factorPoints(pred, f) }))
    .filter((x) => Math.abs(x.pts) >= 0.1)
    .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  const fav = pred.blueWin >= 0.5 ? "blue" : "red";
  const lane = ranked.find((x) => x.f.kind === "matchup" || x.f.kind === "champ");
  return {
    summary: `Le modèle statistique donne ${names[fav]} favori à ${Math.round(Math.max(pred.blueWin, 1 - pred.blueWin) * 100)} %, d'après les games pro récentes.`,
    reasons: ranked.slice(0, 5).map(({ f, pts }) => ({
      side: pts >= 0 ? "blue" : "red",
      title: f.label,
      detail: `${pts >= 0 ? "+" : ""}${pts.toFixed(1)} points pour le side bleu${f.lowData ? " (peu de données pro)" : ""}.`,
    })),
    winConditions: { blue: [], red: [] },
    powerSpike: { blue: "mid", red: "mid" },
    keyLane: { role: lane?.f.label.split(" :")[0] ?? "—", why: lane ? "Plus gros écart chiffré entre les deux drafts." : "Aucun écart marquant." },
    upset: "Analyse IA indisponible : explication générée à partir des chiffres uniquement.",
  };
}
