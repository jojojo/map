# Salle des reviews Airmes

La map et son script sont centralisés dans ce projet depuis le 6 novembre 2026.

| Fichier | Rôle |
| --- | --- |
| `reviews.tmj` | Map à ouvrir et modifier dans Tiled |
| `office-technique.tmj` | Bureau technique avec 15 écrans raccordés dans les sources |
| `src/office-technique.ts` | Charge le script commun et le raccordement des reviews |
| `tilesets/reviews-tiles.png` | Sol, bordure et ordinateurs du prototype |
| `src/reviews.js` | Affichage des ordinateurs et interactions avec les reviews |
| `public/review-screen.html` | Surfaces de couleur placées sur les écrans du bureau |
| `integrations/airmes-reviews/` | Outils GitLab/n8n, export de workflow et tests |

La salle publiée est accessible à
<https://workadventure.eoloa.net/~/mon-bureau/reviews.wam>.
Le workflow n8n « WorkAdventure — Reviews Airmes » fournit l'état GitLab ; il reste
indépendant du projet de maps et n'a pas été modifié pendant cette centralisation.

## Modifier dans Tiled

### Bureau technique : `office-technique.tmj`

Les 15 écrans dessinés sont repérés dans `floorLayer` par
`review-screen-01` à `review-screen-15`, numérotés de gauche à droite, puis de haut
en bas (3 rangées de 5). Les surfaces font 32 × 16 pixels, espacées de 96 pixels.
Les zones `review-zone-01` à `review-zone-15` font 64 × 32 pixels, centrées devant
les écrans et placées 26 pixels sous le bas de leur surface. Elles sont de type
`area` avec `dynamic = true`.

Le script lit directement ces rectangles et superpose une surface colorée de
même taille et position. Le dessin des ordinateurs, leurs cadres et les autres
tuiles restent inchangés. Déplacer un poste consiste à déplacer dans Tiled sa
surface, sa zone d'approche et son ancre de fiche `review-popup-XX` ; le script
n'utilise aucune grille fixe pour ce bureau. Les fonctions communes du bureau
(portes, etc.) restent chargées via `src/office-technique.ts`.

| Couleur | Signification |
| --- | --- |
| Noir | Poste libre |
| Bleu | Déploiement à jour, validation à terminer |
| Vert | Déploiement à jour et les deux labels `Test OK` **et** `Review OK` |
| Orange | Des commits plus récents restent à déployer, même si les labels sont présents |
| Gris | Aucune donnée récente : ouverture suspendue |

À l'approche, une fiche propose Airmes dans un nouvel onglet et le lien GitLab.
Les états sont lus toutes les 30 secondes ; après trois minutes sans scan récent,
les écrans deviennent gris. Le bandeau donne accès à toutes les MR et compte les
reviews supplémentaires si les 15 emplacements sont occupés.

Le snapshot n8n préparé attribue les 15 postes de manière partagée, conserve les
affectations jusqu'à disparition d'une review et remplit les postes libres en
privilégiant les reviews à valider. La map utilise les slots du serveur pour que
tous les joueurs voient les mêmes affectations.

Propriétés Tiled du bureau : `reviewsEndpoint` (flux existant),
`reviewsScreenUrl` (`review-screen.html`), `reviewsTestLabel` (`Test OK`) et
`reviewsReviewLabel` (`Review OK`). Le producteur du flux ne transmet que ces deux
labels de validation.

### Salle de prototype `reviews.tmj`

Ouvrir `reviews.tmj` à la racine. Les sols, murs et décorations peuvent être modifiés.
Conserver le calque objet `floorLayer`, le calque de tuiles `reviews`, les propriétés
de map `script` et `reviewsEndpoint`, ainsi que les noms des objets `review-*` et
`review-popup-*`.

Les ordinateurs utilisent les noms de tuiles `airmes-review-current`,
`airmes-review-pending` et `airmes-review-stale`. Conserver ces propriétés `name`
sur les trois tuiles : elles permettent à l'optimiseur de les garder et au script
de les retrouver même lorsque leurs numéros changent pendant la construction.

Les postes restent disposés selon une grille de 48 emplacements définie dans
`src/reviews.js` (`x: 4 + (slot % 8) * 6`, `y: 8 + Math.floor(slot / 8) * 6`).
Pour déplacer un poste, adapter aussi ces coordonnées et les objets de sa zone
d'approche et de sa fiche dans Tiled. Le script fait apparaître les ordinateurs
sur le calque `reviews` pendant le jeu ; ce calque est donc vide dans Tiled.

Depuis les autres maps du même dossier, une zone de sortie peut utiliser
`exitUrl = reviews.wam`. Le retour de cette salle pointe vers
`hall.tmj#from-office-technique`.

## Construire et publier

```sh
npm run build
npm run test:reviews
```

Vite détecte automatiquement la nouvelle map et son script. Les fichiers à publier
sont ceux de `dist/`, où le script et les images sont renommés par l'optimiseur.
Les sources Tiled restent à la racine et dans `src/` / `tilesets/`.

La centralisation n'a pas publié de nouvelle version. Avant un prochain upload,
vérifier que la configuration du projet cible bien le dossier `mon-bureau`.
Conserver les fichiers `.wam` de production : ils peuvent contenir des modifications
effectuées dans l'éditeur en jeu. Aucun `.wam` n'est ajouté aux sources ici.

Le raccordement du 6 novembre est lui aussi local : pour activer toutes ses fonctions,
il faut publier le build **et** mettre à jour le Code node « Mémoriser les postes »
du workflow n8n existant avec celui de l'export préparé. Conserver les IDs des nodes,
le webhook de production, les credentials et les données statiques. Ne pas remplacer
le workflow actif par l'exemple complet, qui a un autre chemin de webhook.
Sans cette mise à jour n8n, le flux historique n'envoie pas les labels : aucun écran
ne peut devenir vert et les anciennes affectations au-delà du quinzième poste sont
comptées comme reviews supplémentaires. Aucune modification de production n'a été
effectuée pour ce build.

Les outils du prototype ont aussi été transférés dans
[`integrations/airmes-reviews/`](integrations/airmes-reviews/README.md), sans dépendance
au dépôt WorkAdventure. Le générateur de disposition initial et la copie de script
ont été retirés : ce projet est la référence unique pour la map et son script.
L'outil n8n ne publie plus de map ; il réutilise les références d'installation
existantes hors Git et peut produire un export inactif sans credentials.

Le flux n8n du prototype est publiquement lisible et contient des métadonnées de MR,
sans jeton ni donnée métier Airmes. Une authentification serveur reste nécessaire
avant une utilisation confidentielle.
