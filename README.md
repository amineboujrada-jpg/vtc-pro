# VTC Pro

Version en ligne de l'appli VTC : **compte utilisateur** + **accès depuis le téléphone et l'ordinateur**.

- Appli : https://amineboujrada-jpg.github.io/vtc-pro/
- Technologie : HTML/CSS/JavaScript sans framework (PWA, marche hors ligne), base locale IndexedDB.
- Serveur : Supabase (connexion email + mot de passe, base PostgreSQL protégée par RLS). Schéma : `supabase/schema.sql`.

## Synchro
Chaque saisie est enregistrée dans l'appareil puis envoyée au serveur (file d'envoi).
Les modifications faites sur un autre appareil sont récupérées à l'ouverture, au retour du réseau et toutes les 30 s.
Google Sheets reste disponible en option (Réglages).

## Mettre à jour
Changer `VERSION` dans `sw.js` à chaque nouvelle version pour que les téléphones la récupèrent.
