"""Thin web3 client for the Pharos contracts.

Loads addresses from ../deployments/<network>.json and ABIs from
../shared/abi (both written by contracts/scripts/deploy.ts), builds a
signer from PHAROS_DEPLOYER_KEY, and exposes typed contract handles.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from web3 import Web3

ROOT = Path(__file__).resolve().parents[2]
DEPLOY_DIR = ROOT / "deployments"
ABI_DIR = ROOT / "shared" / "abi"

try:  # optional .env support
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:  # noqa: BLE001
    pass


class Chain:
    def __init__(self, network: str | None = None):
        self.network = network or os.environ.get("PHAROS_NETWORK", "localhost")
        rpc = os.environ.get("PHAROS_RPC_URL", "http://127.0.0.1:8545")
        self.w3 = Web3(Web3.HTTPProvider(rpc))
        if not self.w3.is_connected():
            raise ConnectionError(f"no RPC at {rpc} — is the chain running?")

        key = os.environ.get(
            "PHAROS_DEPLOYER_KEY",
            "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        )
        self.acct = self.w3.eth.account.from_key(key)
        self.address = self.acct.address

        dpath = DEPLOY_DIR / f"{self.network}.json"
        if not dpath.exists():
            raise FileNotFoundError(
                f"{dpath} missing — deploy first (make deploy / hardhat run)."
            )
        self.deployment = json.loads(dpath.read_text())

    # -- ABI / contract helpers -------------------------------------------
    def _abi(self, name: str) -> list:
        return json.loads((ABI_DIR / f"{name}.json").read_text())

    def contract(self, name: str, address: str):
        return self.w3.eth.contract(
            address=Web3.to_checksum_address(address), abi=self._abi(name)
        )

    def factory(self):
        return self.contract("PharosFactory", self.deployment["factory"])

    def usdc(self):
        return self.contract("MockUSDC", self.deployment["usdc"])

    def market(self, address: str):
        return self.contract("PharosMarket", address)

    # -- tx plumbing ------------------------------------------------------
    def send(self, fn, value: int = 0):
        """Build, sign, send a contract function call; wait for the receipt."""
        tx = fn.build_transaction(
            {
                "from": self.address,
                "nonce": self.w3.eth.get_transaction_count(self.address),
                "value": value,
                "gas": 4_000_000,
                "gasPrice": self.w3.eth.gas_price,
                "chainId": self.w3.eth.chain_id,
            }
        )
        signed = self.acct.sign_transaction(tx)
        h = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        rcpt = self.w3.eth.wait_for_transaction_receipt(h, timeout=120)
        if rcpt.status != 1:
            raise RuntimeError(f"tx reverted: {h.hex()}")
        return rcpt

    def usdc_units(self, human: float) -> int:
        return int(round(human * 1_000_000))

    def block_time(self) -> int:
        """Current chain time. Authoritative for resolve-time math —
        a local dev chain's block clock can drift ahead of the wall
        clock, so demo markets must be scheduled against THIS."""
        return int(self.w3.eth.get_block("latest")["timestamp"])
