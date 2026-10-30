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
const BORDER = { blue: "border-l-blue-side", red: "border-l-red-side" };

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
        <div className="flex gap-2">
          {[...blue, ...red].map((c, i) => (
            <img key={c} src={champImg(c)} alt={champName(c)} className={`size-10 sm:size-12 border border-gold-dark ${i === 5 ? "ml-4" : ""}`} />
          ))}
        </div>
        <p className="font-display text-xl text-gold animate-pulse" role="status">Analyse de la draft en cours...</p>
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
    <div className={`flex items-center gap-2 min-w-0 ${side === "red" ? "flex-row-reverse text-right" : ""}`}>
      <img src={champImg(id)} alt="" className="size-8 sm:size-11 border border-gold-dark shrink-0" />
      <span className="font-display text-xs sm:text-base truncate">{champName(id)}</span>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6 anim-fade">
        {/* 1. Verdict */}
        <section aria-label="Verdict" className="text-center flex flex-col gap-3">
          <p className="text-xs tracking-[0.3em] text-mute">{close ? "DRAFT ÉQUILIBRÉE" : "DRAFT GAGNANTE"}</p>
          <h1 className={`font-display text-3xl sm:text-5xl ${close ? "text-gold-light" : TEXT[fav]}`}>
            {close ? "Match très serré" : `${names[fav]} favori`}
          </h1>
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl sm:text-3xl text-blue-side tabular-nums w-16 text-left">{Math.round(p * 100)}%</span>
            <div className="flex-1 h-3 bg-red-side/80 overflow-hidden rounded-full">
              <motion.div
                className="h-full bg-blue-side origin-left"
                initial={{ scaleX: 0.5 }}
                animate={{ scaleX: p }}
                transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
              />
            </div>
            <span className="font-display text-2xl sm:text-3xl text-red-side tabular-nums w-16 text-right">{100 - Math.round(p * 100)}%</span>
          </div>
          <div className="flex justify-between text-xs tracking-widest">
            <span className="text-blue-side">{names.blue}</span>
            <span className="text-red-side">{names.red}</span>
          </div>
          <p className="text-gold-light text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">{a.summary}</p>
        </section>

        {/* 2. Lane by lane */}
        <section aria-label="Lane par lane" className="gold-frame bg-panel/70 p-3 sm:p-4">
          <h2 className="font-display text-gold text-sm tracking-widest mb-3">LANE PAR LANE</h2>
          <ul className="flex flex-col gap-2">
            {ROLES.map((role: Role, i) => {
              const edge = lanes[i].points;
              const side: Side = edge >= 0 ? "blue" : "red";
              const even = Math.abs(edge) < 0.3;
              const isKey = a.keyLane.role === role && !even;
              return (
                <li key={role} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 p-1.5 ${isKey ? "bg-gold/10 ring-1 ring-gold/40" : ""}`}>
                  {champ(blue[i], "blue")}
                  <div className="flex flex-col items-center gap-1 w-20 sm:w-40">
                    <div className="flex items-center gap-1 text-[10px] text-mute tracking-widest">
                      <RoleIcon role={role} className="size-3.5" />
                      {role}
                    </div>
                    {/* bar grows toward the side that has the edge */}
                    <div className="relative w-full h-1.5 bg-line rounded-full">
                      <span aria-hidden className="absolute left-1/2 top-0 bottom-0 w-px bg-gold-dark" />
                      {!even && (
                        <span
                          className={`absolute top-0 bottom-0 rounded-full ${side === "blue" ? "right-1/2 bg-blue-side" : "left-1/2 bg-red-side"}`}
                          style={{ width: `${(Math.abs(edge) / maxLane) * 50}%` }}
                        />
                      )}
                    </div>
                    <div className={`text-[11px] ${even ? "text-mute" : TEXT[side]}`}>{even ? "équilibré" : `+${fmt(Math.abs(edge))} % ${names[side]}`}</div>
                  </div>
                  {champ(red[i], "red")}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-text mt-3">
            <span className="text-gold">Lane clé :</span> {a.keyLane.why}
          </p>
        </section>

        {/* 3. Why */}
        {a.reasons.length > 0 && (
          <section aria-label="Pourquoi" className="flex flex-col gap-2">
            <h2 className="font-display text-gold text-sm tracking-widest">POURQUOI</h2>
            {a.reasons.map((r, i) => (
              <article key={i} style={{ animationDelay: `${0.3 + i * 0.08}s` }} className={`anim-rise bg-panel/70 border border-gold-dark/40 border-l-4 ${BORDER[r.side]} p-3`}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-gold-light text-sm sm:text-base">{r.title}</h3>
                  <span className={`shrink-0 text-[10px] tracking-widest ${TEXT[r.side]}`}>AVANTAGE {names[r.side].toUpperCase()}</span>
                </div>
                <p className="text-sm text-text mt-1 leading-relaxed">{r.detail}</p>
              </article>
            ))}
          </section>
        )}

        {/* 4. Game plan (AI only) */}
        {result.ai && (
          <section aria-label="Plan de jeu" className="grid sm:grid-cols-2 gap-3">
            {(["blue", "red"] as const).map((s) => (
              <div key={s} className={`bg-panel/70 border border-gold-dark/40 border-t-4 ${s === "blue" ? "border-t-blue-side" : "border-t-red-side"} p-3`}>
                <h3 className={`font-display text-sm ${TEXT[s]}`}>Comment {names[s]} gagne</h3>
                <p className="text-[11px] text-mute mb-1">{SPIKE[a.powerSpike[s]]}</p>
                <ul className="list-disc pl-5 text-sm text-text space-y-1">
                  {a.winConditions[s].map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            ))}
            {a.upset && (
              <p className="sm:col-span-2 text-sm text-text">
                <span className="text-gold">Ce qui peut tout changer :</span> {a.upset}
              </p>
            )}
          </section>
        )}

        <details className="text-sm text-text">
          <summary className="cursor-pointer text-mute hover:text-gold-light">Voir tous les chiffres</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.factors.map((f, i) => (
              <li key={i} className="flex justify-between gap-3 border-t border-line pt-1.5">
                <span>
                  <span className="text-gold-light">{f.label}</span> — {f.detail}
                </span>
                <span className={`shrink-0 tabular-nums ${f.points >= 0 ? "text-blue-side" : "text-red-side"}`}>
                  {f.points >= 0 ? "+" : "−"}
                  {fmt(Math.abs(f.points))} %
                </span>
              </li>
            ))}
          </ul>
          <p className="text-mute mt-2 text-xs">
            + = avantage {names.blue}, − = avantage {names.red}. Basé sur {PRO.meta.games} games pro
            {PRO.meta.eval && ` ; ce calcul trouve le bon gagnant dans ${Math.round(PRO.meta.eval.accuracy * 100)} % des games pro récentes`}.
            {!result.ai && " Explication générée sans IA (ajoute une clé API pour une analyse rédigée par Claude)."}
          </p>
        </details>

        {actions && <div className="flex flex-wrap gap-3 justify-center">{actions}</div>}
      </div>
    </MotionConfig>
  );
}
