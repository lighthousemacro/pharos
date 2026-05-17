import { ethers, artifacts, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Deploys MockUSDC + PharosFactory, wires roles to the deployer (so the
// Python agents using PHAROS_DEPLOYER_KEY can create / resolve / re-price),
// mints demo USDC, and writes addresses + ABIs to ../deployments and
// ../shared/abi for the agents and the web app to consume.
async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log(`Deployer: ${deployerAddr}  (network: ${network.name})`);

  // On Arc, point at the canonical native USDC ERC-20 (6dp) at
  // 0x3600...0000. Locally, deploy a MockUSDC stand-in.
  const realUsdc = process.env.PHAROS_USDC;
  let usdc: any = null;
  let usdcAddr: string;
  if (realUsdc) {
    usdcAddr = realUsdc;
    console.log(`USDC (Arc native ERC-20): ${usdcAddr}`);
  } else {
    const USDC = await ethers.getContractFactory("MockUSDC");
    usdc = await USDC.deploy();
    await usdc.waitForDeployment();
    usdcAddr = await usdc.getAddress();
  }

  const Factory = await ethers.getContractFactory("PharosFactory");
  // resolver + pricingOracle = deployer for the demo; in prod these are the
  // oracle agent and the pricing-service signer respectively.
  const factory = await Factory.deploy(usdcAddr, deployerAddr, deployerAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();

  // Demo float only for the MockUSDC stand-in. Real Arc USDC comes from
  // the Circle faucet, never a mint.
  if (usdc) {
    const mintAmount = 5_000_000n * 10n ** 6n;
    await (await usdc.mint(deployerAddr, mintAmount)).wait();
  }

  console.log(`USDC:          ${usdcAddr}`);
  console.log(`PharosFactory: ${factoryAddr}`);

  const root = path.resolve(__dirname, "..", "..");
  const deployDir = path.join(root, "deployments");
  const abiDir = path.join(root, "shared", "abi");
  fs.mkdirSync(deployDir, { recursive: true });
  fs.mkdirSync(abiDir, { recursive: true });

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployerAddr,
    usdc: usdcAddr,
    factory: factoryAddr,
    roles: { owner: deployerAddr, resolver: deployerAddr, pricingOracle: deployerAddr },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(deployDir, `${network.name}.json`),
    JSON.stringify(deployment, null, 2)
  );

  for (const name of ["MockUSDC", "PharosFactory", "PharosMarket"]) {
    const art = await artifacts.readArtifact(name);
    fs.writeFileSync(
      path.join(abiDir, `${name}.json`),
      JSON.stringify(art.abi, null, 2)
    );
  }

  console.log(`Wrote ${path.join(deployDir, network.name + ".json")}`);
  console.log(`Wrote ABIs -> ${abiDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
