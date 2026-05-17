#!/usr/bin/env bash
# One-shot environment setup for Pharos.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> contracts: npm install"
( cd contracts && npm install --no-audit --no-fund )

echo "==> contracts: compile"
( cd contracts && npx hardhat compile )

echo "==> python: pricing + agent deps"
python3 -m pip install --quiet \
  "pandas>=2.0" "numpy>=1.24" "scipy>=1.10" \
  "fastapi>=0.110" "uvicorn>=0.27" "requests>=2.31" "python-dotenv>=1.0" \
  "web3>=6.15" "eth-account>=0.11"

echo "==> web: npm install (optional, for the UI)"
if [[ -f web/package.json ]]; then ( cd web && npm install --no-audit --no-fund ) || true; fi

[[ -f .env ]] || cp .env.example .env
echo "==> setup complete. Try:  make price   then   make demo"
