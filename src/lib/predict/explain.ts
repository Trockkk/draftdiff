import { z } from "zod";
import { ROLES, type Role } from "../draft/config";
import { factorPoints, type Factor, type Prediction } from "./model";

export const AnalysisSchema = z.object({
  summary: z.string(),
  reasons: z.array(z.object({ side: z.enum(["blue", "red"]), title: z.string(), detail: z.string() })),
  winConditions: z.object({ blue: z.array(z.string()), red: z.array(z.string()) }),
  powerSpike: z.object({ blue: z.enum(["early", "mid", "late"]), red: z.enum(["early", "mid", "late"]) }),
  keyLane: z.object({ role: z.string(), why: z.string() }),
  upset: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// French number with comma, e.g. 2,4
export const fmt = (x: number, digits = 1) => x.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// Net edge per lane (form + face-to-face), in % of win chance for blue.
export function laneEdges(factors: (Factor & { points: number })[]): { role: Role; points: number }[] {
  return ROLES.map((role) => ({ role, points: factors.filter((f) => f.role === role).reduce((s, f) => s + f.points, 0) }));
}

// Used when there is no API key or the call fails: built only from the model's factors.
export function templateAnalysis(pred: Prediction, names: { blue: string; red: string }): Analysis {
  const withPts = pred.factors.map((f) => ({ ...f, points: factorPoints(pred, f) }));
  const ranked = withPts.filter((f) => Math.abs(f.points) >= 0.3).sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const fav = pred.blueWin >= 0.5 ? "blue" : "red";
  const pct = Math.round(Math.max(pred.blueWin, 1 - pred.blueWin) * 100);
  const lane = laneEdges(withPts).sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0];
  const laneSide = lane.points >= 0 ? "blue" : "red";

  return {
    summary:
      pct < 53 || !ranked.length
        ? `Draft très équilibrée : ${names[fav]} n'est qu'à peine devant (${pct} %).`
        : `${names[fav]} part favori à ${pct} %. Le plus gros écart : ${ranked[0].label}.`,
    reasons: ranked.slice(0, 4).map((f) => {
      const side = f.points >= 0 ? "blue" : "red";
      const detail = f.kind === "synergy" ? `Les duos de ${names[side]} gagnent plus souvent ensemble en pro que ceux d'en face.` : f.detail;
      return { side, title: f.label, detail: `${detail} (+${fmt(Math.abs(f.points))} % de chances de gagner pour ${names[side]})` };
    }),
    winConditions: { blue: [], red: [] },
    powerSpike: { blue: "mid", red: "mid" },
    keyLane: {
      role: lane.role,
      why:
        Math.abs(lane.points) < 0.3
          ? "Aucune lane ne se démarque vraiment."
          : `C'est le poste où l'écart est le plus grand : +${fmt(Math.abs(lane.points))} % pour ${names[laneSide]}.`,
    },
    upset: "",
  };
}
