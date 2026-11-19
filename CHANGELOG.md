# Historique des versions

L'historique complet depuis la première version est dans le cahier des charges.
Ce fichier reprend les versions à partir de la structuration du dépôt.

## 1.83 — 19/11/2026

- Le cadran de date est affiché directement sous la date de l'onglet Jour, dans un cadre comme le bloc Objectif.
  Les molettes jour, mois et année suivent la date (flèches ‹ › et « Revenir à aujourd'hui ») ; un défilement change la date.
  Pas de date après aujourd'hui.
- Le bouton « + Ajouter » (Dernières dépenses) est en style neutre, sans le bleu.

## 1.82 — 19/11/2026

- Date de l'onglet Jour : toucher « Jeudi 19 novembre » ouvre un cadran à molettes (jour, mois, année).
  Pas de date après aujourd'hui. Les flèches ‹ › restent en place.
- Le bouton flottant « Ajouter une dépense » disparaît : « + Ajouter » est dans l'en-tête de « Dernières dépenses ».
  Il ne masque plus la liste.

## 1.81 — 19/11/2026

- Menu fixe en bas de l'écran, avec trois onglets : Mise à jour (Jour), Réservations et Statistiques.
  Les onglets du haut sont retirés. Le contenu des écrans ne change pas.
- Le bouton « Ajouter une dépense » remonte au-dessus du menu.

## 1.80 — 18/11/2026

- Onglet Jour : les blocs Semaine et Mois reviennent en haut, juste sous la date (et sous « Démarrer ma journée »),
  avant les objectifs et la saisie. Ils gardent leur petite taille.
- Le libellé (« Semaine du 16/11 », « Novembre 2026 ») tient toujours sur une ligne ; le montant et « Détail › »
  sont sur la ligne en dessous. Les deux blocs restent alignés, même sur un petit téléphone.
- Sur ordinateur, le bouton « Démarrer ma journée » est sous la date (il tombait en bas de la colonne).

## 1.79 — 17/11/2026

- Appli Android publiée sur Google Play (`com.vtcrentable.android`, compte du partenaire ADVINNOS).
- Lien de confiance : empreinte de la clé de signature Google Play de ce compte ajoutée à `.well-known/assetlinks.json`
  (l'appli s'ouvre en plein écran, sans barre d'adresse). Aucun changement dans l'appli.

## 1.78 — 17/11/2026

- Mode service plus discret : petit bouton « Démarrer ma journée » sous la date, puis un bandeau fin avec le temps
  travaillé et les boutons Pause et Terminer.
- Pauses illimitées (repas…), non comptées dans les heures ; le total des pauses est modifiable à la fin.
- Réglages → Plateformes et journée : heure de fin de la journée de travail, de 00h (par défaut) à 12h, comme Uber.
  Avant cette heure, l'onglet Jour reste sur la veille ; à cette heure, il passe à la journée suivante. Un service
  en cours à ce moment est coupé : les heures vont sur la journée finie, le service continue sur la nouvelle, et les
  km saisis à la fin sont répartis selon les heures de chaque journée.

## 1.77 — 17/11/2026

- Onglet Jour : nouveau mode service. « Démarrer ma journée » enregistre l'heure de départ et reprend le compteur
  de la veille ; « Terminer ma journée » propose l'heure de fin et demande le compteur de fin (ou un nombre de km),
  puis ajoute les heures et les km au jour. Tout reste modifiable. Nouveau fichier `js/service.js`.

## 1.76 — 17/11/2026

- Nouvelle page publique `cgu.html` : conditions générales d'utilisation (objet, compte, prix, calculs indicatifs,
  bon de commande, disponibilité, données, suppression, droit français). Liens depuis Réglages → Application et
  depuis l'écran d'accueil ; ajoutée au plan du site.
- Mentions légales : hébergement des pages sur Cloudflare Pages.

## 1.75 — 17/11/2026

- Android : nouvel identifiant `com.vtcrentable.android` (appli 1.3, versionCode 4), pour la publication sur le
  Google Play d'un compte partenaire (l'identifiant `com.vtcrentable.app` reste réservé au premier compte Play Console).
  `assetlinks.json` déclare les deux identifiants ; l'empreinte de la clé Google Play du nouveau compte sera ajoutée
  après le premier import. Aucun changement dans l'appli web.

## 1.74 — 17/11/2026

- Lien de confiance Android : empreinte de la clé de signature Google Play ajoutée à `.well-known/assetlinks.json`
  (l'appli installée depuis le Play Store s'ouvre en plein écran, sans barre d'adresse). Aucun changement dans l'appli.

## 1.73 — 17/11/2026

Appli Android acceptée par Google Play.

- Android : version minimale passée à Android 7.0 (minSdk 24, demandé par la protection automatique de Google Play).
  Appli Android 1.2 (versionCode 3). Aucun changement dans l'appli web.
- Hébergement : l'appli est servie par Cloudflare Pages (projet `vtc-pro`, publié à chaque fusion sur `main`)
  depuis le 17/11/2026, à la même adresse app.vtcrentable.com.

## 1.72 — 16/11/2026

Préparation de la publication sur Google Play.

- Réglages → Compte : nouveau bouton « Supprimer mon compte » (deux confirmations). Le compte et toutes ses données
  sont effacés sur le serveur (fonction `supprimer_mon_compte`, fichier `supabase/suppression.sql`) puis sur l'appareil.
- Nouvelle page publique `suppression-compte.html` (lien demandé par Google Play), reliée depuis la politique de
  confidentialité et l'écran Application.
- Politique de confidentialité : suppression du compte depuis l'appli.
- Réglages → Application : comment installer l'appli sur iPhone et Android.
- Android : le workflow produit aussi le fichier `.aab` pour la Play Console ; cible Android 16 (API 36),
  versionCode 2.

## 1.71 — 16/11/2026

Correction : frais de rattachement affichés à 0 dans « Revenus hebdomadaires ».

- Cause : en touchant « Enregistrer » sur une semaine encore vide (par exemple la semaine en cours), l'appli figeait les
  frais de la semaine à 0 €. Les montants saisis ensuite ne changeaient plus ce 0 : le virement estimé était trop haut
  du prix du rattachement.
- Les frais ne sont maintenant figés qu'une fois le chiffre d'affaires de la semaine saisi.
- Les semaines déjà touchées se corrigent toutes seules à l'ouverture de l'appli (semaines depuis la date de début du
  rattachement dans les réglages) : frais et virement estimé reprennent le prix du rattachement.

## 1.70 — 15/11/2026

Onglet Jour réorganisé : la saisie passe en premier.

- Les objectifs de la semaine et du mois tiennent chacun sur une ligne (montant et barre), au-dessus de la saisie.
  Le détail (reste, rythme par jour) s'ouvre en touchant le bloc, comme avant.
- La saisie vient tout de suite après : recettes du jour, puis « Dépenses du jour » (carburant, repas), puis
  « Horaires et kilomètres » (heures, km, € / km, € / heure).
- Nouvelle ligne « Net du jour » sous la saisie : recettes moins carburant et repas du jour.
- Les cartes Semaine et Mois passent sous la saisie, en version compacte (net seul) ; le détail s'ouvre toujours au toucher.
- Rien ne change dans les données ni dans les calculs.
- Copie de secours de la version 1.69 dans `legacy/v1.69/` ; `scripts/rollback.sh v1.69` la remet en place.

## 1.69 — 14/11/2026

Version anglaise du site vitrine (nécessite la mise à jour de `supabase/sites.sql` sur le serveur et le programme
Cloudflare du dépôt `vtcrentable`).

- Chaque site de chauffeur existe aussi en anglais (`ton-nom.vtcrentable.fr/en/`). Un visiteur dont le navigateur n'est
  pas en français le voit en anglais ; un navigateur en français reste en français. Un bouton (globe) en haut du site
  permet de changer de langue.
- Les textes du chauffeur sont traduits automatiquement. « Mon site » : nouvelle rubrique « Version anglaise » pour
  écrire sa propre accroche et sa propre présentation en anglais (facultatif), et bouton « Voir l'aperçu en anglais ».
- Une réservation faite depuis la version anglaise arrive avec la note « Client anglophone ».

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
