"use client";
/* eslint-disable @next/next/no-img-element -- Data Dragon images, no optimisation needed */
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Logo from "@/components/Logo";
import RoleIcon from "@/components/RoleIcon";
import { ACTION_SECONDS, DRAFT_ORDER, ROLE_SWAP_SECONDS, ROLES, type Role, type Side } from "@/lib/draft/config";
import { currentStep, isAvailable, type DraftState } from "@/lib/draft/machine";
import { CHAMPION_IDS, champImg, champName, fullSplashImg, ROLE_MAP } from "@/lib/data";

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

const TEXT = { blue: "text-blue-side", red: "text-red-side" };
const BG = { blue: "bg-blue-side", red: "bg-red-side" };
const BORDER = { blue: "border-blue-side/70", red: "border-red-side/70" };

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
  // When it's not your turn the grid folds away and the stage shows the other side's hover.
  // peekAt reopens it for the current step only.
  const [peekAt, setPeekAt] = useState(-1);
  const canFold = draft.phase === "draft" && !myTurn;
  const folded = canFold && peekAt !== draft.step;
  // Last action was a ban of a real champion: play the shatter animation (keyed by ban count).
  const last = DRAFT_ORDER[draft.step - 1];
  const lastBan = draft.phase === "draft" && last?.type === "ban" ? draft.bans[last.side].at(-1) : null;
  const banCount = draft.bans.blue.length + draft.bans.red.length;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CHAMPION_IDS.filter((id) => (!q || champName(id).toLowerCase().includes(q)) && (!role || (ROLE_MAP[id] ?? []).includes(role)));
  }, [search, role]);

  let title = "Draft terminée";
  if (step) {
    if (!myTurn) title = `${names[step.side]} ${step.type === "ban" ? "bannit…" : "choisit…"}`;
    else if (controls.length === 1) title = step.type === "ban" ? "À toi de bannir" : "À toi de choisir";
    else title = `${names[step.side]} ${step.type === "ban" ? "bannit" : "choisit"}`;
  } else if (draft.phase === "swap") title = "Échange des rôles";

  function clickSlot(side: Side, i: number) {
    if (draft.phase !== "swap" || !controls.includes(side) || draft.swapReady[side]) return;
    if (swapPick && swapPick.side === side) {
      if (swapPick.i !== i) onSwap(side, swapPick.i, i);
      setSwapPick(null);
    } else setSwapPick({ side, i });
  }

  const teamHeader = (side: Side) => {
    const red = side === "red";
    return (
      <div className={`flex flex-col gap-2 min-w-0 ${red ? "items-end" : ""}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold min-w-0 ${red ? "flex-row-reverse" : ""}`}>
          <span aria-hidden className={`size-2 rounded-full shrink-0 ${BG[side]}`} />
          <span className="truncate">{names[side]}</span>
        </div>
        <div className={`flex gap-1.5 ${red ? "flex-row-reverse" : ""}`} aria-label={`Bans ${names[side]}`}>
          {Array.from({ length: 5 }, (_, i) => {
            const b = draft.bans[side][i];
            const done = i < draft.bans[side].length;
            const active = isBan && step?.side === side && i === draft.bans[side].length;
            const shown = b ?? (active ? draft.hover[side] : null);
            return (
              <div
                key={i}
                className={`relative size-8 sm:size-10 xl:size-12 rounded-lg overflow-hidden bg-raised border ${active ? "border-red-side text-red-side active-slot" : "border-edge"}`}
                title={done ? (b ? `${champName(b)} (banni)` : "Pas de ban") : undefined}
              >
                {shown && <img key={shown} src={champImg(shown)} alt={champName(shown)} className={`size-full scale-110 anim-fade ${done ? "grayscale opacity-50" : "opacity-60"}`} />}
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
      </div>
    );
  };

  const teamColumn = (side: Side) => {
    const red = side === "red";
    const canSwap = draft.phase === "swap" && controls.includes(side) && !draft.swapReady[side];
    return (
      <div className="flex flex-col min-h-0 gap-2 lg:h-full">
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
              className={`relative flex-1 min-h-14 lg:min-h-0 overflow-hidden flex items-center gap-3 px-3 rounded-xl border bg-surface transition-colors ${red ? "flex-row-reverse text-right" : "text-left"} ${active ? `${BORDER[side]} ${TEXT[side]} active-slot` : "border-edge"} ${sel ? "ring-2 ring-accent" : ""} disabled:cursor-default enabled:hover:border-faint`}
            >
              {pick && <span key={`f-${pick}`} aria-hidden className="absolute inset-0 bg-fg/15 anim-flash pointer-events-none" />}
              <motion.div
                layoutId={pick ? `pick-${side}-${pick}` : undefined}
                className="relative shrink-0 size-11 sm:size-12 xl:size-14 rounded-lg overflow-hidden bg-raised"
              >
                {shown && <img key={shown} src={champImg(shown)} alt="" className={`size-full scale-110 anim-fade ${pick ? "" : "opacity-40"}`} />}
              </motion.div>
              <div className="min-w-0">
                <div className={`flex items-center gap-1.5 text-[11px] font-medium ${red ? "flex-row-reverse" : ""} ${active ? "" : "text-faint"}`}>
                  {draft.phase !== "draft" && <RoleIcon role={r} className="size-3.5" />}
                  {active ? (controls.includes(side) ? "À toi" : "Choisit…") : draft.phase === "draft" ? `Pick ${i + 1}` : r.charAt(0) + r.slice(1).toLowerCase()}
                </div>
                <div className="text-sm xl:text-base font-semibold text-fg truncate">{pick ? champName(pick) : active && shown ? champName(shown) : ""}</div>
              </div>
            </button>
          );
        })}
        {draft.phase === "swap" && controls.includes(side) && (
          <button type="button" className="btn primary" disabled={draft.swapReady[side]} onClick={() => onSwapReady(side)}>
            {draft.swapReady[side] ? "Prêt ✓" : "Valider les rôles"}
          </button>
        )}
      </div>
    );
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <LayoutGroup>
        <div className="relative flex flex-col gap-3 sm:gap-4 px-3 sm:px-6 pt-3 sm:pt-5 pb-3 bg-canvas lg:fixed lg:inset-0 lg:z-20 lg:overflow-hidden">
          {/* faint team-colored glows, nothing else in the background */}
          <div aria-hidden className="hidden lg:block pointer-events-none absolute -left-40 top-1/3 size-[480px] rounded-full bg-blue-side/[0.06] blur-3xl" />
          <div aria-hidden className="hidden lg:block pointer-events-none absolute -right-40 top-1/3 size-[480px] rounded-full bg-red-side/[0.06] blur-3xl" />

          <header className="relative grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            {teamHeader("blue")}
            <div className="text-center min-w-0 w-28 sm:w-56 xl:w-72">
              <div key={title} className="text-xs sm:text-sm font-medium text-muted anim-fade truncate" aria-live="polite">
                {title}
              </div>
              <div className={`text-4xl sm:text-5xl font-semibold tabular-nums tracking-tight leading-tight transition-colors ${left <= 10 && running ? "text-red-side" : "text-fg"}`}>
                <span suppressHydrationWarning className={`inline-block ${left <= 5 && running && left > 0 ? "anim-beat" : ""}`}>{running ? left : "—"}</span>
              </div>
              <div className="h-1 rounded-full bg-raised mt-1 overflow-hidden">
                {running && (
                  // Width follows the real remaining time; the 200 ms linear transition smooths the 200 ms ticks.
                  <div
                    suppressHydrationWarning
                    className={`h-full rounded-full origin-center transition-transform duration-200 ease-linear ${remaining <= 10 ? "bg-red-side" : "bg-accent"}`}
                    style={{ transform: `scaleX(${Math.min(1, remaining / total)})` }}
                  />
                )}
              </div>
            </div>
            {teamHeader("red")}
          </header>

          <div className="relative grid grid-cols-2 lg:grid-cols-[minmax(220px,21%)_1fr_minmax(220px,21%)] gap-2 sm:gap-4 lg:flex-1 lg:min-h-0">
            <div className="order-1 min-h-0">{teamColumn("blue")}</div>

            <section
              className={`relative order-3 lg:order-2 col-span-2 lg:col-span-1 flex flex-col min-h-0 rounded-2xl overflow-hidden transition-colors duration-300 ${folded ? "min-h-72 lg:min-h-0 bg-surface/40 border border-edge/50" : "card"}`}
              aria-label="Champions"
            >
              {canFold && (
                <button
                  type="button"
                  onClick={() => setPeekAt(folded ? draft.step : -1)}
                  aria-expanded={!folded}
                  aria-label={folded ? "Afficher les champions" : "Masquer les champions"}
                  className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-full border border-edge bg-raised/90 backdrop-blur px-3 py-1 text-xs text-muted hover:text-fg transition-colors"
                >
                  {folded ? "Voir les champions" : "Masquer"}
                  <svg viewBox="0 0 24 24" aria-hidden className={`size-3.5 transition-transform ${folded ? "" : "rotate-180"}`}>
                    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}

              {/* Ban shatter: the banned champion turns red/grey and breaks in two. */}
              {lastBan && (
                <div key={banCount} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,#000_40%,transparent_78%)]">
                  <img src={fullSplashImg(lastBan)} alt="" className="shatter-a absolute inset-0 size-full object-cover" />
                  <img src={fullSplashImg(lastBan)} alt="" className="shatter-b absolute inset-0 size-full object-cover" />
                  <span className="shatter-label absolute inset-x-0 bottom-[14%] text-center text-3xl sm:text-4xl font-semibold tracking-tight text-red-side">
                    {champName(lastBan)} banni
                  </span>
                </div>
              )}

              {folded ? (
                <div className="relative flex-1 flex flex-col items-center justify-end overflow-hidden pb-8">
                  {selected ? (
                    <>
                      <img
                        key={selected}
                        src={fullSplashImg(selected)}
                        alt=""
                        className="absolute inset-0 size-full object-cover anim-fade [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]"
                      />
                      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas/90 to-transparent" />
                      <p key={`n-${selected}`} className="relative text-3xl sm:text-5xl font-semibold tracking-tight anim-rise">
                        {champName(selected)}
                      </p>
                      <p className={`relative text-sm mt-1 ${step ? TEXT[step.side] : ""}`}>{step && `${names[step.side]} ${isBan ? "veut bannir" : "survole"}`}</p>
                    </>
                  ) : (
                    <p className="relative m-auto text-muted">{step && `${names[step.side]} réfléchit…`}</p>
                  )}
                </div>
              ) : draft.phase === "swap" ? (
                <div className="m-auto text-center p-6 max-w-sm anim-rise">
                  <p className="text-lg font-semibold mb-1">Échange des rôles</p>
                  <p className="text-muted text-sm">
                    Clique sur deux de tes champions pour échanger leurs rôles, puis valide. Les rôles sont pré-remplis d&apos;après les games pro.
                  </p>
                </div>
              ) : (
                <>
                  <div className={`flex flex-wrap gap-2 items-center p-3 border-b border-edge ${canFold ? "pt-12" : ""}`}>
                    <div className="relative flex-1 min-w-36">
                      <svg viewBox="0 0 24 24" aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint">
                        <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                        <path d="m20 20-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher"
                        aria-label="Rechercher un champion"
                        className="w-full rounded-xl bg-canvas border border-edge focus:border-accent pl-9 pr-3 py-2 text-sm placeholder:text-faint outline-none transition-colors"
                      />
                    </div>
                    <div className="flex p-1 rounded-xl bg-canvas border border-edge">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(role === r ? null : r)}
                          aria-pressed={role === r}
                          aria-label={`Filtrer ${r}`}
                          title={r}
                          className={`p-1.5 rounded-lg transition-colors ${role === r ? "bg-raised text-fg" : "text-faint hover:text-fg"}`}
                        >
                          <RoleIcon role={r} className="size-4.5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 max-h-[52vh] lg:max-h-none overflow-y-auto fade-edges p-3">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-x-2.5 gap-y-3">
                      {isBan && (
                        <button
                          type="button"
                          disabled={!myTurn}
                          onClick={() => {
                            setNoneAt(draft.step);
                            onHover(step.side, null);
                          }}
                          aria-label="Aucun ban"
                          className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                        >
                          <span className={`flex items-center justify-center w-full aspect-square rounded-lg bg-raised border transition-[transform,border-color] duration-150 ${noneSel ? "border-red-side ring-2 ring-red-side/60 scale-105" : "border-edge group-enabled:group-hover:border-faint group-enabled:group-hover:scale-105"}`}>
                            <svg viewBox="0 0 24 24" aria-hidden className="w-1/2 text-faint">
                              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
                              <path d="M5.6 18.4 18.4 5.6" stroke="currentColor" strokeWidth="1.75" />
                            </svg>
                          </span>
                          <span className={`text-[11px] leading-tight ${noneSel ? "text-red-side" : "text-muted"}`}>Aucun</span>
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
                            className="group flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                          >
                            <span
                              className={`relative block w-full aspect-square rounded-lg overflow-hidden border transition-[transform,border-color,opacity] duration-150 ${isSel ? `scale-105 ring-2 ${isBan ? "border-red-side ring-red-side/60" : "border-accent ring-accent/60"}` : "border-transparent"} ${free ? "group-enabled:group-hover:scale-105 group-enabled:group-hover:border-faint" : "opacity-25"}`}
                            >
                              <img src={champImg(id)} alt="" loading="lazy" className={`size-full scale-110 ${free ? "" : "grayscale"}`} />
                            </span>
                            <span className={`text-[11px] leading-tight w-full truncate text-center ${isSel ? "text-fg font-medium" : free ? "text-muted" : "text-faint/60"}`}>{champName(id)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="sticky bottom-0 lg:static flex justify-center p-3 border-t border-edge bg-surface">
                    <button
                      type="button"
                      className={`btn ${isBan ? "danger" : "primary"} min-w-48 py-2.5`}
                      disabled={!myTurn || !(selected || noneSel)}
                      onClick={() => step && onLock(step.side, noneSel ? null : selected)}
                    >
                      {isBan ? "Bannir" : "Verrouiller"}
                    </button>
                  </div>
                </>
              )}
            </section>

            <div className="order-2 lg:order-3 min-h-0">{teamColumn("red")}</div>
          </div>

          <footer className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="hidden lg:inline"><Logo /></span>
            <div className="flex-1 flex justify-center">{info}</div>
            <p className="hidden lg:block max-w-sm text-[9px] leading-tight text-right text-faint">
              Draftdiff isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
            </p>
          </footer>
        </div>
      </LayoutGroup>
    </MotionConfig>
  );
}
