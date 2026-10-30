"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PRO } from "@/lib/data";
import { newCode, normalizeCode } from "@/lib/room";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [side, setSide] = useState<"blue" | "red" | "random">("blue");
  const [bo, setBo] = useState("1");
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
  const label = "block text-xs text-mute mb-1";
  const input = "w-full bg-night border border-gold-dark px-2 py-2";

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
      <header className="text-center">
        <h1 className="font-display text-4xl sm:text-6xl text-gold tracking-wider">Draftdiff</h1>
        <p className="text-text mt-2">Draft tournoi League of Legends, vrais timers, verdict basé sur les stats pro.</p>
        <p className="text-xs text-mute mt-1">
          Données : {m.games} games pro
          {m.patches.length > 0 && `, patchs ${m.patches.at(-1)} → ${m.patches[0]}`}
          {m.generatedAt && `, mises à jour le ${new Date(m.generatedAt).toLocaleDateString("fr-FR")}`}
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="gold-frame bg-panel/70 p-5 flex flex-col gap-3 md:row-span-2">
          <h2 className="font-display text-xl text-gold">Jouer contre un ami</h2>
          <div>
            <label className={label} htmlFor="name">Ton pseudo</label>
            <input id="name" className={input} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Faker" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label} htmlFor="side">Side</label>
              <select id="side" className={input} value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
                <option value="blue">Blue</option>
                <option value="red">Red</option>
                <option value="random">Aléatoire</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="bo">Format</label>
              <select id="bo" className={input} value={bo} onChange={(e) => setBo(e.target.value)}>
                <option value="1">Bo1</option>
                <option value="3">Bo3</option>
                <option value="5">Bo5</option>
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={fearless} onChange={(e) => setFearless(e.target.checked)} /> Fearless
            </label>
          </div>
          <button className="btn-gold py-3" onClick={create}>Créer la partie</button>

          <div className="border-t border-line pt-4 mt-2">
            <label className={label} htmlFor="code">Rejoindre avec un code</label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
                const c = normalizeCode(join);
                if (c) router.push(`/r/${c}`);
              }}
            >
              <input id="code" className={`${input} uppercase tracking-[0.3em] font-display`} value={join} maxLength={6} onChange={(e) => setJoin(e.target.value)} placeholder="ABC234" />
              <button className="btn-gold px-4" disabled={!normalizeCode(join)}>Rejoindre</button>
            </form>
          </div>
        </section>

        <section className="gold-frame bg-panel/70 p-5 flex flex-col gap-3">
          <h2 className="font-display text-xl text-gold">Solo contre l&apos;IA</h2>
          <p className="text-sm text-text">L&apos;IA drafte avec les stats pro : champions prioritaires, contre-picks, cohérence de comp.</p>
          <div className="flex gap-2 items-center text-sm">
            Ton side :
            {(["blue", "red"] as const).map((s) => (
              <button key={s} aria-pressed={aiSide === s} onClick={() => setAiSide(s)} className={`px-3 py-1 border ${aiSide === s ? "border-gold text-gold" : "border-line text-mute"}`}>
                {s === "blue" ? "Blue" : "Red"}
              </button>
            ))}
          </div>
          <button className="btn-gold py-2" onClick={() => router.push(`/play?mode=ai&side=${aiSide}&bo=${bo}&fearless=${fearless ? 1 : 0}`)}>Lancer</button>
        </section>

        <section className="gold-frame bg-panel/70 p-5 flex flex-col gap-3">
          <h2 className="font-display text-xl text-gold">Bac à sable</h2>
          <p className="text-sm text-text">Tu contrôles les deux équipes : pour théorycrafter ou préparer une draft.</p>
          <button className="btn-gold py-2" onClick={() => router.push(`/play?mode=sandbox&bo=${bo}&fearless=${fearless ? 1 : 0}`)}>Lancer</button>
        </section>
      </div>
    </div>
  );
}
