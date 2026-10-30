"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PRO } from "@/lib/data";
import { newCode, normalizeCode } from "@/lib/room";

// Small segmented control (radio group look).
function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex p-1 rounded-xl bg-canvas border border-edge">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${value === v ? "bg-raised text-fg shadow-sm" : "text-muted hover:text-fg"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [side, setSide] = useState<"blue" | "red" | "random">("blue");
  const [bo, setBo] = useState<"1" | "3" | "5">("1");
  const [fearless, setFearless] = useState(false);
  const [join, setJoin] = useState("");
  const [aiSide, setAiSide] = useState<"blue" | "red">("blue");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from browser storage after hydration
      setName(localStorage.getItem("draftdiff:name") ?? "");
    } catch {}
  }, []);

  function saveName() {
    try {
      localStorage.setItem("draftdiff:name", name.trim());
    } catch {}
  }

  function create() {
    saveName();
    const code = newCode();
    try {
      sessionStorage.setItem(`draftdiff:create:${code}`, JSON.stringify({ side, format: Number(bo), fearless }));
    } catch {}
    router.push(`/r/${code}`);
  }

  const m = PRO.meta;
  const input = "w-full rounded-xl bg-canvas border border-edge px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent outline-none transition-colors";
  const label = "block text-xs font-medium text-muted mb-1.5";
  const query = `bo=${bo}&fearless=${fearless ? 1 : 0}`;

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-12 sm:py-16 flex flex-col gap-10">
      <header className="flex flex-col gap-3 max-w-2xl">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-edge bg-surface px-3 py-1 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-ok" />
          {m.games} games pro{m.patches.length > 0 && ` · patchs ${m.patches.at(-1)} → ${m.patches[0]}`}
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Draftez comme en pro.</h1>
        <p className="text-muted text-base sm:text-lg">
          Format tournoi, vrais timers, Fearless. À la fin, on compare les deux drafts avec les stats des ligues pro.
        </p>
      </header>

      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
        <section className="card p-6 flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-semibold">Jouer contre un ami</h2>
            <p className="text-sm text-muted">Crée une partie et envoie-lui le code ou le lien.</p>
          </div>
          <div>
            <label className={label} htmlFor="name">Pseudo</label>
            <input id="name" className={input} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Ton pseudo" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <span className={label}>Side</span>
              <Seg label="Side" value={side} onChange={setSide} options={[["blue", "Bleu"], ["red", "Rouge"], ["random", "Aléatoire"]]} />
            </div>
            <div>
              <span className={label}>Format</span>
              <Seg label="Format" value={bo} onChange={setBo} options={[["1", "Bo1"], ["3", "Bo3"], ["5", "Bo5"]]} />
            </div>
          </div>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span>
              <span className="text-sm font-medium">Fearless</span>
              <span className="block text-xs text-muted">Un champion joué est interdit aux deux équipes pour le reste de la série.</span>
            </span>
            <input type="checkbox" role="switch" aria-label="Fearless" checked={fearless} onChange={(e) => setFearless(e.target.checked)} className="peer sr-only" />
            <span aria-hidden className="relative shrink-0 w-10 h-6 rounded-full bg-raised border border-edge transition-colors peer-checked:bg-accent peer-checked:border-transparent peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4.5 after:rounded-full after:bg-fg after:transition-transform peer-checked:after:translate-x-4" />
          </label>
          <button className="btn primary w-full py-3" onClick={create}>Créer la partie</button>

          <form
            className="flex gap-2 pt-5 border-t border-edge"
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
              const c = normalizeCode(join);
              if (c) router.push(`/r/${c}`);
            }}
          >
            <input
              aria-label="Code de la partie"
              className={`${input} uppercase tracking-[0.25em] font-mono`}
              value={join}
              maxLength={6}
              onChange={(e) => setJoin(e.target.value)}
              placeholder="CODE"
            />
            <button className="btn shrink-0" disabled={!normalizeCode(join)}>Rejoindre</button>
          </form>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card p-6 flex flex-col gap-4 flex-1">
            <div>
              <h2 className="text-lg font-semibold">Solo contre l&apos;IA</h2>
              <p className="text-sm text-muted">L&apos;IA drafte avec les stats pro : priorités, contre-picks, cohérence.</p>
            </div>
            <Seg label="Ton side" value={aiSide} onChange={setAiSide} options={[["blue", "Bleu"], ["red", "Rouge"]]} />
            <button className="btn mt-auto" onClick={() => router.push(`/play?mode=ai&side=${aiSide}&${query}`)}>Lancer</button>
          </section>
          <section className="card p-6 flex flex-col gap-4 flex-1">
            <div>
              <h2 className="text-lg font-semibold">Bac à sable</h2>
              <p className="text-sm text-muted">Tu contrôles les deux équipes, pour préparer une draft.</p>
            </div>
            <button className="btn mt-auto" onClick={() => router.push(`/play?mode=sandbox&${query}`)}>Lancer</button>
          </section>
        </div>
      </div>
    </div>
  );
}
