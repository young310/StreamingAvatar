#!/usr/bin/env bash
set -euo pipefail

npm i
if [ $? -ne 0 ]; then
  echo "npm install failed. Exiting."
  exit 1
fi

echo "Launching server..."
node server.js
