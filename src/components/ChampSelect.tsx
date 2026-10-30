"use client";
/* eslint-disable @next/next/no-img-element -- Data Dragon images, no optimisation needed */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ACTION_SECONDS, ROLE_SWAP_SECONDS, ROLES, type Role, type Side } from "@/lib/draft/config";
import { currentStep, isAvailable, type DraftState } from "@/lib/draft/machine";
import { CHAMPION_IDS, champImg, champName, champStats, ROLE_MAP } from "@/lib/data";

type Props = {
  draft: DraftState;
  clockOffset?: number; // server time - local time (online)
  controls: Side[]; // sides this screen may act for
  names: Record<Side, string>;
  top?: ReactNode; // series score, connection status...
  onHover: (side: Side, champ: string | null) => void;
  onLock: (side: Side, champ: string | null) => void;
  onSwap: (side: Side, i: number, j: number) => void;
  onSwapReady: (side: Side) => void;
};

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)} %`);

function useNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 200);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

export default function ChampSelect({ draft, clockOffset = 0, controls, names, top, onHover, onLock, onSwap, onSwapReady }: Props) {
  const now = useNow(clockOffset);
  const step = currentStep(draft);
  const myTurn = !!step && controls.includes(step.side);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [swapPick, setSwapPick] = useState<{ side: Side; i: number } | null>(null);

  const left = Math.max(0, Math.ceil((draft.deadline - now) / 1000));
  const total = draft.phase === "swap" ? ROLE_SWAP_SECONDS : ACTION_SECONDS;
  const selected = step ? draft.hover[step.side] : null;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CHAMPION_IDS.filter(
      (id) => (!q || champName(id).toLowerCase().includes(q)) && (!role || (ROLE_MAP[id] ?? []).includes(role)),
    );
  }, [search, role]);

  let title = "Draft terminée";
  if (step) {
    const who = step.side === "blue" ? "BLUE SIDE" : "RED SIDE";
    const action = step.type === "ban" ? "BANNIT" : "CHOISIT";
    if (!myTurn) title = `${names[step.side]} ${step.type === "ban" ? "bannit..." : "choisit..."}`;
    else if (controls.length === 1) title = step.type === "ban" ? "À toi de bannir !" : "À toi de choisir !";
    else title = `${who} ${action}`;
  } else if (draft.phase === "swap") title = "Échange des rôles";

  function clickSlot(side: Side, i: number) {
    if (draft.phase !== "swap" || !controls.includes(side) || draft.swapReady[side]) return;
    if (swapPick && swapPick.side === side) {
      if (swapPick.i !== i) onSwap(side, swapPick.i, i);
      setSwapPick(null);
    } else setSwapPick({ side, i });
  }

  const banRow = (side: Side) => (
    <div className={`flex gap-1 ${side === "red" ? "flex-row-reverse" : ""}`} aria-label={`Bans ${names[side]}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const b = draft.bans[side][i];
        const done = i < draft.bans[side].length;
        const active = step?.type === "ban" && step.side === side && i === draft.bans[side].length;
        const shown = b ?? (active ? draft.hover[side] : null);
        return (
          <div key={i} className={`relative size-6 sm:size-10 gold-frame bg-night overflow-hidden ${active ? "active-slot" : ""}`} title={done ? (b ? champName(b) : "Pas de ban") : undefined}>
            {shown && <img src={champImg(shown)} alt={champName(shown)} className={`size-full grayscale ${done ? "" : "opacity-50"}`} />}
            {done && <span aria-hidden className="absolute inset-0 bg-[linear-gradient(45deg,transparent_46%,#e84057_48%,#e84057_52%,transparent_54%)]" />}
          </div>
        );
      })}
    </div>
  );

  const teamColumn = (side: Side) => {
    const color = side === "blue" ? "border-blue-side" : "border-red-side";
    return (
      <div className="flex flex-col gap-2">
        <div className={`font-display text-sm tracking-widest ${side === "blue" ? "text-blue-side" : "text-red-side text-right"}`}>{names[side]}</div>
        {ROLES.map((r, i) => {
          const pick = draft.picks[side][i];
          const active = step?.type === "pick" && step.side === side && i === draft.picks[side].length;
          const shown = pick ?? (active ? draft.hover[side] : null);
          const sel = swapPick?.side === side && swapPick.i === i;
          const canSwap = draft.phase === "swap" && controls.includes(side) && !draft.swapReady[side];
          return (
            <button
              key={i}
              type="button"
              onClick={() => clickSlot(side, i)}
              disabled={!canSwap}
              className={`flex items-center gap-3 p-2 border-l-4 ${active ? "border-gold bg-gold/10" : color + " bg-panel/60"} ${side === "red" ? "flex-row-reverse text-right border-l-0 border-r-4" : ""} ${sel ? "ring-2 ring-gold" : ""} disabled:cursor-default enabled:hover:bg-gold/10 transition-colors`}
            >
              <div className={`size-12 sm:size-14 shrink-0 rounded-full overflow-hidden border-2 ${active ? "border-gold active-slot" : "border-gold-dark"} bg-night`}>
                {shown && <img src={champImg(shown)} alt="" className={`size-full scale-110 ${pick ? "" : "opacity-60"}`} />}
              </div>
              <div className="min-w-0">
                <div className={`text-[11px] ${active ? "text-gold" : "text-mute"}`}>
                  {draft.phase === "draft" ? (active ? "Choisit..." : `Pick ${i + 1}`) : r}
                </div>
                <div className="font-display text-sm truncate">{pick ? champName(pick) : active && shown ? champName(shown) : ""}</div>
              </div>
            </button>
          );
        })}
        {draft.phase === "swap" && controls.includes(side) && (
          <button type="button" className="btn-gold py-2 text-xs mt-1" disabled={draft.swapReady[side]} onClick={() => onSwapReady(side)}>
            {draft.swapReady[side] ? "Prêt ✓" : "Valider les rôles"}
          </button>
        )}
      </div>
    );
  };

  const hovered = selected ?? null;
  const stats = hovered ? champStats(hovered) : null;

  return (
    <div className="flex-1 flex flex-col gap-3 px-3 sm:px-4 py-3 max-w-7xl w-full mx-auto">
      {top}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {banRow("blue")}
        <div className="text-center min-w-0 sm:min-w-40">
          <div className="font-display italic text-gold-light text-xs sm:text-2xl" aria-live="polite">{title}</div>
          <div className={`font-display text-4xl sm:text-5xl tabular-nums ${left <= 10 && draft.phase !== "done" ? "text-red-side" : "text-gold-light"}`}>
            {draft.phase === "done" ? "—" : left}
          </div>
          <div className="h-1 bg-line mt-1">
            <div className="h-full bg-gradient-to-r from-red-side to-gold transition-[width] duration-200" style={{ width: `${draft.phase === "done" ? 0 : (left / total) * 100}%` }} />
          </div>
        </div>
        <div className="flex justify-end">{banRow("red")}</div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-[220px_1fr_220px] gap-3 flex-1">
        <div className="order-1">{teamColumn("blue")}</div>
        <section className="order-3 lg:order-2 col-span-2 lg:col-span-1 gold-frame bg-panel/70 p-3 flex flex-col gap-2 min-h-[320px]" aria-label="Champions">
          {draft.phase === "swap" ? (
            <p className="m-auto text-center text-text max-w-sm">
              Clique sur deux de tes champions pour échanger leurs rôles, puis valide. Les rôles sont pré-remplis d&apos;après les games pro.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  aria-label="Rechercher un champion"
                  className="bg-night border border-gold-dark px-2 py-1 text-sm flex-1 min-w-32"
                />
                {ROLES.map((r) => (
                  <button key={r} type="button" onClick={() => setRole(role === r ? null : r)} aria-pressed={role === r} className={`text-[11px] px-2 py-1 border ${role === r ? "border-gold text-gold" : "border-line text-mute"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5 overflow-y-auto max-h-[46vh] pr-1">
                {list.map((id) => {
                  const free = isAvailable(draft, id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!free || !myTurn}
                      onClick={() => step && onHover(step.side, id)}
                      title={champName(id)}
                      className={`relative aspect-square border ${selected === id ? "border-gold ring-2 ring-gold" : "border-transparent"} ${free ? "" : "grayscale opacity-30"} enabled:hover:border-gold-light disabled:cursor-not-allowed`}
                    >
                      <img src={champImg(id)} alt={champName(id)} loading="lazy" className="size-full" />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-auto pt-2 border-t border-line">
                <div className="text-xs text-text flex-1 min-w-48">
                  {hovered && stats ? (
                    <>
                      <span className="font-display text-gold-light">{champName(hovered)}</span> — présence {pct(stats.presence)} · pick {pct(stats.pickRate)} · ban {pct(stats.banRate)} · winrate {pct(stats.winrate)}
                    </>
                  ) : (
                    <span className="text-mute">{myTurn ? "Sélectionne un champion" : "En attente..."}</span>
                  )}
                </div>
                {myTurn && step?.type === "ban" && (
                  <button type="button" className="text-xs text-mute underline" onClick={() => onLock(step.side, null)}>
                    Ne rien bannir
                  </button>
                )}
                <button type="button" className="btn-gold px-8 py-2" disabled={!myTurn || !selected} onClick={() => step && onLock(step.side, selected)}>
                  {step?.type === "ban" ? "Bannir" : "Lock in"}
                </button>
              </div>
            </>
          )}
        </section>
        <div className="order-2 lg:order-3">{teamColumn("red")}</div>
      </div>
    </div>
  );
}
