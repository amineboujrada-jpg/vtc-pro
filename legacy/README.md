# Copies de secours

Ce dossier garde des copies exactes d'anciennes versions de l'appli, pour pouvoir revenir en arrière.

| Dossier | Version | Contenu |
|---|---|---|
| `v1.62/` | 1.62 (10/11/2026) | `index.html` (HTML + CSS + JavaScript dans un seul fichier) et `sw.js`, copies exactes, avant le découpage du code |
| `v1.69/` | 1.69 (14/11/2026) | `index.html`, `sw.js`, `css/` et `js/`, copies exactes, avant la nouvelle présentation de l'onglet Jour (1.70) |

## Revenir à une ancienne version

Depuis la racine du dépôt (remplacer `v1.69` par la version voulue) :

```bash
scripts/rollback.sh v1.69
git add -A && git commit -m "Retour à la version 1.69" && git push
```

Le script recopie `index.html` et `sw.js` (et `css/`, `js/` pour la 1.69) à la racine et donne à l'appli un nouveau numéro
technique, pour que les téléphones reprennent l'ancienne version dès la prochaine ouverture. Les données des
utilisateurs ne sont pas touchées (même base locale, même serveur).

En attendant, les anciennes versions restent consultables telles quelles aux adresses
`https://app.vtcrentable.com/legacy/v1.62/` et `https://app.vtcrentable.com/legacy/v1.69/`.

Ne pas modifier les fichiers de ce dossier.
