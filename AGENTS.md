# Consignes locales — projet de maps WorkAdventure

## Sources de référence

- Ce projet centralise les sources éditables des maps : fichiers `.tmj` à la
  racine, scripts dans `src/`, images dans `tilesets/`, ressources statiques dans
  `public/`.
- Modifier les sources, puis construire avec `npm run build`. `dist/` contient les
  fichiers générés à publier ; ne pas y effectuer les modifications de référence.
- Préserver les modifications locales et les autres maps lors d'une intervention.
- La centralisation de la salle des reviews a été faite le 6 novembre 2026, sans
  nouvelle publication en production.

## Salle des reviews Airmes

- Lire [REVIEWS.md](REVIEWS.md) avant de modifier cette intégration.
- `office-technique.tmj` contient les 15 postes raccordés dans les sources : repères
  `review-screen-01` à `review-screen-15` (surfaces) et `review-zone-01` à
  `review-zone-15` (approche plus bas), en 3 rangées de 5 dans `floorLayer`.
  Préserver leur correspondance et les ancres `review-popup-01` à `15`.
  `src/office-technique.ts` conserve le script commun `main.ts` et charge `reviews.js`.
  Le script lit les coordonnées Tiled et superpose les couleurs via
  `public/review-screen.html`, sans remplacer les tuiles des ordinateurs.
- Sources de référence : `reviews.tmj`, `src/reviews.js` et
  `tilesets/reviews-tiles.png` dans ce projet.
- Les outils GitLab/n8n et tests sont dans `integrations/airmes-reviews/`.
  Ils sont autonomes et ne doivent pas importer d'outils du dépôt WorkAdventure.
  Le générateur initial et le script dupliqué du prototype ont été retirés : modifier
  directement la map et `src/reviews.js`, sans régénérer la disposition Tiled.
- Exécuter `npm run test:reviews` après une modification de l'intégration. Le test
  de map utilise le vrai fichier `src/reviews.js`, sans copie de script de test.
- Conserver les calques `floorLayer` et `reviews`, les propriétés de map `script`
  et `reviewsEndpoint`, et les noms des objets `review-*` et `review-popup-*`.
- Préserver les noms de tuiles `airmes-review-current`, `airmes-review-pending`
  et `airmes-review-stale`. Le script utilise ces noms car l'optimiseur renumérote
  les tuiles et doit conserver celles qui sont utilisées dynamiquement.
- Dans le bureau technique, déplacer les repères d'écran, leurs zones d'approche
  et les ancres des fiches dans Tiled : aucune coordonnée à modifier dans le script.
  Seule l'ancienne salle `reviews.tmj` conserve une grille fixe de 48 postes.
- Les deux labels exacts `Test OK` et `Review OK`, avec un déploiement à jour,
  déclenchent le vert. Bleu = à tester/valider, orange = commits à redéployer,
  noir = libre, gris = données périmées. Une pipeline réussie ne suffit pas au vert.
- L'évolution du snapshot n8n (`snapshot.cjs` et `workflow.json`) transmet seulement
  ces deux labels et attribue 15 emplacements partagés. Le script utilise ces slots
  serveur pour garder les mêmes affectations chez tous les joueurs.
  Le build local ne met pas le workflow actif à jour : préserver ses identifiants,
  webhook, credentials et données statiques lors d'une publication ultérieure.
- Le workflow n8n « WorkAdventure — Reviews Airmes » fournit les données GitLab.
  Une modification de décoration ou de disposition ne nécessite pas de le modifier.
- `integrations/airmes-reviews/workflow.json` est un exemple importable inactif sans
  credentials. Son chemin de webhook est un exemple, pas le flux publié. Les états
  et sauvegardes de l'installation existante restent hors Git sous
  `~/.local/state/workadventure/mr-map/`. La publication de map passe par le build
  du projet ; l'outil n8n ne doit pas écraser les fichiers `.wam` ou Tiled.
- Le flux du prototype est publiquement lisible et contient des métadonnées de MR.
  Ne pas y ajouter de secrets ou de données métier confidentielles.

## Validation et publication

- Après une modification de map ou de script, exécuter `npm run build` et vérifier
  que la map concernée, ses images et son script sont présents dans `dist/`.
- Pour les reviews, vérifier aussi que les trois noms de tuiles dynamiques sont
  conservés dans la map optimisée et que les références aux ressources se résolvent.
- En production, la salle est
  `https://workadventure.eoloa.net/~/mon-bureau/reviews.wam`.
  Depuis une autre map de ce dossier, la destination relative est `reviews.wam`.
- Avant publication, vérifier la configuration effective de destination : les maps
  concernées sont dans `mon-bureau`. Une construction locale ne publie rien.
- Préserver les fichiers `.wam` de production : ils peuvent contenir des zones,
  meubles et droits modifiés dans l'éditeur en jeu. Sauvegarder avant de remplacer
  des fichiers publiés et éviter tout remplacement global non nécessaire.
- Les accès locaux sont dans `~/.config/*.env` et, selon la configuration du
  projet, `.env.secret`. Ne jamais afficher, journaliser, copier dans les sources
  ou committer les secrets.
