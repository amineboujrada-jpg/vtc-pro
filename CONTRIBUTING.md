# Contribuer

## Règles de travail

- Une branche par changement, une pull request par branche. Rien n'est poussé directement sur `main` : `main` est en ligne.
- Chaque pull request publiée augmente la version (voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)) et ajoute une ligne
  au `CHANGELOG.md`.
- Chaque changement de fonctionnalité est reporté dans le cahier des charges.
- `node scripts/check.mjs` doit passer avant d'envoyer.

## Code

- Pas de framework, pas de bibliothèque, pas d'étape de compilation.
- Le code d'un domaine va dans le fichier de `js/` qui porte son nom (voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
  Un nouveau fichier doit être ajouté à `index.html` (avant `main.js`) et à `FILES` dans `sw.js`.
- Les fichiers de `js/` partagent leurs variables : choisir des noms qui n'existent pas déjà, et ne pas appeler au
  chargement une fonction définie dans un fichier chargé plus tard.
- Commentaires et textes en français. L'appli est en français uniquement.
- Toute écriture de données passe par les fonctions de `js/db.js`, pour que la synchronisation suive.
- Ne jamais modifier le dossier `legacy/`.

## Tester à la main avant une pull request

1. `python3 -m http.server 8000`, ouvrir http://localhost:8000 en largeur téléphone.
2. Saisir une journée (recettes, carburant, heures, km), une dépense, valider une semaine.
3. Ouvrir Stats, le détail d'une semaine et d'un mois, le menu et chaque écran de réglages.
4. Aucune erreur dans la console du navigateur.
5. Couper le réseau et recharger : l'appli doit s'ouvrir.

## Messages de commit

Une phrase courte au présent qui dit ce qui change pour le chauffeur ou pour le code, par exemple
« Revenus hebdomadaires : une case à cocher par plateforme ».
