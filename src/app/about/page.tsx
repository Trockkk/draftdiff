import { PRO } from "@/lib/data";

export default function About() {
  const m = PRO.meta;
  return (
    <article className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4 text-text leading-relaxed">
      <h1 className="font-display text-3xl text-gold">À propos</h1>

      <h2 className="font-display text-xl text-gold-light">Format de draft</h2>
      <p>
        Ordre officiel des tournois pro : 3 bans par équipe, 6 picks (B1, R1 R2, B2 B3, R3), 2 bans par équipe, 4 picks
        (R4, B4 B5, R5). 30 secondes par action. Si le timer expire, le champion survolé est validé ; sinon pas de ban, ou
        un champion aléatoire pour un pick. En Fearless (règle Riot actuelle), tout champion joué dans une game précédente
        de la série est interdit aux deux équipes ; les bans repartent à zéro à chaque game.
      </p>

      <h2 className="font-display text-xl text-gold-light">Données</h2>
      <p>
        Matchs pro d&apos;
        <a className="underline" href="https://oracleselixir.com">Oracle&apos;s Elixir</a> (toutes les ligues disponibles :
        Worlds, MSI, LCK, LPL, LEC, LTA, LCP, CBLOL, ligues régionales...). Actuellement : {m.games} games
        {m.patches.length > 0 && ` sur les patchs ${m.patches.at(-1)} à ${m.patches[0]}`}, {m.leagues.length} ligues. Les
        compétitions internationales et les patchs récents comptent davantage. Images : Riot Data Dragon.
      </p>

      <h2 className="font-display text-xl text-gold-light">Calcul du gagnant</h2>
      <p>
        Un modèle statistique (régression logistique) combine : la forme pro de chaque champion sur son rôle, les matchups
        de lane, les synergies entre champions, le profil de composition (équilibre AP/AD, frontline) et l&apos;avantage du
        side bleu. Les petits échantillons sont ramenés vers 50 % pour éviter les conclusions sur 2 games. Ensuite, Claude
        (IA d&apos;Anthropic) explique ce résultat en langage clair, sans le modifier.
      </p>
      {m.eval ? (
        <p>
          Précision mesurée honnêtement sur les {m.eval.holdoutGames} games les plus récentes (jamais vues à
          l&apos;entraînement) : {(m.eval.accuracy * 100).toFixed(1)} % de bons pronostics.
        </p>
      ) : (
        <p>Pas encore assez de games chargées pour mesurer la précision du modèle.</p>
      )}

      <h2 className="font-display text-xl text-gold-light">Limites</h2>
      <p>
        La draft ne gagne pas la game : le niveau des joueurs, la forme de l&apos;équipe et l&apos;exécution pèsent bien plus.
        Une draft seule prédit rarement mieux que 55-60 % des résultats pro. Prends le pourcentage comme « quelle draft est
        la plus confortable », pas comme une certitude.
      </p>
    </article>
  );
}
