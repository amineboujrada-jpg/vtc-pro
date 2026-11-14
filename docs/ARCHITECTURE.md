# Architecture

## Vue d'ensemble

```
 Téléphone / ordinateur                         Serveur
┌──────────────────────────────┐          ┌─────────────────────────┐
│ index.html + css/ + js/      │          │ GitHub Pages            │
│   (PWA, service worker)      │◄─────────│  fichiers de l'appli    │
│                              │          └─────────────────────────┘
│ IndexedDB « vtc-pro »        │          ┌─────────────────────────┐
│   days, depenses, weeks,     │  outbox  │ Supabase                │
│   settings, resas, meta      │─────────►│  Auth (email, passkeys) │
│                              │◄─────────│  table entries + RLS    │
└──────────────────────────────┘  pull    └─────────────────────────┘
        │ en option
        ▼
   Google Sheets (export du chauffeur)
```

L'appli n'a ni framework ni compilation. Le navigateur charge `index.html`, la feuille `css/app.css` puis les
fichiers de `js/` dans l'ordre indiqué en bas de `index.html`.

## Les fichiers de `js/`

Ce sont des scripts classiques (pas des modules ES) : ils partagent les mêmes variables, et **l'ordre de chargement
compte**. `main.js` est toujours le dernier.

| Ordre | Fichier | Rôle |
|---|---|---|
| 1 | `erreurs.js` | Capture des erreurs de code, chargée en premier pour voir aussi celles des autres fichiers |
| 2 | `db.js` | Numéros de version, base locale IndexedDB, file d'envoi vers le serveur |
| 3 | `utils.js` | Dates et formats (euros, heures) |
| 4 | `calculs.js` | Réglages de l'activité, catégories de dépenses, calculs de rentabilité, entretien, visite technique |
| 5 | `accueil.js` | Accueil du premier lancement (statut, rattachement, plateformes) |
| 6 | `reservations.js` | Réservations |
| 7 | `pdf.js` | Génération de PDF sans bibliothèque, coordonnées de la société |
| 8 | `ui.js` | Onglet Jour : recettes, heures, kilomètres |
| 9 | `depenses.js` | Dépenses |
| 10 | `revenus.js` | Revenus hebdomadaires (virements des plateformes) |
| 11 | `stats.js` | Détail des semaines et des mois, graphiques SVG, statistiques |
| 12 | `compte.js` | Compte, connexion, passkeys, synchronisation Supabase, apparence |
| 13 | `sheets.js` | Synchronisation Google Sheets, sauvegarde et restauration |
| 14 | `menu.js` | Menu |
| 15 | `reglages.js` | Réglages : activité, véhicule, statut, catégories et charges fixes |
| 16 | `objectifs.js` | Objectifs de la semaine et du mois, seuils de l'auto-entrepreneur (TVA, plafond micro), export du mois pour le comptable |
| 17 | `suivi.js` | Suivi : envoi des erreurs au journal, version utilisée, annonce de l'équipe, fenêtre « Un problème, une idée ? » |
| 18 | `rappel.js` | Rappel du soir : abonnement de l'appareil aux notifications, réglage de l'heure |
| 19 | `site.js` | Mon site vitrine (option) : adresse, modèle, textes, version anglaise, aperçu, demande de mise en ligne |
| 20 | `main.js` | Démarrage : ouverture de la base, connexion, premier affichage, service worker |

Règle à respecter : au chargement, un fichier ne doit appeler que des fonctions déjà chargées (les siennes ou celles
d'un fichier précédent). Les appels faits plus tard (clic, démarrage dans `main.js`) peuvent utiliser tous les fichiers.

## Données

- **Dans l'appareil** : base IndexedDB `vtc-pro` avec les magasins `days` (une journée), `depenses`, `weeks`
  (revenus d'une semaine), `settings` (réglages), `resas` (réservations), `meta` et `outbox` (modifications à envoyer).
- **Sur le serveur** : une seule table `public.entries` (`user_id`, `store`, `id`, `data` en JSON, `deleted`,
  `updated_at`). Chaque utilisateur ne lit et n'écrit que ses lignes (RLS). Schéma : `supabase/schema.sql`.
- **Administration** : table `public.admins` et fonctions `admin_*` vérifiées côté serveur (`supabase/admin.sql`).
- **Pilotage** (`supabase/pilotage.sql`) : `app_errors` (journal des erreurs), `app_feedback` (signalements et idées),
  `app_clients` (version utilisée par chaque compte), `app_announcement` (annonce affichée dans l'appli) et `app_plans`
  (offre de chaque compte). Aucune de ces tables n'est lisible ou modifiable directement : l'appli passe par les
  fonctions `app_ping`, `app_report_error` et `app_send_feedback`, l'admin par les fonctions `admin_*`.
- **Rappel du soir** (`supabase/rappel.sql`) : `push_subs` (un abonnement par appareil), fonctions `app_push_*` pour
  l'appli et `rappel_*` réservées à la fonction Edge.

- **Sites vitrines** (`supabase/sites.sql`) : `sites` (un site par compte : adresse, modèle, contenu, état) et
  `site_resa_log` (limite des abus). Le chauffeur passe par `site_slug_check`, `site_get`, `site_save`, `site_demander` ;
  le public par `site_public` et `site_reserver` (la réservation est ajoutée « En attente » dans `entries`, magasin
  `resas`) ; l'admin par `admin_sites` et `admin_site_statut`. Les pages sont servies sur `<adresse>.vtcrentable.fr` par
  un programme Cloudflare (dépôt `vtcrentable`, `cloudflare/sites-chauffeurs.js`).

## Synchronisation

1. Chaque saisie est écrite dans IndexedDB puis ajoutée à `outbox`.
2. La file est envoyée à Supabase dès qu'il y a du réseau.
3. Les modifications des autres appareils sont récupérées à l'ouverture, au retour du réseau et toutes les 30 s,
   à partir de `updated_at` (heure du serveur).
4. Une suppression est gardée comme ligne `deleted = true` pour prévenir les autres appareils.

## Hors ligne et mises à jour (`sw.js`)

- À l'installation, le service worker met en cache tous les fichiers de la liste `FILES`.
- Page, CSS et JS : version en ligne si le réseau répond en moins de 4 s, sinon copie de l'appareil. Le code suit
  donc toujours la page.
- Changer `VERSION` fait installer un nouveau cache ; l'appli se recharge une fois pour l'afficher.
- Les dossiers `legacy/`, `site/` et la page admin ne passent pas par le cache.

## Suivi de l'appli

- **Erreurs** : `erreurs.js` garde les erreurs de code ; `suivi.js` les envoie une fois le compte connecté (un même
  message une seule fois, 5 par ouverture, 50 par compte et par jour côté serveur). Les coupures de réseau sont ignorées.
- **Ouverture** : `app_ping` note la version utilisée et renvoie l'annonce en cours et l'offre du compte.
- **Signalements** : menu « Un problème, une idée ? », lus dans l'admin.
- Tous ces appels sont silencieux : sans réseau ou si le serveur ne répond pas, l'appli marche comme avant.

## Rappel du soir (notifications)

1. Dans Réglages › Rappel du soir, l'appli demande l'autorisation, abonne l'appareil (Web Push) avec la clé publique
   donnée par `app_push_key()`, puis enregistre l'abonnement et l'heure choisie avec `app_push_save`.
2. Toutes les heures, `pg_cron` appelle la fonction Edge `rappel` (`supabase/functions/rappel/`).
3. La fonction demande à `rappel_due()` les appareils dont c'est l'heure, pas encore prévenus ce jour-là et sans journée
   saisie, leur envoie la notification, puis note l'envoi. Un abonnement résilié par le navigateur est supprimé.
4. `sw.js` reçoit la notification (`push`) et l'affiche, même appli fermée.

Sur iPhone, les notifications demandent que l'appli soit installée sur l'écran d'accueil (iOS 16.4 ou plus).
Les clés (VAPID, cron) sont dans Supabase Vault ; la fonction crée la paire VAPID à son premier appel.

## Sécurité

- La clé Supabase présente dans le code est la clé **publique** ; la protection des données repose sur RLS.
- Aucune clé secrète dans le dépôt (la clé de signature Android est dans les secrets GitHub).
- Les droits d'administration sont vérifiés par la base, jamais par le navigateur.
