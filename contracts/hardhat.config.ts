import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Arc testnet is configured via env so no key is ever committed. Local
// hardhat network is the default and is all `make demo` needs.
const ARC_RPC = process.env.PHAROS_RPC_URL || "";
const DEPLOYER = process.env.PHAROS_DEPLOYER_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    arc: {
      url: ARC_RPC || "http://127.0.0.1:8545",
      chainId: process.env.PHAROS_CHAIN_ID ? Number(process.env.PHAROS_CHAIN_ID) : undefined,
      accounts: DEPLOYER ? [DEPLOYER] : [],
    },
  },
};

export default config;
