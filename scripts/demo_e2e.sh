#!/usr/bin/env bash
# Pharos end-to-end demo on a local chain, with REAL framework prices
# pulled from the live Lighthouse_Master.db.
#
#   1. start a local chain
#   2. deploy MockUSDC + PharosFactory
#   3. market-creator agent opens the 2026 calendar markets, each seeded
#      at the Lighthouse framework's point-in-time fair value
#   4. a simulated crowd trades one market away from fair value
#   5. open a fast-resolving demo market
#   6. oracle agent resolves it on real CPI data and pays the winners
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PHAROS_RPC_URL="http://127.0.0.1:8545"
export PYTHONPATH="$ROOT/agents:$ROOT/pricing"
PY="$([ -x "$ROOT/.venv/bin/python3" ] && echo "$ROOT/.venv/bin/python3" || echo python3)"

free_port() { lsof -ti tcp:8545 2>/dev/null | xargs kill -9 2>/dev/null || true; }
cleanup() { free_port; pkill -f "hardhat node" 2>/dev/null || true; }
trap cleanup EXIT

echo "==> 1. local chain (fresh)"
free_port; pkill -f "hardhat node" 2>/dev/null || true; sleep 1
( cd contracts && exec npx hardhat node >/tmp/pharos_node.log 2>&1 ) &
NODE_PID=$!
for i in $(seq 1 30); do
  curl -s -o /dev/null http://127.0.0.1:8545 && break
  sleep 1
done

echo "==> 2. deploy"
( cd contracts && npx hardhat run scripts/deploy.ts --network localhost )

echo "==> 3. market-creator agent (real framework prices from the live DB)"
"$PY" -m pharos_agents.runner create --lead 60

echo "==> 4. market book (crowd vs framework)"
"$PY" -m pharos_agents.runner status

echo "==> 5. simulated crowd disagrees — trades NFP toward NO"
NFP_ADDR=$("$PY" - <<'PY'
import sys; sys.path[:0]=["agents","pricing"]
from pharos_agents.chain import Chain
from web3 import Web3
c=Chain()
for a in c.factory().functions.allMarkets().call():
    if c.market(a).functions.resolverKind().call()=="NFP": print(a); break
PY
)
[[ -n "$NFP_ADDR" ]] && "$PY" -m pharos_agents.runner trade --market "$NFP_ADDR" --side NO --usdc 8000

echo "==> 6. edge after the crowd moves"
"$PY" -m pharos_agents.runner status

echo "==> 7. fast demo market (short fuse, resolves on real CPI data)"
"$PY" -m pharos_agents.runner demo-market --kind CPI_MOM --ref "DEMO" --resolve-in 30 --strike 3.0
"$PY" -m pharos_agents.runner fastforward --seconds 120

echo "==> 8. oracle agent resolves on the official print"
"$PY" -m pharos_agents.runner resolve

echo "==> 9. final book"
"$PY" -m pharos_agents.runner status
echo "==> done."
