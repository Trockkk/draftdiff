"use client";
/* eslint-disable @next/next/no-img-element -- Data Dragon images */
import { ROLES, type Side } from "@/lib/draft/config";
import { champImg, champName, PRO } from "@/lib/data";
import type { Analysis } from "@/lib/predict/explain";
import type { Factor } from "@/lib/predict/model";

export type AnalyzeResult = { blueWin: number; factors: (Factor & { points: number })[]; analysis: Analysis; ai: boolean };

const SPIKE = { early: "Early game", mid: "Mid game", late: "Late game" };

export default function ResultView({
  blue,
  red,
  names,
  result,
  actions,
}: {
  blue: string[];
  red: string[];
  names: Record<Side, string>;
  result: AnalyzeResult | null;
  actions?: React.ReactNode;
}) {
  const team = (side: Side, picks: string[]) => (
    <div className={`flex flex-col gap-1 ${side === "red" ? "items-end" : ""}`}>
      <div className={`font-display tracking-widest ${side === "blue" ? "text-blue-side" : "text-red-side"}`}>{names[side]}</div>
      <div className={`flex gap-1 ${side === "red" ? "flex-row-reverse" : ""}`}>
        {picks.map((c, i) => (
          <figure key={c} className="flex flex-col items-center w-12 sm:w-16">
            <img src={champImg(c)} alt={champName(c)} className="size-12 sm:size-16 border border-gold-dark" />
            <figcaption className="text-[10px] text-mute">{ROLES[i]}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );

  if (!result)
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-wrap justify-center gap-8">{team("blue", blue)}{team("red", red)}</div>
        <p className="font-display text-xl text-gold animate-pulse" role="status">Analyse de la draft en cours...</p>
      </div>
    );

  const b = Math.round(result.blueWin * 100);
  const { analysis: a } = result;
  const lanes = result.factors.filter((f) => f.kind === "matchup" || f.kind === "champ");
  const other = result.factors.filter((f) => f.kind !== "matchup" && f.kind !== "champ");

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex flex-wrap justify-between gap-4">{team("blue", blue)}{team("red", red)}</div>

      <section aria-label="Probabilité de victoire" className="flex flex-col gap-2">
        <div className="flex justify-between font-display text-3xl sm:text-5xl">
          <span className="text-blue-side">{b} %</span>
          <span className="text-red-side">{100 - b} %</span>
        </div>
        <div className="h-4 flex border border-gold-dark">
          <div className="bg-blue-side/80" style={{ width: `${b}%` }} />
          <div className="bg-red-side/80 flex-1" />
        </div>
        <p className="text-gold-light text-lg">{a.summary}</p>
        {!result.ai && <p className="text-xs text-mute">Explication générée sans IA (pas de clé API ou service indisponible).</p>}
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        {a.reasons.map((r, i) => (
          <article key={i} className={`gold-frame bg-panel/70 p-3 border-l-4 ${r.side === "blue" ? "border-l-blue-side" : "border-l-red-side"}`}>
            <h3 className="font-display text-gold text-sm">{r.title}</h3>
            <p className="text-sm text-text mt-1">{r.detail}</p>
          </article>
        ))}
      </section>

      {(a.winConditions.blue.length > 0 || a.winConditions.red.length > 0) && (
        <section className="grid sm:grid-cols-2 gap-3">
          {(["blue", "red"] as const).map((s) => (
            <div key={s} className="gold-frame bg-panel/70 p-3">
              <h3 className={`font-display text-sm ${s === "blue" ? "text-blue-side" : "text-red-side"}`}>
                Win conditions {names[s]} · {SPIKE[a.powerSpike[s]]}
              </h3>
              <ul className="list-disc pl-5 text-sm text-text mt-1">
                {a.winConditions[s].map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="gold-frame bg-panel/70 p-3 text-sm">
        <p><span className="font-display text-gold">Lane clé : {a.keyLane.role}</span> — {a.keyLane.why}</p>
        <p className="mt-2 text-text"><span className="font-display text-gold">Ce qui peut renverser la game :</span> {a.upset}</p>
      </section>

      <details className="gold-frame bg-panel/70 p-3 text-sm">
        <summary className="cursor-pointer font-display text-gold">Détail des facteurs chiffrés</summary>
        <table className="w-full mt-2 text-xs">
          <tbody>
            {[...lanes, ...other].map((f, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1 pr-2">{f.label}{f.lowData && <span className="text-mute"> · peu de données</span>}</td>
                <td className={`py-1 text-right tabular-nums ${f.points >= 0 ? "text-blue-side" : "text-red-side"}`}>
                  {f.points >= 0 ? "+" : ""}{f.points.toFixed(1)} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-mute mt-2">
          Points positifs = avantage side bleu. Données : {PRO.meta.games} games pro
          {PRO.meta.eval && ` · précision mesurée du modèle : ${(PRO.meta.eval.accuracy * 100).toFixed(1)} % sur ${PRO.meta.eval.holdoutGames} games récentes`}.
        </p>
      </details>

      {actions && <div className="flex flex-wrap gap-3 justify-center">{actions}</div>}
    </div>
  );
}
