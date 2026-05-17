SHELL := /bin/bash
ROOT  := $(shell pwd)
PY    := $(shell [ -x $(ROOT)/.venv/bin/python3 ] && echo $(ROOT)/.venv/bin/python3 || echo python3)
export PYTHONPATH := $(ROOT)/agents:$(ROOT)/pricing

.PHONY: setup compile test price serve demo node deploy create reprice resolve status clean

setup:        ## install all deps + compile
	bash scripts/setup.sh

compile:      ## compile solidity
	cd contracts && npx hardhat compile

test:         ## solidity test suite (lifecycle + solvency invariant)
	cd contracts && npx hardhat test

price:        ## framework prices vs the live Lighthouse DB
	cd pricing && PYTHONPATH=. $(PY) -m pharos_pricing.cli

serve:        ## run the pricing API on :6910
	cd pricing && PYTHONPATH=. $(PY) -m pharos_pricing.service

demo:         ## full end-to-end on a local chain
	bash scripts/demo_e2e.sh

node:         ## standalone local chain
	cd contracts && npx hardhat node

deploy:       ## deploy to localhost (needs `make node` running)
	cd contracts && npx hardhat run scripts/deploy.ts --network localhost

create:       ## market-creator agent: open due markets
	$(PY) -m pharos_agents.runner create --lead 60

reprice:      ## re-post framework prices on open markets
	$(PY) -m pharos_agents.runner reprice

resolve:      ## oracle agent: resolve due markets on official data
	$(PY) -m pharos_agents.runner resolve

status:       ## print the market book (crowd vs framework)
	$(PY) -m pharos_agents.runner status

clean:
	rm -rf contracts/artifacts contracts/cache contracts/typechain-types \
	       deployments/localhost.json web/.next
