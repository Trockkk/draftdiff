"use client";
import Link from "next/link";
import usePartySocket from "partysocket/react";
import { useEffect, useRef, useState } from "react";
import ChampSelect from "@/components/ChampSelect";
import ResultView from "@/components/ResultView";
import SeriesBar from "@/components/SeriesBar";
import { analyze, resultUrl } from "@/lib/analyze";
import type { Side } from "@/lib/draft/config";
import { isOver } from "@/lib/draft/series";
import type { ClientMsg, RoomView, ServerMsg } from "@/lib/room";

const HOST = process.env.NEXT_PUBLIC_PARTY_HOST || "localhost:1999";

// Browser identity: reopening the invite link gives a dropped player their seat back.
function playerToken() {
  const key = "draftdiff:token";
  const make = () => crypto.randomUUID();
  try {
    let v = localStorage.getItem(key);
    if (!v) localStorage.setItem(key, (v = make()));
    return v;
  } catch {
    return make();
  }
}

export default function OnlineGame({ code }: { code: string }) {
  const [name, setName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from browser storage after hydration
      setName(localStorage.getItem("draftdiff:name") || "");
    } catch {
      setName("");
    }
  }, []);

  if (name === null) return null;
  if (!name)
    return (
      <form
        className="m-auto gold-frame bg-panel/70 p-6 flex flex-col gap-3 w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const n = draftName.trim();
          if (!n) return;
          try {
            localStorage.setItem("draftdiff:name", n);
          } catch {}
          setName(n);
        }}
      >
        <h1 className="font-display text-xl text-gold">Partie {code}</h1>
        <label htmlFor="pseudo" className="text-sm text-text">Choisis ton pseudo pour rejoindre</label>
        <input id="pseudo" autoFocus maxLength={20} className="bg-night border border-gold-dark px-2 py-2" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        <button className="btn-gold py-2" disabled={!draftName.trim()}>Rejoindre</button>
      </form>
    );
  return <Room code={code} name={name} />;
}

function Room({ code, name }: { code: string; name: string }) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [me, setMe] = useState<Side | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const analyzing = useRef(false);

  const socket = usePartySocket({
    host: HOST,
    room: code,
    onOpen() {
      setOnline(true);
      const token = playerToken();
      let create: string | null = null;
      try {
        create = sessionStorage.getItem(`draftdiff:create:${code}`);
        sessionStorage.removeItem(`draftdiff:create:${code}`);
      } catch {}
      send(create ? { t: "create", name, token, ...JSON.parse(create) } : { t: "join", name, token });
    },
    onClose: () => setOnline(false),
    onMessage(e) {
      const msg = JSON.parse(e.data) as ServerMsg;
      if (msg.t === "error") return setError(msg.msg);
      setError(null);
      setRoom(msg.room);
      setMe(msg.you.side);
      setOffset(msg.serverNow - Date.now());
    },
  });
  const send = (m: ClientMsg) => socket.send(JSON.stringify(m));

  // Draft over: one player (the host, or the other one if the host is gone) asks for the analysis and shares it.
  const d = room?.draft;
  const host = room?.host;
  const analyst = !!me && !!room && (me === host || !room.players[host!]?.connected);
  useEffect(() => {
    if (!room || room.phase !== "draft" || d?.phase !== "done" || !analyst || analyzing.current) return;
    analyzing.current = true;
    analyze(d.picks.blue, d.picks.red, { blue: room.players.blue?.name ?? "Blue", red: room.players.red?.name ?? "Red" })
      .then((result) => send({ t: "result", result }))
      .catch((e) => setError(e.message))
      .finally(() => (analyzing.current = false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, d?.phase, analyst]);

  const link = typeof window !== "undefined" ? `${location.origin}/r/${code}` : "";
  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!room || room.phase === "empty")
    return (
      <div className="m-auto text-center p-6 flex flex-col gap-4 items-center">
        {error ? (
          <>
            <p className="text-red-side">{error}</p>
            <Link href="/" className="btn-gold px-6 py-2">Retour à l&apos;accueil</Link>
          </>
        ) : (
          <p className="font-display text-gold animate-pulse" role="status">Connexion à la partie {code}...</p>
        )}
      </div>
    );

  const names: Record<Side, string> = { blue: room.players.blue?.name ?? "En attente...", red: room.players.red?.name ?? "En attente..." };
  const opp: Side | null = me ? (me === "blue" ? "red" : "blue") : null;
  const status = (
    <span className="flex items-center gap-3">
      <span className="flex items-center gap-1" title={online ? "Connecté" : "Reconnexion..."}>
        <span aria-hidden className={`size-2 rounded-full ${online ? "bg-green-500" : "bg-orange-400 animate-pulse"}`} />
        {online ? "En ligne" : "Reconnexion..."}
      </span>
      {opp && room.players[opp] && !room.players[opp]!.connected && <span className="text-red-side">Adversaire déconnecté</span>}
      {!me && <span className="text-gold">Mode spectateur</span>}
      {room.spectators > 0 && <span className="text-mute">{room.spectators} spectateur{room.spectators > 1 ? "s" : ""}</span>}
    </span>
  );
  const errorBar = error && <p className="text-center text-red-side text-sm" role="alert">{error}</p>;

  if (room.phase === "lobby") {
    const share = typeof navigator !== "undefined" && "share" in navigator;
    return (
      <div className="max-w-2xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        <section className="gold-frame bg-panel/70 p-5 text-center flex flex-col gap-3">
          <h1 className="text-sm text-text">Invite ton ami avec ce code</h1>
          <div className="font-display text-5xl sm:text-6xl tracking-[0.3em] text-gold select-all">{code}</div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-gold px-4 py-2 text-xs" onClick={() => copy(code, "code")}>{copied === "code" ? "Copié ✓" : "Copier le code"}</button>
            <button className="btn-gold px-4 py-2 text-xs" onClick={() => copy(link, "link")}>{copied === "link" ? "Copié ✓" : "Copier le lien"}</button>
            {share && (
              <button className="btn-gold px-4 py-2 text-xs" onClick={() => navigator.share({ title: "Draftdiff", text: `Viens drafter contre moi ! Code : ${code}`, url: link }).catch(() => {})}>
                Partager
              </button>
            )}
          </div>
          <p className="text-xs text-mute break-all">{link}</p>
        </section>

        <SeriesBar series={room.series} names={names} extra={status} />

        <section className="grid grid-cols-2 gap-3">
          {(["blue", "red"] as const).map((s) => {
            const p = room.players[s];
            return (
              <div key={s} className={`gold-frame bg-panel/70 p-4 border-t-4 ${s === "blue" ? "border-t-blue-side" : "border-t-red-side"}`}>
                <div className={`text-xs ${s === "blue" ? "text-blue-side" : "text-red-side"}`}>{s === "blue" ? "BLUE SIDE" : "RED SIDE"}{room.host === s && " · hôte"}</div>
                <div className="font-display text-lg">{p ? p.name : <span className="text-mute">En attente...</span>}{me === s && " (toi)"}</div>
                <div className="text-sm">{p && (p.ready ? <span className="text-green-400">Prêt ✓</span> : <span className="text-mute">Pas prêt</span>)}</div>
              </div>
            );
          })}
        </section>

        {me && (
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-gold px-8 py-3" disabled={room.players[me]?.ready} onClick={() => send({ t: "ready" })}>
              {room.players[me]?.ready ? "En attente de l'adversaire" : "Prêt"}
            </button>
            {me === room.host && (
              <button className="btn-gold px-4 py-3 text-xs" onClick={() => send({ t: "swapSides" })}>Échanger les sides</button>
            )}
          </div>
        )}
        {errorBar}
      </div>
    );
  }

  if (room.phase === "countdown")
    return <Countdown startAt={room.startAt} offset={offset} />;

  if (room.phase === "result" || d?.phase === "done") {
    const last = room.series.games.at(-1);
    return (
      <>
        <div className="pt-3"><SeriesBar series={room.series} names={names} extra={status} done={!!room.result} /></div>
        {errorBar}
        <ResultView
          blue={d!.picks.blue}
          red={d!.picks.red}
          names={names}
          result={room.result}
          actions={
            room.result && (
              <>
                {last && room.series.format > 1 && (
                  <p className="w-full text-center font-display text-gold">Résultat simulé de la game : victoire {names[last.winner]}</p>
                )}
                {me && (
                  <button className="btn-gold px-6 py-2" onClick={() => send({ t: "next" })}>
                    {isOver(room.series) ? "Nouvelle série" : "Game suivante"}
                  </button>
                )}
                <button className="btn-gold px-6 py-2" onClick={() => copy(location.origin + resultUrl(d!.picks.blue, d!.picks.red, names), "result")}>
                  {copied === "result" ? "Lien copié ✓" : "Copier le lien du résultat"}
                </button>
              </>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <ChampSelect
        draft={d!}
        clockOffset={offset}
        controls={me ? [me] : []}
        names={names}
        top={<><SeriesBar series={room.series} names={names} extra={status} />{errorBar}</>}
        onHover={(_, champ) => send({ t: "hover", champ })}
        onLock={(_, champ) => send({ t: "lock", champ })}
        onSwap={(_, i, j) => send({ t: "swap", i, j })}
        onSwapReady={() => send({ t: "swapReady" })}
      />
    </>
  );
}

function Countdown({ startAt, offset }: { startAt: number; offset: number }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 100);
    return () => clearInterval(t);
  }, [offset]);
  return (
    <div className="m-auto text-center">
      <p className="text-text">La draft commence dans</p>
      <p className="font-display text-8xl text-gold" aria-live="polite">{Math.max(1, Math.ceil((startAt - now) / 1000))}</p>
    </div>
  );
}
