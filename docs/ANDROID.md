# Appli Android

Le dossier `android/` contient une **Trusted Web Activity** : une appli Android qui ouvre
https://app.vtcrentable.com/ en plein écran avec le moteur de Chrome. Le code de l'appli n'est pas dans l'APK :
publier une version du site met à jour l'appli Android, sans nouvel APK.

- Identifiant : `com.vtcrentable.app`
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

## Plus tard : Google Play et App Store

- **Google Play** : compte développeur (25 $ une fois), même projet, `./gradlew bundleRelease` pour produire le
  fichier `.aab`. Si Play signe l'appli, ajouter son empreinte dans `assetlinks.json`.
- **App Store** : compte Apple Developer (99 €/an) et un Mac ou un service de build ; l'appli iPhone serait une
  enveloppe autour du site. Tant que ce compte n'existe pas, l'iPhone passe par « Sur l'écran d'accueil ».
