# Intégration GitLab / n8n des reviews

Ce dossier contient les outils et tests transférés depuis le prototype du dépôt
WorkAdventure le 6 novembre 2026. Il ne dépend plus de ce dépôt ni de ses outils
Portainer. La map et son script de référence sont `../../reviews.tmj`,
`../../src/reviews.js` et `../../tilesets/reviews-tiles.png`.
Lire aussi [REVIEWS.md](../../REVIEWS.md).

## Fichiers

- `snapshot.cjs` : associe les MR ouvertes aux environnements de review disponibles,
  avec déploiement réussi, URL autorisée et conservation des 15 emplacements.
  Transmet uniquement les labels de validation `Test OK` et `Review OK`.
- `install.py` : exporte le workflow n8n ou gère son installation séparément des maps.
- `workflow.json` : export importable inactif, sans références de credentials, avec
  un chemin de webhook d'exemple. Ne pas l'activer tel quel en remplacement du flux
  existant : son URL ne correspond pas à celle de la map publiée.
- `*.test.cjs` : tests du script réel `src/reviews.js`, de la sélection des reviews
  et du Code node de l'export (entrée valide, entrée invalide, doublons et rescans),
  ainsi que les écrans du bureau technique, leur validation, le dépassement de
  capacité et le nettoyage à la sortie de la map.

## Commandes sans modification de production

Depuis la racine du projet :

```sh
npm run test:reviews
npm run build
python3 integrations/airmes-reviews/install.py --help
python3 integrations/airmes-reviews/install.py export integrations/airmes-reviews/workflow.json
```

L'export est local et ne lit aucun credential. Le webhook d'exemple est
`workadventure-airmes-reviews-example`. Le workflow actuel en production est
« WorkAdventure — Reviews Airmes » (`JBRKkCCGZ39hE7ky`) ; le transfert n'y a apporté
aucune modification. Les types/versions des nodes sont conservés depuis ce workflow :
HTTP Request 4.2, Code 2, Schedule Trigger 1.2, If 2.2, Webhook 2 et Respond to Webhook 1.4.
L'export transféré est vérifié structurellement et ses Code nodes testés localement ;
il n'a pas été réimporté ni exécuté dans une instance n8n de test lors du transfert.

## Accès n8n et installation explicite

`install.py check` lit uniquement l'état du workflow déjà enregistré.
Il réutilise `~/.config/n8n.env` (`URL`, `TOKEN`) avec permissions privées.
Les références d'installation et sauvegardes privées restent à leur emplacement
historique `~/.local/state/workadventure/mr-map/`, hors Git.

`install.py install` conserve un workflow déjà enregistré ; s'il n'en existe pas,
il crée un workflow inactif en réutilisant la référence de credential GitLab du
workflow `AirmesMrReady001` (node « Lire la MR »). L'activation est une action explicite
avec `install --activate`. Aucun secret n'est inclus dans le JSON partagé.

Le nouvel outil ne publie aucune map et ne régénère pas sa disposition. Utiliser le
build et la procédure de publication du projet de maps, en préservant les `.wam`
de production. Une nouvelle installation nécessite de reporter l'URL du webhook
dans la propriété `reviewsEndpoint` avant publication.

Après un échec réseau pendant la création d'un workflow, vérifier n8n avant de
relancer : une réponse perdue peut cacher une création réussie. La conservation
des postes repose sur les données statiques du workflow ; ce n'est pas une garantie
d'exécution exactement une fois. Les lectures GitLab paginées ne déclenchent pas
de pipeline et ne modifient aucune MR.

Le flux du prototype est public. Il contient des métadonnées de MR mais aucun jeton
ni donnée métier Airmes ; une authentification serveur reste nécessaire pour un
usage confidentiel.
