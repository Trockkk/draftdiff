"use client";
/* eslint-disable @next/next/no-img-element -- Data Dragon images, no optimisation needed */
import Link from "next/link";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import RoleIcon from "@/components/RoleIcon";
import { ACTION_SECONDS, ROLE_SWAP_SECONDS, ROLES, type Role, type Side } from "@/lib/draft/config";
import { currentStep, isAvailable, type DraftState } from "@/lib/draft/machine";
import { CHAMPION_IDS, champImg, champName, champStats, mapImg, ROLE_MAP, splashImg } from "@/lib/data";

type Props = {
  draft: DraftState;
  clockOffset?: number; // server time - local time (online)
  controls: Side[]; // sides this screen may act for
  names: Record<Side, string>;
  info?: ReactNode; // series score, connection status... (bottom bar)
  onHover: (side: Side, champ: string | null) => void;
  onLock: (side: Side, champ: string | null) => void;
  onSwap: (side: Side, i: number, j: number) => void;
  onSwapReady: (side: Side) => void;
};

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)} %`);
const SIDE_COLOR = { blue: "bg-blue-side", red: "bg-red-side" };

function useNow(offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 200);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

export default function ChampSelect({ draft, clockOffset = 0, controls, names, info, onHover, onLock, onSwap, onSwapReady }: Props) {
  const now = useNow(clockOffset);
  const step = currentStep(draft);
  const myTurn = !!step && controls.includes(step.side);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [swapPick, setSwapPick] = useState<{ side: Side; i: number } | null>(null);

  const running = draft.phase !== "done";
  const total = draft.phase === "swap" ? ROLE_SWAP_SECONDS : ACTION_SECONDS;
  const remaining = Math.max(0, (draft.deadline - now) / 1000);
  const left = Math.ceil(remaining);
  const selected = step ? draft.hover[step.side] : null;
  const isBan = step?.type === "ban";
  // "Aucun" tile picked for this ban step (a null hover can't tell "nothing chosen" from "no ban").
  const [noneAt, setNoneAt] = useState(-1);
  const noneSel = isBan && myTurn && noneAt === draft.step;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CHAMPION_IDS.filter((id) => (!q || champName(id).toLowerCase().includes(q)) && (!role || (ROLE_MAP[id] ?? []).includes(role)));
  }, [search, role]);

  let title = "Draft terminée";
  if (step) {
    if (!myTurn) title = `${names[step.side]} ${step.type === "ban" ? "bannit..." : "choisit..."}`;
    else if (controls.length === 1) title = step.type === "ban" ? "À toi de bannir !" : "À toi de choisir !";
    else title = `${step.side === "blue" ? "Blue side" : "Red side"} ${step.type === "ban" ? "bannit" : "choisit"}`;
  } else if (draft.phase === "swap") title = "Échange des rôles";

  function clickSlot(side: Side, i: number) {
    if (draft.phase !== "swap" || !controls.includes(side) || draft.swapReady[side]) return;
    if (swapPick && swapPick.side === side) {
      if (swapPick.i !== i) onSwap(side, swapPick.i, i);
      setSwapPick(null);
    } else setSwapPick({ side, i });
  }

  const banRow = (side: Side) => (
    <div className={`flex gap-1.5 ${side === "red" ? "flex-row-reverse" : ""}`} aria-label={`Bans ${names[side]}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const b = draft.bans[side][i];
        const done = i < draft.bans[side].length;
        const active = step?.type === "ban" && step.side === side && i === draft.bans[side].length;
        const shown = b ?? (active ? draft.hover[side] : null);
        return (
          <div
            key={i}
            className={`relative size-7 sm:size-9 xl:size-11 overflow-hidden border ${active ? "border-gold active-slot" : "border-gold-dark/70"} bg-night/80`}
            title={done ? (b ? `${champName(b)} (banni)` : "Pas de ban") : undefined}
          >
            {shown && <img key={shown} src={champImg(shown)} alt={champName(shown)} className={`size-full anim-fade ${done ? "grayscale brightness-75" : "opacity-60"}`} />}
            {done && (
              <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                <span className="block w-[140%] h-[2px] -rotate-45">
                  <span className="block size-full bg-red-side anim-slash" />
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  const teamColumn = (side: Side) => {
    const red = side === "red";
    const canSwap = draft.phase === "swap" && controls.includes(side) && !draft.swapReady[side];
    return (
      <div className="flex flex-col min-h-0 gap-1 lg:h-full">
        <div className={`font-display text-xs sm:text-sm tracking-[0.2em] px-2 truncate ${red ? "text-red-side text-right" : "text-blue-side"}`}>{names[side]}</div>
        <div className="flex flex-col gap-1 lg:flex-1 lg:min-h-0">
          {ROLES.map((r, i) => {
            const pick = draft.picks[side][i];
            const active = step?.type === "pick" && step.side === side && i === draft.picks[side].length;
            const shown = pick ?? (active ? draft.hover[side] : null);
            const sel = swapPick?.side === side && swapPick.i === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => clickSlot(side, i)}
                disabled={!canSwap}
                aria-label={`${r} ${names[side]} : ${pick ? champName(pick) : "vide"}`}
                className={`group relative flex-1 min-h-14 lg:min-h-0 overflow-hidden flex items-center gap-3 px-3 text-left ${red ? "flex-row-reverse text-right" : ""} ${active ? "bg-gold/10" : "bg-panel/50"} ${sel ? "ring-2 ring-gold ring-inset" : ""} disabled:cursor-default enabled:hover:bg-gold/10 transition-colors`}
              >
                {pick && (
                  <img
                    key={pick}
                    src={splashImg(pick)}
                    alt=""
                    style={{ ["--from" as string]: red ? "24px" : "-24px" }}
                    className={`hidden lg:block absolute inset-0 size-full object-cover object-[50%_18%] anim-splash ${red ? "[mask-image:linear-gradient(to_left,#000_20%,transparent_95%)]" : "[mask-image:linear-gradient(to_right,#000_20%,transparent_95%)]"} opacity-70`}
                  />
                )}
                {pick && <span key={`f-${pick}`} aria-hidden className="absolute inset-0 bg-gradient-to-r from-gold-light/60 to-transparent anim-flash pointer-events-none" />}
                {active && (
                  <motion.span
                    layoutId={`active-${side}`}
                    aria-hidden
                    className={`absolute top-0 bottom-0 w-1 ${red ? "right-0" : "left-0"} ${SIDE_COLOR[side]} shadow-[0_0_12px_currentColor]`}
                  />
                )}
                <div className={`relative flex items-center gap-3 min-w-0 ${red ? "flex-row-reverse" : ""}`}>
                  <motion.div
                    layoutId={pick ? `pick-${side}-${pick}` : undefined}
                    className={`relative shrink-0 size-11 sm:size-14 xl:size-16 rounded-full overflow-hidden border-2 ${active ? "border-gold active-slot" : "border-gold-dark"} bg-night`}
                  >
                    {shown && <img key={shown} src={champImg(shown)} alt="" className={`size-full scale-110 anim-fade ${pick ? "" : "opacity-50"}`} />}
                  </motion.div>
                  <div className="min-w-0 [text-shadow:0_1px_3px_#000,0_0_8px_#000]">
                    <div className={`flex items-center gap-1 text-[10px] sm:text-[11px] tracking-widest ${red ? "flex-row-reverse" : ""} ${active ? "text-gold" : pick ? "text-gold-light/90" : "text-mute"}`}>
                      {draft.phase !== "draft" && <RoleIcon role={r} className="size-3.5" />}
                      {active ? (step?.side === side && controls.includes(side) ? "À TOI" : "CHOISIT...") : draft.phase === "draft" ? `PICK ${i + 1}` : r}
                    </div>
                    <div className="font-display text-sm xl:text-base truncate drop-shadow">{pick ? champName(pick) : active && shown ? champName(shown) : ""}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {draft.phase === "swap" && controls.includes(side) && (
          <button type="button" className="btn-gold py-2 text-xs mt-1" disabled={draft.swapReady[side]} onClick={() => onSwapReady(side)}>
            {draft.swapReady[side] ? "Prêt ✓" : "Valider les rôles"}
          </button>
        )}
      </div>
    );
  };

  const stats = selected ? champStats(selected) : null;

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <LayoutGroup>
        <div className="relative flex flex-col gap-2 sm:gap-3 px-2 sm:px-4 pt-2 sm:pt-3 pb-2 lg:fixed lg:inset-0 lg:z-20 lg:overflow-hidden bg-night lg:bg-[radial-gradient(ellipse_at_50%_35%,rgba(0,90,130,0.35),transparent_60%),linear-gradient(180deg,#010a13,#0a1428)]">
          {/* Summoner's Rift backdrop behind the champion panel */}
          <img src={mapImg()} alt="" aria-hidden className="hidden lg:block pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 h-[78%] aspect-square object-contain opacity-20 blur-[1.5px] saturate-50" />
          <div aria-hidden className="hidden lg:block pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 size-[40vh] rounded-full bg-blue-side/10 blur-3xl" />

          <header className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            {banRow("blue")}
            <div className="text-center min-w-0 sm:min-w-56 xl:min-w-80">
              <div key={title} className="font-display italic text-gold-light text-xs sm:text-xl xl:text-2xl anim-fade truncate" aria-live="polite">
                {title}
              </div>
              <div className={`font-display text-4xl sm:text-5xl xl:text-6xl tabular-nums leading-none mt-1 ${left <= 10 && running ? "text-red-side" : "text-gold-light"}`}>
                <span suppressHydrationWarning className={`inline-block ${left <= 5 && running && left > 0 ? "anim-beat" : ""}`}>{running ? left : "—"}</span>
              </div>
              <div className="h-[3px] bg-line/80 mt-2 overflow-hidden">
                {running && (
                  // Width follows the real remaining time; the 200 ms linear transition smooths the 200 ms ticks.
                  <div
                    suppressHydrationWarning
                    className={`h-full origin-center transition-transform duration-200 ease-linear ${remaining <= 10 ? "bg-red-side" : "bg-gradient-to-r from-gold-dark via-gold to-gold-dark"}`}
                    style={{ transform: `scaleX(${Math.min(1, remaining / total)})` }}
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end">{banRow("red")}</div>
          </header>

          <div className="relative grid grid-cols-2 lg:grid-cols-[minmax(220px,22%)_1fr_minmax(220px,22%)] gap-2 sm:gap-4 lg:flex-1 lg:min-h-0">
            <div className="order-1 min-h-0">{teamColumn("blue")}</div>

            <section className="order-3 lg:order-2 col-span-2 lg:col-span-1 flex flex-col min-h-0 border border-gold-dark/50 bg-night/55 backdrop-blur-[2px]" aria-label="Champions">
              {draft.phase === "swap" ? (
                <div className="m-auto text-center p-6 max-w-md anim-rise">
                  <p className="font-display text-gold text-xl mb-2">Échange des rôles</p>
                  <p className="text-text text-sm">
                    Clique sur deux de tes champions pour échanger leurs rôles, puis valide. Les rôles sont pré-remplis d&apos;après les games pro.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 items-center p-2 sm:p-3 border-b border-gold-dark/40">
                    <div className="relative flex-1 min-w-36">
                      <svg viewBox="0 0 24 24" aria-hidden className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-mute">
                        <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher"
                        aria-label="Rechercher un champion"
                        className="w-full bg-night/80 border border-gold-dark/60 focus:border-gold pl-8 pr-2 py-1.5 text-sm outline-none transition-colors"
                      />
                    </div>
                    <div className="flex gap-1">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(role === r ? null : r)}
                          aria-pressed={role === r}
                          aria-label={`Filtrer ${r}`}
                          title={r}
                          className={`p-1.5 border transition-colors ${role === r ? "border-gold text-gold bg-gold/10" : "border-transparent text-mute hover:text-gold-light"}`}
                        >
                          <RoleIcon role={r} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 max-h-[52vh] lg:max-h-none overflow-y-auto fade-edges px-2 sm:px-3 py-3">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-x-2 gap-y-3">
                      {isBan && (
                        <button
                          type="button"
                          disabled={!myTurn}
                          onClick={() => {
                            setNoneAt(draft.step);
                            onHover(step.side, null);
                          }}
                          aria-label="Aucun ban"
                          className="group flex flex-col items-center gap-1 disabled:cursor-not-allowed"
                        >
                          <span className={`relative flex items-center justify-center w-full aspect-square border bg-night transition-[transform,border-color] duration-150 ${noneSel ? "border-red-side ring-2 ring-red-side scale-105" : "border-gold-dark/50 group-enabled:group-hover:border-gold-light group-enabled:group-hover:scale-105"}`}>
                            <svg viewBox="0 0 24 24" aria-hidden className="w-1/2 text-mute">
                              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                              <path d="M5.6 18.4 18.4 5.6" stroke="currentColor" strokeWidth="2" />
                            </svg>
                          </span>
                          <span className={`text-[10px] leading-tight ${noneSel ? "text-red-side" : "text-text"}`}>Aucun</span>
                        </button>
                      )}
                      {list.map((id) => {
                        const free = isAvailable(draft, id);
                        const isSel = selected === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={!free || !myTurn}
                            onClick={() => {
                              setNoneAt(-1);
                              if (step) onHover(step.side, id);
                            }}
                            title={champName(id)}
                            className="group flex flex-col items-center gap-1 disabled:cursor-not-allowed"
                          >
                            <span className={`relative block w-full aspect-square overflow-hidden border transition-[transform,border-color] duration-150 ${isSel ? "border-gold ring-2 ring-gold scale-105" : "border-gold-dark/50"} ${free ? "group-enabled:group-hover:border-gold-light group-enabled:group-hover:scale-105" : ""}`}>
                              <img src={champImg(id)} alt="" loading="lazy" className={`size-full scale-110 ${free ? "" : "grayscale opacity-35"}`} />
                              {!free && (
                                <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                                  <span className="block w-[140%] h-px bg-gold-light/50 -rotate-45" />
                                </span>
                              )}
                            </span>
                            <span className={`text-[10px] leading-tight w-full truncate text-center ${free ? (isSel ? "text-gold" : "text-text") : "text-mute/60"}`}>{champName(id)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sticky bottom-0 lg:static flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-2 sm:p-3 border-t border-gold-dark/40 bg-night/90 lg:bg-transparent">
                    <div className="text-[11px] text-text min-h-4 w-full text-center" aria-live="polite">
                      {selected && stats ? (
                        <>
                          <span className="font-display text-gold-light">{champName(selected)}</span> · présence {pct(stats.presence)} · pick {pct(stats.pickRate)} · ban {pct(stats.banRate)} · winrate {pct(stats.winrate)}
                        </>
                      ) : noneSel ? (
                        <span className="text-text">Aucun champion banni</span>
                      ) : (
                        <span className="text-mute">{myTurn ? "Sélectionne un champion" : "En attente..."}</span>
                      )}
                    </div>
                    <div className="relative">
                      {myTurn && (selected || noneSel) && <div aria-hidden className={`lock-glow absolute -inset-2 blur-md ${isBan ? "bg-red-side/40" : "bg-gold/40"}`} />}
                      <button
                        type="button"
                        className={`btn-lock relative px-12 sm:px-16 py-2.5 text-sm ${isBan ? "ban" : ""}`}
                        disabled={!myTurn || !(selected || noneSel)}
                        onClick={() => step && onLock(step.side, noneSel ? null : selected)}
                      >
                        {isBan ? "Ban" : "Lock in"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <div className="order-2 lg:order-3 min-h-0">{teamColumn("red")}</div>
          </div>

          <footer className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-mute">
            <Link href="/" className="font-display text-gold tracking-widest hover:text-gold-light">DRAFTDIFF</Link>
            <div className="flex-1 flex justify-center">{info}</div>
            <p className="hidden lg:block max-w-md text-[9px] leading-tight text-right opacity-70">
              Draftdiff isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
            </p>
          </footer>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
