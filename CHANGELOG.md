# Historique des versions

L'historique complet depuis la première version est dans le cahier des charges.
Ce fichier reprend les versions à partir de la structuration du dépôt.

## 1.63 — 12/11/2026

- Code découpé en fichiers : `css/app.css` et 15 fichiers dans `js/`, sans changement de comportement.
- Copie exacte de la version 1.62 gardée dans `legacy/v1.62/`, avec `scripts/rollback.sh` pour revenir en arrière.
- Service worker : les nouveaux fichiers sont en cache hors ligne ; le code est toujours aligné sur la page.
- Appli Android (dossier `android/`) et génération automatique de l'APK.
- Vérifications automatiques à chaque pull request (`scripts/check.mjs`).
- Documentation : architecture, mise en production, installation, Android, contribution.

## 1.62 — 10/11/2026

- Sur ordinateur, la fenêtre de détail d'une semaine ou d'un mois est remontée et élargie.

## 1.60

- Revenus hebdomadaires : pour les chauffeurs non rattachés, une case à cocher par plateforme.
