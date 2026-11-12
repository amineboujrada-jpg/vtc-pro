# VTC Rentable — l'appli

Application de gestion d'activité pour chauffeurs VTC en France : recettes par plateforme, dépenses, heures,
kilomètres, revenus hebdomadaires, réservations et statistiques de rentabilité.

| | |
|---|---|
| Appli en ligne | https://app.vtcrentable.com/ |
| Site de présentation | https://vtcrentable.com (dépôt `vtcrentable`) |
| Administration | https://app.vtcrentable.com/admin.html (comptes, parcours, signalements, erreurs, annonce, offres, sauvegarde) |
| Version | voir `APP_LABEL` dans `js/db.js` et [CHANGELOG.md](CHANGELOG.md) |
| Contact | contact@vtcrentable.com |

## En bref

- **PWA** en HTML, CSS et JavaScript sans framework ni étape de compilation : ce qui est dans le dépôt est ce qui est servi.
- **Hors ligne d'abord** : les données sont dans l'appareil (IndexedDB) puis copiées sur le serveur par une file d'envoi.
- **Serveur** : Supabase (connexion email + mot de passe, passkeys, PostgreSQL protégé par RLS).
- **Hébergement** : GitHub Pages, branche `main`, domaine `app.vtcrentable.com`.
- **Android** : APK généré par GitHub Actions (dossier `android/`). **iPhone** : installation depuis Safari.

## Organisation du dépôt

```
index.html              structure des écrans (HTML), charge css/ et js/
css/app.css             styles de l'appli
js/                     code de l'appli, un fichier par domaine (voir docs/ARCHITECTURE.md)
sw.js                   service worker : cache hors ligne et mises à jour
manifest.webmanifest    déclaration de la PWA (nom, icônes, couleurs)
admin.html              tableau de bord d'administration
supabase/               schéma de la base (schema.sql, admin.sql, pilotage.sql)
android/                appli Android (Trusted Web Activity)
.well-known/            lien de confiance entre le site et l'appli Android
scripts/                vérifications (check.mjs) et retour arrière (rollback.sh)
legacy/                 copie exacte de la version 1.62, pour revenir en arrière
docs/                   documentation
.github/workflows/      vérifications automatiques et construction de l'APK
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — comment l'appli est construite, données et synchronisation
- [Mise en production](docs/DEPLOIEMENT.md) — publier une version, revenir en arrière
- [Installation iPhone et Android](docs/INSTALLATION.md) — pour les chauffeurs
- [Appli Android](docs/ANDROID.md) — génération et signature de l'APK
- [Contribuer](CONTRIBUTING.md) — règles de travail sur le code
- [Historique des versions](CHANGELOG.md)

## Travailler en local

```bash
python3 -m http.server 8000      # puis ouvrir http://localhost:8000
node scripts/check.mjs           # vérifications avant d'envoyer
```
