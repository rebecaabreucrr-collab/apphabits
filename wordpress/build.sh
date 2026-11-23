#!/usr/bin/env bash
# Gera o .zip do plugin do WordPress com a versão atual do app.
# Uso: wordpress/build.sh <pasta-de-saída> [backup.json]
# O backup (opcional) entra como includes/backup-inicial.php — nunca faça commit dele.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?informe a pasta de saída}"
BACKUP="${2:-}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -r "$ROOT/wordpress/minha-rotina" "$WORK/minha-rotina"
mkdir -p "$WORK/minha-rotina/app"
cp -r "$ROOT/index.html" "$ROOT/manifest.webmanifest" "$ROOT/sw.js" "$ROOT/css" "$ROOT/js" "$ROOT/icons" "$WORK/minha-rotina/app/"
# SDK oficial da Anthropic (IA das finanças), sem arquivos de desenvolvimento
( cd "$WORK/minha-rotina" && composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader -q )
find "$WORK/minha-rotina/vendor" -type d \( -name .git -o -name tests -o -name test -o -name docs -o -name .github -o -name examples \) -prune -exec rm -rf {} +
rm -f "$WORK/minha-rotina/composer.lock"
if [ -n "$BACKUP" ]; then
  python3 -I - "$BACKUP" "$WORK/minha-rotina/includes/backup-inicial.php" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src, encoding='utf-8'))
assert isinstance(data.get('routine'), list), 'backup inválido'
txt = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
# string PHP entre aspas simples: escapa \ e '
php = txt.replace('\\', '\\\\').replace("'", "\\'")
open(dst, 'w', encoding='utf-8').write("<?php\n// Backup inicial (carregado ao ativar o plugin). Não é acessível pelo navegador.\ndefined( 'ABSPATH' ) || exit;\nreturn '" + php + "';\n")
PY
fi
mkdir -p "$OUT"
( cd "$WORK" && rm -f "$OUT/minha-rotina.zip" && zip -qr "$OUT/minha-rotina.zip" minha-rotina )
echo "$OUT/minha-rotina.zip"
