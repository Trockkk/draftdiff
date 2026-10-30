# Draftdiff

Simulateur de draft League of Legends au format tournoi pro, jouable en ligne contre un ami via un code ou un lien. À la fin, une prédiction du gagnant en % avec une explication claire, basée sur les stats des compétitions pro (Worlds, MSI, LCK, LPL, LEC, LTA, et toutes les ligues dispo).

- Ordre de draft officiel (20 actions), 30 s par action, phase d'échange des rôles.
- Modes : **contre un ami en ligne** (code à 6 caractères ou lien, spectateurs, reconnexion), **solo contre l'IA**, **bac à sable**.
- Bo1 / Bo3 / Bo5, **Fearless draft** (règle Riot : un champion joué est interdit aux deux équipes pour le reste de la série).
- Verdict : modèle statistique entraîné sur les games pro (forme des champions par rôle, matchups, synergies, profil de comp, side), expliqué en français par Claude.

## Lancer en local

Prérequis : [Node.js](https://nodejs.org) 20+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Mets ta clé Anthropic dans `.env.local` (optionnel : sans clé, l'explication est générée à partir des chiffres seulement).

Deux terminaux : le site, et le serveur des parties en ligne.

```bash
npm run dev
```

```bash
npm run party:dev
```

Puis ouvre http://localhost:3000. Pour tester une partie en ligne seul, ouvre le lien d'invitation dans un **autre navigateur** (ou une fenêtre privée) : deux onglets du même navigateur comptent comme le même joueur.

## Données pro

```bash
npm run data:update
```

Le script télécharge les CSV d'[Oracle's Elixir](https://oracleselixir.com/tools/downloads) (année en cours et précédente), garde les 10 derniers patchs, calcule les stats et entraîne le modèle, puis écrit `data/pro.json` et `data/roles.json` (à commiter).

Google Drive limite parfois les téléchargements (« quota dépassé »). Dans ce cas, réessaie quelques heures plus tard, ou télécharge les fichiers à la main depuis [le dossier Drive d'Oracle's Elixir](https://drive.google.com/drive/folders/1gLSw0RLjBbtaNy0dgnGQDAZOHIgCe-HH), enregistre-les sous `data/raw/2026.csv` et `data/raw/2025.csv`, puis relance la commande.

Variable optionnelle : `PATCH_WINDOW=6 npm run data:update` pour changer le nombre de patchs gardés.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Site en local (port 3000) |
| `npm run party:dev` | Serveur des parties en ligne en local (port 1999) |
| `npm run data:update` | Met à jour les stats pro et le modèle |
| `npm run test` | Tests (draft, séries, serveur de room, parsing des données) |
| `npm run lint` / `npm run build` | Vérifications avant commit |
| `npm run party:deploy` | Déploie le serveur des parties sur PartyKit |

## Mettre le projet sur GitHub

1. Crée un dépôt vide sur https://github.com/new (nom : `draftdiff`, sans README ni .gitignore).
2. Dans ce dossier :

```bash
git remote add origin https://github.com/TON-PSEUDO/draftdiff.git
```

```bash
git push -u origin main
```

## Mettre le site en ligne

Le site a deux morceaux : le site Next.js (Vercel) et le serveur des parties en ligne (PartyKit, Cloudflare).

**1. Serveur des parties (PartyKit, gratuit)**

```bash
npx partykit login
```

```bash
npm run party:deploy
```

La commande affiche l'adresse du serveur, du type `draftdiff.TON-PSEUDO.partykit.dev`.

**2. Site (Vercel, gratuit)**

1. Va sur https://vercel.com, connecte-toi avec GitHub, « Add New Project », choisis `draftdiff`.
2. Dans *Settings → Environment Variables*, ajoute :
   - `NEXT_PUBLIC_PARTY_HOST` = l'adresse PartyKit de l'étape 1 (sans `https://`)
   - `ANTHROPIC_API_KEY` = ta clé API Anthropic (optionnel)
3. Deploy. Chaque `git push` sur `main` redéploie le site. Si tu modifies `party/` ou `src/lib/room-server.ts`, relance aussi `npm run party:deploy`.

GitHub Pages ne convient pas : il ne sert que des fichiers statiques, et la clé API doit rester sur un serveur.

## Données et crédits

Stats pro : [Oracle's Elixir](https://oracleselixir.com). Images : Riot Data Dragon. Analyse : Claude (Anthropic).

---

Draftdiff isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
