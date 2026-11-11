#!/usr/bin/env bash
# Retour à une version gardée dans legacy/ : scripts/rollback.sh v1.62
# Recopie index.html et sw.js à la racine avec un nouveau numéro technique (cache), sans rien publier :
# il reste à faire git add / commit / push.
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:-v1.62}"
SRC="legacy/$V"
[ -f "$SRC/index.html" ] && [ -f "$SRC/sw.js" ] || { echo "Version introuvable : $SRC" >&2; exit 1; }

# numéro technique suivant celui qui est en ligne (ex. vtcpro-v68 -> vtcpro-v69)
CUR=$(grep -o 'const VERSION = "vtcpro-v[0-9]*"' sw.js | grep -o '[0-9]*"' | tr -d '"')
OLD=$(grep -o 'const VERSION = "vtcpro-v[0-9]*"' "$SRC/sw.js" | grep -o '[0-9]*"' | tr -d '"')
NEXT=$((CUR + 1))

cp "$SRC/index.html" index.html
cp "$SRC/sw.js" sw.js
sed -i "s/vtcpro-v$OLD\"/vtcpro-v$NEXT\"/" index.html sw.js
echo "Version $V remise à la racine (numéro technique vtcpro-v$NEXT)."
echo "Les dossiers css/ et js/ ne sont plus utilisés par cette version ; ils peuvent rester en place."
