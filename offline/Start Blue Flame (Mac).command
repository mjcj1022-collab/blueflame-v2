#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "Blue Flame needs Node.js to run offline. It's free and only takes a minute."
  echo "Download it from https://nodejs.org (choose the LTS version), install it,"
  echo "then double-click this file again."
  echo ""
  read -p "Press Return to close..."
  exit 1
fi
node serve.cjs
read -p "Press Return to close..."
