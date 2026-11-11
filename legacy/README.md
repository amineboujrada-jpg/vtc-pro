# Copies de secours

Ce dossier garde la dernière version de l'appli **avant** le découpage du code en fichiers `css/` et `js/`.

| Dossier | Version | Contenu |
|---|---|---|
| `v1.62/` | 1.62 (10/11/2026) | `index.html` (HTML + CSS + JavaScript dans un seul fichier) et `sw.js`, copies exactes |

## Revenir à l'ancienne version

Depuis la racine du dépôt :

```bash
scripts/rollback.sh v1.62
git add -A && git commit -m "Retour à la version 1.62" && git push
```

Le script recopie `legacy/v1.62/index.html` et `legacy/v1.62/sw.js` à la racine et donne à l'appli un nouveau numéro
technique, pour que les téléphones reprennent l'ancienne version dès la prochaine ouverture. Les données des
utilisateurs ne sont pas touchées (même base locale, même serveur).

En attendant, l'ancienne version reste aussi consultable telle quelle à l'adresse
`https://app.vtcrentable.com/legacy/v1.62/`.

Ne pas modifier les fichiers de ce dossier.
