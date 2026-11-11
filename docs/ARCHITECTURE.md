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
| 1 | `db.js` | Numéros de version, base locale IndexedDB, file d'envoi vers le serveur |
| 2 | `utils.js` | Dates et formats (euros, heures) |
| 3 | `calculs.js` | Réglages de l'activité, catégories de dépenses, calculs de rentabilité, entretien, visite technique |
| 4 | `accueil.js` | Accueil du premier lancement (statut, rattachement, plateformes) |
| 5 | `reservations.js` | Réservations |
| 6 | `pdf.js` | Génération de PDF sans bibliothèque, coordonnées de la société |
| 7 | `ui.js` | Onglet Jour : recettes, heures, kilomètres |
| 8 | `depenses.js` | Dépenses |
| 9 | `revenus.js` | Revenus hebdomadaires (virements des plateformes) |
| 10 | `stats.js` | Détail des semaines et des mois, graphiques SVG, statistiques |
| 11 | `compte.js` | Compte, connexion, passkeys, synchronisation Supabase, apparence |
| 12 | `sheets.js` | Synchronisation Google Sheets, sauvegarde et restauration |
| 13 | `menu.js` | Menu |
| 14 | `reglages.js` | Réglages : activité, véhicule, statut, catégories et charges fixes |
| 15 | `main.js` | Démarrage : ouverture de la base, connexion, premier affichage, service worker |

Règle à respecter : au chargement, un fichier ne doit appeler que des fonctions déjà chargées (les siennes ou celles
d'un fichier précédent). Les appels faits plus tard (clic, démarrage dans `main.js`) peuvent utiliser tous les fichiers.

## Données

- **Dans l'appareil** : base IndexedDB `vtc-pro` avec les magasins `days` (une journée), `depenses`, `weeks`
  (revenus d'une semaine), `settings` (réglages), `resas` (réservations), `meta` et `outbox` (modifications à envoyer).
- **Sur le serveur** : une seule table `public.entries` (`user_id`, `store`, `id`, `data` en JSON, `deleted`,
  `updated_at`). Chaque utilisateur ne lit et n'écrit que ses lignes (RLS). Schéma : `supabase/schema.sql`.
- **Administration** : table `public.admins` et fonctions `admin_*` vérifiées côté serveur (`supabase/admin.sql`).

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

## Sécurité

- La clé Supabase présente dans le code est la clé **publique** ; la protection des données repose sur RLS.
- Aucune clé secrète dans le dépôt (la clé de signature Android est dans les secrets GitHub).
- Les droits d'administration sont vérifiés par la base, jamais par le navigateur.
