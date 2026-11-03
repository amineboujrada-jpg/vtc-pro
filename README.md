# VTC Rentable

Version en ligne de l'appli VTC : **compte utilisateur** + **accès depuis le téléphone et l'ordinateur**.

- Appli : https://app.vtcrentable.com/
- Technologie : HTML/CSS/JavaScript sans framework (PWA, marche hors ligne), base locale IndexedDB.
- Serveur : Supabase (connexion email + mot de passe, base PostgreSQL protégée par RLS). Schéma : `supabase/schema.sql`.

## Synchro
Chaque saisie est enregistrée dans l'appareil puis envoyée au serveur (file d'envoi).
Les modifications faites sur un autre appareil sont récupérées à l'ouverture, au retour du réseau et toutes les 30 s.
Google Sheets reste disponible en option (Réglages).

## Mettre à jour
Changer `VERSION` dans `sw.js` à chaque nouvelle version pour que les téléphones la récupèrent.

## Site vitrine
Le site de présentation est dans le dépôt `vtcrentable` (https://vtcrentable.com).

## Administration
Tableau de bord admin : https://app.vtcrentable.com/admin.html (comptes, activité, inscriptions, suspendre / supprimer un compte, export CSV).
Accès réservé aux comptes de la table `public.admins` ; toutes les vérifications sont faites côté serveur. Schéma : `supabase/admin.sql`.
Ajouter un admin : `insert into public.admins (user_id) select id from auth.users where email = '...';`

## Publier une mise à jour
À chaque mise à jour publiée :
1. `sw.js` : `VERSION` +1 (ex. vtcpro-v53 → vtcpro-v54) ; `index.html` : `APP_VERSION` à la même valeur.
2. `index.html` : `APP_LABEL` +0,01 (ex. 1.48 → 1.49) et `APP_BUILD` à la date du jour.
3. Mettre à jour le cahier des charges (historique des versions + exigences modifiées).
