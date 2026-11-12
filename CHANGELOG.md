# Historique des versions

L'historique complet depuis la première version est dans le cahier des charges.
Ce fichier reprend les versions à partir de la structuration du dépôt.

## 1.64 — 12/11/2026

Pilotage de l'appli (nécessite `supabase/pilotage.sql` sur le serveur).

- Journal des erreurs : les erreurs de code survenues chez les chauffeurs arrivent dans l'admin, regroupées par message.
- Menu « Un problème, une idée ? » : message envoyé à l'équipe, suivi dans l'admin (à traiter / traité).
- Admin : parcours des chauffeurs (email confirmé, statut renseigné, premier jour saisi, 7 jours, actifs 30 jours) et
  fidélité à un mois.
- Admin : version de l'appli utilisée par chaque compte, filtre « ancienne version ».
- Annonce écrite depuis l'admin, affichée en haut de l'appli.
- Admin : offre de chaque compte (Gratuit, Essai, Pro) avec date de fin. Aucune fonction n'est encore réservée au Pro.
- Admin : téléchargement d'une sauvegarde complète.

## 1.63 — 12/11/2026

- Code découpé en fichiers : `css/app.css` et 15 fichiers dans `js/`, sans changement de comportement.
- Copie exacte de la version 1.62 gardée dans `legacy/v1.62/`, avec `scripts/rollback.sh` pour revenir en arrière.
- Service worker : les nouveaux fichiers sont en cache hors ligne ; le code est toujours aligné sur la page.
- Appli Android (dossier `android/`) et génération automatique de l'APK.
- Vérifications automatiques à chaque pull request (`scripts/check.mjs`).
- Documentation : architecture, mise en production, installation, Android, contribution.

## 1.62 — 10/11/2026

- Sur ordinateur, la fenêtre de détail d'une semaine ou d'un mois est remontée et élargie.

## 1.61 — 10/11/2026

- Stats : cotisations URSSAF affichées à part ; Mon statut : option pour appliquer les cotisations à l'historique.

## 1.60 — 10/11/2026

- Revenus hebdomadaires : pour les chauffeurs non rattachés, une case à cocher par plateforme.
