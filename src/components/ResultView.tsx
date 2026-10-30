"use client";
/* eslint-disable @next/next/no-img-element -- Data Dragon images */
import { motion, MotionConfig } from "motion/react";
import RoleIcon from "@/components/RoleIcon";
import { ROLES, type Role, type Side } from "@/lib/draft/config";
import { champImg, champName, PRO } from "@/lib/data";
import { fmt, laneEdges, type Analysis } from "@/lib/predict/explain";
import type { Factor } from "@/lib/predict/model";

export type AnalyzeResult = { blueWin: number; factors: (Factor & { points: number })[]; analysis: Analysis; ai: boolean };

const SPIKE = { early: "Fort en début de game", mid: "Fort en milieu de game", late: "Fort en fin de game" };
const TEXT = { blue: "text-blue-side", red: "text-red-side" };
const BG = { blue: "bg-blue-side", red: "bg-red-side" };

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
  if (!result)
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        <div className="flex gap-1.5">
          {[...blue, ...red].map((c, i) => (
            <img key={c} src={champImg(c)} alt={champName(c)} className={`size-10 sm:size-12 rounded-lg ${i === 5 ? "ml-4" : ""}`} />
          ))}
        </div>
        <p className="text-muted animate-pulse" role="status">Analyse de la draft…</p>
      </div>
    );

  const p = result.blueWin;
  const fav: Side = p >= 0.5 ? "blue" : "red";
  const favPct = Math.round(Math.max(p, 1 - p) * 100);
  const close = favPct < 53;
  const { analysis: a } = result;
  const lanes = laneEdges(result.factors);
  const maxLane = Math.max(3, ...lanes.map((l) => Math.abs(l.points)));

  const champ = (id: string, side: Side) => (
    <div className={`flex items-center gap-2.5 min-w-0 ${side === "red" ? "flex-row-reverse text-right" : ""}`}>
      <img src={champImg(id)} alt="" className="size-9 sm:size-11 rounded-lg shrink-0" />
      <span className="text-xs sm:text-sm font-medium truncate">{champName(id)}</span>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-5 anim-fade">
        {/* 1. Verdict */}
        <section aria-label="Verdict" className="card p-6 sm:p-8 flex flex-col gap-4">
          <div className="text-center">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">{close ? "Draft équilibrée" : "Meilleure draft"}</p>
            <h1 className={`mt-1 text-3xl sm:text-4xl font-semibold tracking-tight ${close ? "" : TEXT[fav]}`}>
              {close ? "Match très serré" : names[fav]}
            </h1>
          </div>
          <div>
            <div className="flex justify-between text-sm font-medium mb-2">
              <span className="text-blue-side">
                {names.blue} <span className="tabular-nums">{Math.round(p * 100)}%</span>
              </span>
              <span className="text-red-side">
                <span className="tabular-nums">{100 - Math.round(p * 100)}%</span> {names.red}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-red-side overflow-hidden">
              <motion.div
                className="h-full bg-blue-side origin-left"
                initial={{ scaleX: 0.5 }}
                animate={{ scaleX: p }}
                transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
              />
            </div>
          </div>
          <p className="text-center text-muted leading-relaxed">{a.summary}</p>
        </section>

        {/* 2. Lane by lane */}
        <section aria-label="Lane par lane" className="card p-4 sm:p-6">
          <h2 className="text-sm font-semibold mb-3">Lane par lane</h2>
          <ul className="flex flex-col gap-1">
            {ROLES.map((role: Role, i) => {
              const edge = lanes[i].points;
              const side: Side = edge >= 0 ? "blue" : "red";
              const even = Math.abs(edge) < 0.3;
              const isKey = a.keyLane.role === role && !even;
              return (
                <li key={role} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 p-2 rounded-xl ${isKey ? "bg-raised" : ""}`}>
                  {champ(blue[i], "blue")}
                  <div className="flex flex-col items-center gap-1.5 w-20 sm:w-36">
                    <div className="flex items-center gap-1 text-[11px] text-faint">
                      <RoleIcon role={role} className="size-3.5" />
                      {role.charAt(0) + role.slice(1).toLowerCase()}
                    </div>
                    {/* bar grows toward the side that has the edge */}
                    <div className="relative w-full h-1 bg-raised rounded-full">
                      <span aria-hidden className="absolute left-1/2 -top-0.5 -bottom-0.5 w-px bg-faint" />
                      {!even && (
                        <span
                          className={`absolute top-0 bottom-0 rounded-full ${side === "blue" ? "right-1/2" : "left-1/2"} ${BG[side]}`}
                          style={{ width: `${(Math.abs(edge) / maxLane) * 50}%` }}
                        />
                      )}
                    </div>
                    <div className={`text-[11px] font-medium tabular-nums ${even ? "text-faint" : TEXT[side]}`}>{even ? "équilibré" : `+${fmt(Math.abs(edge))} %`}</div>
                  </div>
                  {champ(red[i], "red")}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted mt-3 px-2">
            <span className="text-fg font-medium">Lane clé · </span>
            {a.keyLane.why}
          </p>
        </section>

        {/* 3. Why */}
        {a.reasons.length > 0 && (
          <section aria-label="Pourquoi" className="card p-4 sm:p-6">
            <h2 className="text-sm font-semibold mb-3">Pourquoi</h2>
            <ul className="flex flex-col gap-4">
              {a.reasons.map((r, i) => (
                <li key={i} style={{ animationDelay: `${0.3 + i * 0.08}s` }} className="anim-rise flex gap-3">
                  <span aria-hidden className={`mt-1.5 size-2 rounded-full shrink-0 ${BG[r.side]}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="text-sm font-semibold">{r.title}</h3>
                      <span className={`text-xs ${TEXT[r.side]}`}>avantage {names[r.side]}</span>
                    </div>
                    <p className="text-sm text-muted mt-0.5 leading-relaxed">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 4. Game plan (AI only) */}
        {result.ai && (
          <section aria-label="Plan de jeu" className="grid sm:grid-cols-2 gap-4">
            {(["blue", "red"] as const).map((s) => (
              <div key={s} className="card p-4 sm:p-5">
                <h3 className={`text-sm font-semibold ${TEXT[s]}`}>Comment {names[s]} gagne</h3>
                <p className="text-xs text-faint mb-2">{SPIKE[a.powerSpike[s]]}</p>
                <ul className="list-disc pl-5 text-sm text-muted space-y-1 marker:text-faint">
                  {a.winConditions[s].map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            ))}
            {a.upset && (
              <p className="sm:col-span-2 text-sm text-muted px-1">
                <span className="text-fg font-medium">Ce qui peut tout changer · </span>
                {a.upset}
              </p>
            )}
          </section>
        )}

        <details className="text-sm text-muted px-1">
          <summary className="cursor-pointer hover:text-fg transition-colors">Voir tous les chiffres</summary>
          <ul className="mt-3 flex flex-col">
            {result.factors.map((f, i) => (
              <li key={i} className="flex justify-between gap-3 border-t border-edge py-2">
                <span>
                  <span className="text-fg">{f.label}</span> — {f.detail}
                </span>
                <span className={`shrink-0 tabular-nums ${f.points >= 0 ? "text-blue-side" : "text-red-side"}`}>
                  {f.points >= 0 ? "+" : "−"}
                  {fmt(Math.abs(f.points))} %
                </span>
              </li>
            ))}
          </ul>
          <p className="text-faint mt-2 text-xs">
            + = avantage {names.blue}, − = avantage {names.red}. Basé sur {PRO.meta.games} games pro
            {PRO.meta.eval && ` ; ce calcul trouve le bon gagnant dans ${Math.round(PRO.meta.eval.accuracy * 100)} % des games pro récentes`}.
          </p>
        </details>

        {actions && <div className="flex flex-wrap gap-2 justify-center pt-2">{actions}</div>}
      </div>
    </MotionConfig>
  );
}
