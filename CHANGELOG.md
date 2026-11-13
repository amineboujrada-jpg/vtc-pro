# Historique des versions

L'historique complet depuis la première version est dans le cahier des charges.
Ce fichier reprend les versions à partir de la structuration du dépôt.

## 1.68 — 13/11/2026

Offre de lancement du site vitrine (nécessite la mise à jour de `supabase/sites.sql` sur le serveur).

- Site vitrine gratuit à vie pour les 100 premiers chauffeurs inscrits à l'appli, tant que le site reste actif. Le rang est
  calculé sur le serveur d'après la date d'inscription ; les inscrits à l'examen blanc et les administrateurs ne comptent pas.
- Réglages › Site vitrine et « Mon site » : l'appli indique au chauffeur s'il a le site gratuit à vie ou l'option à
  19,99 € HT par mois. Aucun compteur de places n'est affiché.
- Admin : colonne « Offre » dans la liste des sites (Gratuit à vie ou 19,99 € / mois).

## 1.67 — 12/11/2026

Site vitrine du chauffeur, en option (nécessite `supabase/sites.sql` sur le serveur et le programme Cloudflare du dépôt
`vtcrentable`).

- Réglages › Site vitrine : l'option s'active d'un bouton. Sans elle, rien ne change dans l'appli.
- « Mon site » (menu) : adresse `ton-nom.vtcrentable.fr` vérifiée pendant la saisie (libre, déjà prise, réservée), trois
  modèles (Nuit, Clair, Prestige), ville, zones, textes, services, tarifs et mentions.
- Aperçu de la page avant la mise en ligne. « Demander la mise en ligne » : l'équipe valide dans l'admin.
- Les réservations faites par les clients sur le site arrivent « En attente » dans la page Réservations.
- Admin : liste des sites, mise en ligne, suspension.

## 1.66 — 12/11/2026

- Réservations : nouvelle page en fil de cartes (pastille aux initiales du client, état, trajet, prix convenu). La
  prochaine course est affichée en grand avec « Voir détails » et « Terminer ».
- Réservations : états En attente, Confirmée, Terminée, Annulée ; une course passée non terminée est marquée « À terminer ».
- Réservations : bandeau de totaux (aujourd'hui, à venir, terminées du mois) et filtres En cours, En attente, Terminées,
  Annulées, Toutes.
- « Terminer » propose d'ajouter le prix convenu aux courses privées du jour.

## 1.65 — 12/11/2026

- Objectifs de la semaine et du mois (chiffre d'affaires ou revenu net) : barres d'avancement sur l'onglet Jour, reste à
  faire et montant par jour restant. Menu « Mes objectifs ».
- Auto-entrepreneur : suivi du seuil de franchise de TVA (37 500 €, majoré 41 250 €) et du plafond micro (83 600 €),
  alerte à partir de 80 % ou si le rythme mène au dépassement. Seuils modifiables.
- Détail du mois : « Export pour le comptable » en PDF (résumé d'une page) et en CSV (chaque jour, chaque dépense).
- Réglages › Rappel du soir : notification si la journée n'est pas saisie, heure au choix, bouton de test
  (nécessite `supabase/rappel.sql` et la fonction Edge `rappel` sur le serveur).

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
