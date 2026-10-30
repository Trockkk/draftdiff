# Draftdiff

Simulateur de draft LoL format tournoi pro, en ligne contre un ami, + prédiction du gagnant (stats pro + explication Claude).
Cahier des charges : PROMPT.md. Next.js 16 : lire AGENTS.md avant de toucher aux conventions Next.

## Carte du code
- `src/lib/draft/` : logique pure. `config.ts` (ordre + timers, seule source), `machine.ts` (états de draft), `series.ts` (Bo3/Bo5, Fearless), `roles.ts`, `ai.ts` (bot solo).
- `src/lib/predict/` : `model.ts` (features + prédiction), `explain.ts` (schéma de l'analyse + texte de secours).
- `src/lib/room-server.ts` : logique d'une partie en ligne (pure, testée). `party/room.ts` la branche sur PartyServer (Cloudflare Durable Objects, config `wrangler.jsonc`, types dans `party/tsconfig.json`).
- `src/app/api/analyze/route.ts` : prédiction + appel Claude (côté serveur).
- `scripts/build-data.ts` : CSV Oracle's Elixir → `data/pro.json`, `data/roles.json` + entraînement du modèle.

## Règles du projet
- TypeScript strict, Tailwind, npm uniquement. Textes de l'interface en français.
- Logique pure dans src/lib/, sans React, testée avec Vitest.
- Mode en ligne : le serveur de room est la seule source de vérité. Il valide chaque action et gère les timers ; le client n'envoie que des intentions.
- Clé API Anthropic : côté serveur seulement, jamais exposée au client, jamais commitée.
- Ne jamais inventer de stats : elles viennent de `npm run data:update`.
- Avant chaque commit : `npm run lint && npm run test && npm run build`.
