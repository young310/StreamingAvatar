#!/usr/bin/env bash
export OPENAI_API_KEY="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"
export HEYGEN_API_KEY="ZTgyMzdiZDM5YzBhNGI0YThiYjY2YTUzMGY0OGU3YzUtMTczNDYwMDQ2Mg=="
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

