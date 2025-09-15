#!/usr/bin/env bash
export OPENAI_API_KEY=""
export HEYGEN_API_KEY=""
set -euo pipefail

# Usage: ./start.sh <OPENAI_API_KEY>
# If OPENAI_API_KEY is already set in the environment, you can also run:
#   bash ./start.sh

if [[ "${1:-}" != "" ]]; then
  export OPENAI_API_KEY="$1"
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Error: OPENAI_API_KEY not provided."
  echo "Usage: $0 <OPENAI_API_KEY>"
  exit 1
fi

echo "OPENAI_API_KEY detected. Launching server..."
npm i
if [ $? -ne 0 ]; then
  echo "npm install failed. Exiting."
  exit 1
fi

node server.js

