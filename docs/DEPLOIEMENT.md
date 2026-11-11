# Mise en production

L'appli est servie par GitHub Pages depuis la branche `main` : **fusionner une pull request, c'est publier**.

## Publier une version

1. Créer une branche, faire la modification.
2. Numéros de version :
   - `sw.js` : `VERSION` +1 (ex. `vtcpro-v68` → `vtcpro-v69`) ;
   - `js/db.js` : `APP_VERSION` à la même valeur, `APP_LABEL` +0,01 (ex. 1.63 → 1.64), `APP_BUILD` à la date du jour.
3. Si un fichier est ajouté dans `css/` ou `js/` : l'ajouter dans `index.html` **et** dans la liste `FILES` de `sw.js`.
4. `node scripts/check.mjs` doit répondre `OK`.
5. Ajouter une ligne dans `CHANGELOG.md` et mettre à jour le cahier des charges.
6. Ouvrir la pull request ; les vérifications GitHub doivent être vertes ; fusionner.
7. Recopier les fichiers modifiés vers le dépôt de secours `vtc-pro-acces`
   (https://amineboujrada-jpg.github.io/vtc-pro-acces/, sans `CNAME`, avec `noindex`).

Après la fusion, vérifier sur un téléphone : ouvrir l'appli, le numéro de version du menu doit avoir changé.

## Revenir en arrière

**Annuler la dernière publication** : sur GitHub, ouvrir la pull request fusionnée puis « Revert ». Fusionner la
pull request d'annulation.

**Revenir à la version 1.62** (avant le découpage en fichiers) :

```bash
scripts/rollback.sh v1.62
git add -A && git commit -m "Retour à la version 1.62" && git push
```

Les données des chauffeurs ne sont pas concernées par un retour arrière : elles sont dans leur appareil et sur Supabase.

## Base de données

Les changements de schéma se font dans Supabase puis sont reportés dans `supabase/schema.sql` ou `supabase/admin.sql`,
dans la même pull request que le code qui les utilise.

Ajouter un administrateur :

```sql
insert into public.admins (user_id) select id from auth.users where email = '...';
```
