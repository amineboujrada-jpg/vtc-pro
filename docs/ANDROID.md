# Appli Android

Le dossier `android/` contient une **Trusted Web Activity** : une appli Android qui ouvre
https://app.vtcrentable.com/ en plein écran avec le moteur de Chrome. Le code de l'appli n'est pas dans l'APK :
publier une version du site met à jour l'appli Android, sans nouvel APK.

- Identifiant : `com.vtcrentable.android` (publié sur le compte Play Console d'un partenaire ; `com.vtcrentable.app` était l'identifiant de la première version, réservé sur le compte Play d'Amine)
- Android 6 minimum
- Si Chrome est absent du téléphone, l'appli s'ouvre dans une vue web intégrée.

## Construction

Le workflow `.github/workflows/android.yml` construit l'APK :

- à chaque changement du dossier `android/` sur `main` ;
- à la demande : onglet **Actions** → **APK Android** → **Run workflow**.

L'APK signé est publié à une adresse fixe :
`https://github.com/amineboujrada-jpg/vtc-pro/releases/download/android-latest/vtc-rentable.apk`

## Signature (à faire une fois)

L'APK doit être signé avec la clé de VTC Rentable pour s'ouvrir en plein écran, sans barre d'adresse, et pour que les
mises à jour s'installent par-dessus l'ancienne version. La clé n'est jamais dans le dépôt.

Dans GitHub : **Settings → Secrets and variables → Actions → New repository secret**, créer :

| Nom | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le fichier de clé `vtcrentable.jks` encodé en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe de la clé |

Sans ces secrets, le workflow produit un APK de test (signature de test, barre d'adresse visible) qui n'est pas publié.

**Garder une copie de la clé et de son mot de passe en lieu sûr.** Une clé perdue oblige les utilisateurs à
désinstaller puis réinstaller l'appli.

## Lien de confiance avec le site

`.well-known/assetlinks.json` contient l'empreinte SHA-256 de la clé de signature. C'est ce fichier, servi sur
`app.vtcrentable.com`, qui autorise le plein écran. Si la clé change, mettre à jour l'empreinte :

```bash
keytool -list -v -keystore vtcrentable.jks | grep SHA256
```

## Publier un nouvel APK

Seulement si le dossier `android/` change (icône, nom, couleurs) : augmenter `versionCode` de 1 et `versionName`
dans `android/app/build.gradle`.

## Google Play

Compte développeur personnel créé le 16/11/2026 (nom affiché : VTC Rentable, e-mail public
amine.apps.studio@gmail.com, statut non professionnel).

1. **Fichier à envoyer** : avec les secrets de signature en place, le workflow joint `vtc-rentable.aab`
   (artefact « vtc-rentable-aab-google-play » dans l'onglet Actions). C'est ce fichier qu'on importe dans la Play Console.
2. **Play App Signing** : Google re-signe l'appli avec sa propre clé. Notre clé ne sert plus qu'à l'envoi.
   Récupérer l'empreinte SHA-256 de Google dans Play Console → Test et publication → Intégrité de l'appli →
   Signature d'application, et l'**ajouter** dans `.well-known/assetlinks.json` (liste
   `sha256_cert_fingerprints`, en gardant l'empreinte actuelle pour l'APK du site). Sans elle, l'appli installée depuis
   Google Play affiche une barre d'adresse.
3. **Suppression de compte** (obligatoire) : bouton dans Réglages → Compte, page publique
   https://app.vtcrentable.com/suppression-compte.html. La fonction serveur est dans `supabase/suppression.sql`.
4. **Politique de confidentialité** : https://app.vtcrentable.com/confidentialite.html
5. **Test fermé** : compte personnel récent, donc 12 testeurs inscrits pendant 14 jours d'affilée avant de pouvoir
   demander la production.
6. **Version Android cible** : `targetSdk 36` (Android 16). À chaque nouvel envoi à Google Play, augmenter
   `versionCode` de 1.

## App Store

Pas prévu pour l'instant : l'iPhone passe par « Sur l'écran d'accueil » (PWA).
