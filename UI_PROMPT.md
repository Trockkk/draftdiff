# Prompt : refonte de l'interface du champ select

> Colle le bloc ci-dessous dans Claude Code (dans ce dossier). Mets ta capture du client LoL dans le message en même temps : c'est la référence visuelle.

---

```text
Refais l'interface de la draft de Draftdiff pour qu'elle ressemble au champ select du client
League of Legends (capture jointe), avec des animations propres. Lis CLAUDE.md avant.

## Ce qu'on garde (ne touche pas)
- Toute la logique : src/lib/** (machine de draft, séries, room server, prédiction), party/**,
  l'API /api/analyze. Les props de ChampSelect peuvent changer, pas le comportement.
- Les 3 modes (en ligne, solo IA, bac à sable) doivent continuer de marcher à l'identique.
- Les 12 tests existants passent toujours.

## Ce qui ne va pas aujourd'hui
- Barres de scroll natives moches (grille de champions, page entière). La page de draft ne doit
  JAMAIS avoir de scroll de page sur desktop.
- La grille de champions est coincée dans un petit cadre ; on ne retrouve pas l'ambiance du client.
- Aucune animation : les picks, bans, changements de phase apparaissent d'un coup.

## Mise en page cible (desktop, de 1280×720 à 2560×1440)
Une "scène" plein écran (100dvh, overflow hidden), comme le client :
- Haut : à gauche les 5 bans Blue, à droite les 5 bans Red (petites cases carrées avec liseré).
  Au centre, le texte de phase en italique serif ("Blue side bannit", "À toi de choisir !")
  et le gros timer, avec en dessous une barre fine qui se vide de chaque côté vers le centre
  (dorée, rouge sous 10 s).
- Colonne gauche (≈ 22 % de large) : 5 slots Blue. Colonne droite : 5 slots Red en miroir.
  Chaque slot : grand cercle avec liseré doré pour le portrait, rôle en capitales
  (TOP, JUNGLE...), pseudo en dessous. Le slot qui joue a une barre verticale colorée sur le
  bord extérieur et le texte "Choisit..." en doré, comme sur la capture.
  Quand un champion est verrouillé, son splash art (Data Dragon, image "loading" :
  https://ddragon.leagueoflegends.com/cdn/img/champion/loading/{id}_0.jpg) apparaît en fond
  du slot, en fondu, cadré sur le visage, avec un dégradé vers le fond.
- Centre : la carte de la Faille de l'invocateur en fond (Data Dragon :
  https://ddragon.leagueoflegends.com/cdn/{version}/img/map/map11.png), assombrie et floutée,
  avec un halo bleu. Par-dessus, le panneau de sélection :
  - barre de recherche + 5 icônes de rôle (pas des boutons texte), alignées sur une ligne ;
  - grille de champions carrés (bordure fine, hover = liseré doré + léger zoom), qui remplit
    la hauteur disponible. Scroll uniquement dans cette grille, avec une scrollbar fine et
    discrète aux couleurs du thème (scrollbar-width: thin + ::-webkit-scrollbar stylé), ou un
    masque en dégradé haut/bas. Jamais la scrollbar grise par défaut.
  - champions indisponibles : grisés + une croix fine, pas juste transparents.
  - en bas, centré : bouton "LOCK IN" / "BANNIR" style client (hexagone/biseauté, doré,
    pulse léger quand il est actif).
- Bas : infos discrètes (série Bo3 + score, statut de connexion, spectateurs), sur une ligne.

## Animations (soignées, jamais lentes)
Utilise la librairie `motion` (Framer Motion) si c'est plus propre qu'en CSS pur ; sinon CSS.
- Survol adverse (hover en direct) : le portrait apparaît en transparence dans le slot qui joue.
- Lock in : flash lumineux sur le slot, le portrait passe de transparent à plein en ~300 ms,
  le splash art glisse légèrement en fondu.
- Ban : le champion se grise et une barre rouge le barre en diagonale (animation de trait).
- Changement de tour : la barre verticale du slot actif glisse vers le slot suivant ;
  le texte de phase fait un fondu enchaîné.
- Timer : la barre se vide en continu (pas par saccades d'1 s), passe au rouge sous 10 s,
  le chiffre pulse sur les 5 dernières secondes.
- Échange des rôles : les champions échangés glissent l'un vers l'autre (layout animation).
- Fin de draft → écran de résultat : transition en fondu, la barre de % se remplit depuis
  50/50 jusqu'à la vraie valeur, les cartes de raisons apparaissent en cascade.
- Lobby en ligne : le code d'invitation apparaît lettre par lettre ; l'arrivée de l'ami fait
  entrer sa carte avec un petit rebond.
- Respecte prefers-reduced-motion : animations réduites à des fondus courts.
- 60 fps : n'anime que transform et opacity, pas width/height/top.

## Mobile (390 px)
Pas de scène fixe : bans en haut sur 2 lignes, les deux équipes côte à côte en compact
(portraits plus petits, pas de splash), grille de champions dessous, bouton LOCK IN collant
en bas de l'écran. Aucun scroll horizontal.

## Assets et règles
- Seulement des images Data Dragon (portraits, loading art, map11). Pas de fichiers copiés du
  client LoL. Garde le footer de non-affiliation Riot.
- Les icônes de rôle : fais-les en SVG simple toi-même (pas d'assets Riot).
- Polices actuelles (Cinzel pour les titres, Inter pour le texte) et couleurs de globals.css.
- Accessibilité : focus visibles, boutons avec aria-label, le timer et le texte de phase en
  aria-live, contraste lisible.

## Méthode
1. Commence par montrer un plan court des composants à créer ou modifier.
2. Implémente, puis vérifie toi-même dans le navigateur (npm run dev + npm run party:dev) :
   captures à 1920×1080, 1366×768 et 390×844, en mode Bac à sable ET dans une partie en ligne.
   Vérifie : aucun scroll de page sur desktop, aucune scrollbar native visible, animations
   fluides, rien ne déborde.
3. `npm run lint`, `npm run test`, `npm run build` passent, puis commit clair.
```
