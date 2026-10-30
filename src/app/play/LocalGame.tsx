"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ChampSelect from "@/components/ChampSelect";
import ResultView, { type AnalyzeResult } from "@/components/ResultView";
import SeriesBar from "@/components/SeriesBar";
import { analyze, resultUrl } from "@/lib/analyze";
import { aiChoice } from "@/lib/draft/ai";
import type { Side } from "@/lib/draft/config";
import { createDraft, currentStep, hover, lock, setSwapReady, swapRoles, timeout, type DraftState } from "@/lib/draft/machine";
import { arrangeOnSwap } from "@/lib/draft/roles";
import { isOver, lockedChampions, newSeries, recordGame, type Series, type SeriesFormat } from "@/lib/draft/series";
import { CHAMPION_IDS, PRO, ROLE_MAP } from "@/lib/data";

// Sandbox (one person plays both sides) and Solo vs IA. Runs fully in the browser.
export default function LocalGame() {
  const q = useSearchParams();
  const vsAi = q.get("mode") === "ai";
  const human: Side = q.get("side") === "red" ? "red" : "blue";
  const ai: Side | null = vsAi ? (human === "blue" ? "red" : "blue") : null;
  const names: Record<Side, string> = vsAi
    ? { blue: human === "blue" ? "Toi" : "IA", red: human === "red" ? "Toi" : "IA" }
    : { blue: "Blue", red: "Red" };

  const [series, setSeries] = useState<Series>(() => newSeries((Number(q.get("bo")) || 1) as SeriesFormat, q.get("fearless") === "1"));
  const [draft, setDraft] = useState<DraftState>(() => createDraft(Date.now()));
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const analyzed = useRef(false);

  const apply = (fn: (d: DraftState) => DraftState) =>
    setDraft((d) => {
      try {
        return arrangeOnSwap(d, fn(d), ROLE_MAP);
      } catch {
        return d; // invalid action (wrong turn / taken champion): ignore
      }
    });

  // Timer
  useEffect(() => {
    const t = setInterval(() => apply((d) => timeout(d, Date.now(), CHAMPION_IDS)), 250);
    return () => clearInterval(t);
  }, []);

  // Bot: hovers, then locks a moment later, like a human would.
  const step = currentStep(draft);
  useEffect(() => {
    if (!ai) return;
    if (draft.phase === "swap" && !draft.swapReady[ai]) {
      const t = setTimeout(() => apply((d) => setSwapReady(d, ai)), 1500);
      return () => clearTimeout(t);
    }
    if (step?.side !== ai) return;
    const champ = aiChoice(draft, PRO, ROLE_MAP);
    const t1 = setTimeout(() => apply((d) => hover(d, ai, champ)), 1200 + Math.random() * 1500);
    const t2 = setTimeout(() => apply((d) => lock(d, ai, champ, Date.now())), 3000 + Math.random() * 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the turn changes
  }, [draft.step, draft.phase, ai]);

  // Draft finished: analyse once, record the game in the series.
  useEffect(() => {
    if (draft.phase !== "done" || analyzed.current) return;
    analyzed.current = true;
    analyze(draft.picks.blue, draft.picks.red, names)
      .then((r) => {
        setResult(r);
        setSeries((s) => recordGame(s, draft.picks.blue, draft.picks.red, r.blueWin));
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.phase]);

  function nextGame() {
    analyzed.current = false;
    setResult(null);
    setError(null);
    setDraft(createDraft(Date.now(), lockedChampions(series)));
  }

  function restart() {
    analyzed.current = false;
    setResult(null);
    setSeries(newSeries(series.format, series.fearless));
    setDraft(createDraft(Date.now()));
  }

  if (draft.phase === "done") {
    const last = series.games.at(-1);
    return (
      <>
        {error && <p className="text-red-side text-center p-4">{error}</p>}
        <ResultView
          blue={draft.picks.blue}
          red={draft.picks.red}
          names={names}
          result={result}
          actions={
            result && (
              <>
                {last && series.format > 1 && (
                  <p className="w-full text-center font-display text-gold">
                    Résultat simulé de la game : victoire {names[last.winner]}
                  </p>
                )}
                {!isOver(series) ? (
                  <button className="btn-gold px-6 py-2" onClick={nextGame}>Game suivante</button>
                ) : (
                  <button className="btn-gold px-6 py-2" onClick={restart}>Nouvelle série</button>
                )}
                <button
                  className="btn-gold px-6 py-2"
                  onClick={() => {
                    navigator.clipboard.writeText(location.origin + resultUrl(draft.picks.blue, draft.picks.red, names));
                    setCopied(true);
                  }}
                >
                  {copied ? "Lien copié ✓" : "Copier le lien du résultat"}
                </button>
                <Link href="/" className="btn-gold px-6 py-2">Accueil</Link>
              </>
            )
          }
        />
      </>
    );
  }

  return (
    <ChampSelect
      draft={draft}
      controls={ai ? [human] : ["blue", "red"]}
      names={names}
      info={<SeriesBar series={series} names={names} extra={<button className="underline text-mute" onClick={restart}>Recommencer</button>} />}
      onHover={(side, c) => apply((d) => hover(d, side, c))}
      onLock={(side, c) => apply((d) => lock(d, side, c, Date.now()))}
      onSwap={(side, i, j) => apply((d) => swapRoles(d, side, i, j))}
      onSwapReady={(side) => apply((d) => setSwapReady(d, side))}
    />
  );
}
