# Prompt à coller dans Claude Code

> Ouvre ce dossier dans VS Code, lance Claude Code, et colle **tout le bloc ci-dessous**.
> Conseil : commence en mode plan (`Shift+Tab` deux fois) pour valider le plan avant qu'il code.

---

```text
Tu construis "Draftdiff", un simulateur web de draft League of Legends en format tournoi pro,
jouable en ligne contre un ami (invitation par code ou lien), avec un verdict IA à la fin.
Lis CLAUDE.md avant de commencer. Le dossier est vide à part les fichiers de doc et de config.

## 1. Stack (ne change pas sans me demander)
- Next.js (App Router) + TypeScript strict + Tailwind CSS. npm. Déployé sur Vercel (gratuit).
- Multijoueur temps réel : PartyKit / PartyServer (Cloudflare Durable Objects), dans un
  dossier party/ du même repo. Une "room" = une draft. Le serveur de room est la seule source
  de vérité : il tient l'état de la draft, valide chaque action et fait tourner les timers.
  Vérifie la doc actuelle de PartyServer avant de coder. Si ce n'est pas viable (offre
  gratuite, limites), propose-moi une alternative (Supabase Realtime, Socket.IO sur Render)
  avant de changer.
- La clé API Anthropic reste côté serveur (route API Next.js), jamais dans le navigateur.
- Tests : Vitest pour la logique (ordre de draft, timers, prédiction, serveur de room).
- Pas de base de données : stats pro pré-calculées dans des JSON versionnés dans /data.

## 2. Modes de jeu (écran d'accueil)
1. **Jouer contre un ami (en ligne)** — le mode principal :
   - "Créer une partie" → choix : Blue ou Red side (ou aléatoire), format (Bo1/Bo3/Bo5),
     Normal ou Fearless draft, pseudo. Crée une room et affiche :
     - un code court lisible à 6 caractères (sans 0/O/1/I), gros et copiable,
     - un lien d'invitation https://<site>/r/<CODE> avec bouton "Copier le lien"
       (et partage natif navigator.share sur mobile).
   - "Rejoindre une partie" → champ pour taper le code, ou ouverture directe du lien.
   - Salle d'attente : les deux joueurs, leur side, bouton "Prêt". La draft démarre quand les
     deux sont prêts (compte à rebours 3-2-1). Option : l'hôte peut échanger les sides avant
     le départ.
   - Pendant la draft, chaque joueur ne peut agir que pendant son tour et sur son side. Il
     voit le champion que l'adversaire survole (hover) en temps réel, comme dans le client,
     mais il n'est verrouillé qu'au "LOCK IN".
   - Spectateurs : un 3e+ visiteur du lien entre en lecture seule (utile pour stream).
   - Déconnexion : le joueur peut revenir via le lien (identité gardée dans localStorage avec
     un token de joueur émis par le serveur). Le timer continue pendant la déconnexion ; à
     expiration, règle normale (no ban / pick aléatoire). Affiche "Adversaire déconnecté".
   - Fin de série en Bo3/Bo5 : après chaque game, bouton "Game suivante" ; en Fearless, les
     champions déjà joués sont bloqués selon la règle. Score de série affiché en haut.
   - Room supprimée après 2 h d'inactivité.
2. **Solo vs IA** : l'IA drafte l'autre side avec les stats pro (priorité aux champions à forte
   présence, contre-picks de matchup, cohérence de comp). Tourne en local, sans serveur.
3. **Bac à sable** : une seule personne contrôle les deux sides (pour s'entraîner/théorycraft).

Les 3 modes utilisent exactement la même machine à états de draft (src/lib/draft/).

## 3. UI : ambiance de la sélection de champions du client LoL
- Haut : bans de chaque équipe (5 cases à gauche Blue, 5 à droite Red), au centre le texte de
  phase ("BLUE SIDE BANNIT", "RED SIDE PICK"...) et un gros timer avec une barre qui se vide
  (rouge sous 10 s). En ligne, affiche "À toi !" ou "L'adversaire choisit..." clairement.
- Gauche : 5 slots Blue (TOP, JUNGLE, MID, BOT, SUPPORT), portraits ronds, pseudo du joueur,
  slot actif surligné en doré et qui pulse. Droite : idem en miroir pour Red, accents rouges.
- Centre : grille de champions avec recherche, filtre par rôle, champions pickés/bannis/bloqués
  (Fearless) grisés et non cliquables. Bouton "LOCK IN" / "BAN" doré.
- Survol d'un champion → stats pro (pick rate, ban rate, winrate, presence).
- Fond bleu nuit, liserés dorés, titres en capitales serif. Desktop prioritaire, utilisable
  sur mobile (colonnes empilées).
- Images : Riot Data Dragon (version via /api/versions.json). Aucun asset copié du client.
- Indicateur de connexion (point vert/orange/rouge) en mode en ligne.

## 4. Règles de draft = vrai format tournoi
- Ordre exact (20 actions) :
  Ban phase 1 : B1 R1 B2 R2 B3 R3
  Pick phase 1 : B1, R1 R2, B2 B3, R3
  Ban phase 2 : R4 B4 R5 B5
  Pick phase 2 : R4, B4 B5, R5
- Timer : 30 s par action, comme en tournoi pro. Expiration : ban → "no ban", pick → champion
  aléatoire valide.
- Phase finale d'assignation des rôles : 30 s pour réordonner ses champions (drag & drop),
  puis analyse.
- Toutes les durées et l'ordre dans un seul fichier : src/lib/draft/config.ts.
- Fearless : vérifie la règle officielle actuelle avant de coder et documente-la dans le code.
- La machine à états est pure (pas de React, pas de réseau), testée, et c'est elle que le
  serveur de room exécute. Le client n'envoie que des intentions ({type:"hover"|"lock",
  champion}) ; le serveur valide (bon joueur, bon tour, champion disponible) et diffuse le
  nouvel état. Les timers sont calculés côté serveur (deadline absolue diffusée aux clients,
  qui l'affichent), pour que personne ne puisse tricher en modifiant son navigateur.

## 5. Données pro
Sources, par ordre de préférence — vérifie qu'elles sont accessibles avant de coder :
- Oracle's Elixir (CSV annuels de toutes les games pro) : https://oracleselixir.com/tools/downloads
- Leaguepedia Cargo API (lol.fandom.com) en secours : ScoreboardGames, PicksAndBansS7,
  ScoreboardPlayers. Respecte le rate limit, User-Agent explicite.
Toutes les ligues dispo (Worlds, MSI, First Stand, LCK, LPL, LEC, LTA/LCS, LCP, CBLOL...).
Ne hardcode pas la liste : lis-la depuis les données.

Script `npm run data:update` (scripts/build-data.ts) :
1. télécharge les données brutes dans data/raw/ (gitignoré),
2. écrit des JSON compacts dans data/ (commités) :
   - champions.json : par champion et rôle → games, picks, bans, presence, winrate (lissé
     bayésien pour les petits échantillons), winrate blue/red.
   - matchups.json : par rôle, A vs B en lane → games, winrate de A, diff gold/xp/cs à 15 min.
   - synergies.json : paires de la même équipe → games, winrate.
   - meta.json : patchs, ligues, date de génération, nombre de games.
3. filtre sur les N derniers patchs (configurable), pondère plus les internationaux et les
   patchs récents.
L'UI affiche "Données : X games pro, patchs A→B, mis à jour le JJ/MM".

## 6. Prédiction du gagnant
A) Modèle statistique déterministe (src/lib/predict/), testé :
   - Score par équipe = somme pondérée de : winrate pro de chaque champion sur son rôle,
     matchups par lane (bot+sup en 2v2, jungle vs jungle), synergies, avantage de side,
     profil de comp (engage, peel, poke, early/late, AP/AD, frontline) via des tags définis
     à la main dans data/champion-tags.json.
   - Sortie : % de victoire Blue (logistique) + facteurs chiffrés
     (ex. "Mid : Azir vs Syndra +3.1 %").
   - Matchup jamais joué en pro → neutre + signalé "peu de données".
   - Calibrer les poids par régression logistique sur l'historique, avec un holdout, et
     écrire la précision réelle (accuracy, log loss) dans meta.json.
B) Analyse IA (Claude API, route POST /api/analyze) :
   - Reçoit la draft finale + les facteurs du modèle A + les stats utiles.
   - Claude NE recalcule PAS le % : il explique en français, clairement : 3-5 raisons
     principales, win conditions de chaque équipe, phase de jeu favorable, lane clé, ce qui
     pourrait renverser la game.
   - Réponse JSON structurée et validée, affichée dans un écran de résultat : grosse barre
     Blue% vs Red%, raisons en cartes, détail par lane.
   - En ligne : l'analyse est demandée UNE fois par le serveur de room (ou par l'hôte) et le
     résultat est diffusé aux deux joueurs et aux spectateurs, pour qu'ils voient le même.
   - Modèle : claude-sonnet-5-5 par défaut, configurable via env. Streaming si simple.
   - Sans ANTHROPIC_API_KEY : le modèle A seul + explications générées depuis les facteurs.
   - Rate limit par IP sur la route.

## 7. Partage et finition
- Fin de draft : bouton "Copier le lien du résultat" (draft encodée dans l'URL, sans DB).
- Page "À propos" : sources, méthode, limites (la draft ne fait pas tout, échantillon pro petit).
- Footer obligatoire : "Draftdiff isn't endorsed by Riot Games and doesn't reflect the views
  or opinions of Riot Games or anyone officially involved in producing or managing Riot Games
  properties. Riot Games, and all associated properties are trademarks or registered
  trademarks of Riot Games, Inc."
- Sons de lock-in/ban optionnels, désactivables, libres de droits.

## 8. Méthode de travail
- Plan court en étapes livrables, puis dans cet ordre :
  (1) scaffold + UI statique du champ select,
  (2) machine à états de draft + timers + tests, jouable en mode Bac à sable,
  (3) serveur de room PartyServer + création/rejoindre par code et lien + salle d'attente +
      hover temps réel + reconnexion + spectateurs. Teste-le avec deux onglets.
  (4) pipeline de données + JSON,
  (5) modèle de prédiction + tests,
  (6) route Claude + écran de résultat partagé,
  (7) Solo vs IA, Fearless/Bo3/Bo5, polish.
- Après chaque étape : `npm run lint`, `npm run test`, `npm run build` passent, montre-moi le
  résultat dans le navigateur, puis commit git clair.
- Mets à jour README.md (install, scripts, variables d'env, déploiement Vercel + PartyKit)
  dès que tu ajoutes un script, une variable ou un service. Ne commite jamais .env.local.
- Si une source de données ou un service est inaccessible ou a changé, arrête-toi et dis-le-moi
  au lieu d'inventer. Aucune donnée fictive présentée comme réelle.
```
