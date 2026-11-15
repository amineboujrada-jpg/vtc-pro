#!/usr/bin/env bash
# Retour à une version gardée dans legacy/ : scripts/rollback.sh v1.69 (ou v1.62)
# Recopie index.html et sw.js (et css/, js/ s'ils sont dans la copie) à la racine avec un nouveau numéro technique (cache), sans rien publier :
# il reste à faire git add / commit / push.
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:-v1.62}"
SRC="legacy/$V"
[ -f "$SRC/index.html" ] && [ -f "$SRC/sw.js" ] || { echo "Version introuvable : $SRC" >&2; exit 1; }

# numéro technique suivant celui qui est en ligne (ex. vtcpro-v68 -> vtcpro-v69)
CUR=$(sed -n 's/.*const VERSION = "vtcpro-v\([0-9][0-9]*\)".*/\1/p' sw.js)
OLD=$(sed -n 's/.*const VERSION = "vtcpro-v\([0-9][0-9]*\)".*/\1/p' "$SRC/sw.js")
NEXT=$((CUR + 1))

cp "$SRC/index.html" index.html
cp "$SRC/sw.js" sw.js
# versions découpées en fichiers (1.63 et suivantes) : css/ et js/ sont aussi remis en place
if [ -d "$SRC/css" ] && [ -d "$SRC/js" ]; then
  rm -rf css js
  cp -r "$SRC/css" css
  cp -r "$SRC/js" js
  sed -i "s/vtcpro-v$OLD\"/vtcpro-v$NEXT\"/" sw.js js/db.js
  echo "Version $V remise à la racine avec ses dossiers css/ et js/ (numéro technique vtcpro-v$NEXT)."
else
  sed -i "s/vtcpro-v$OLD\"/vtcpro-v$NEXT\"/" index.html sw.js
  echo "Version $V remise à la racine (numéro technique vtcpro-v$NEXT)."
  echo "Les dossiers css/ et js/ ne sont plus utilisés par cette version ; ils peuvent rester en place."
fi
