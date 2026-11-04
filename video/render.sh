#!/usr/bin/env bash
# Uso: ./render.sh guiones/<id>.json [Vertical|Horizontal|ambos]
set -e
cd "$(dirname "$0")"
G=$1; FMT=${2:-ambos}
ID=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['id'])" "$G")
python3 tools/voz.py "$G"
B=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | head -1)
for C in Vertical Horizontal; do
  [ "$FMT" = ambos ] || [ "$FMT" = "$C" ] || continue
  npx remotion render src/index.ts $C "out/$ID-$C.mp4" --props="public/$ID/props.json" ${B:+--browser-executable=$B} --log=error
  echo "-> out/$ID-$C.mp4"
done
