import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const U = (n: number) => BigInt(Math.round(n)) * 10n ** 6n; // USDC 6dp
const YES = 1;
const NO = 0;

describe("Pharos — binary macro market", () => {
  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const USDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDC.deploy();
    const Factory = await ethers.getContractFactory("PharosFactory");
    const factory = await Factory.deploy(
      await usdc.getAddress(),
      deployer.address, // resolver
      deployer.address // pricingOracle
    );

    for (const who of [deployer, alice, bob]) {
      await usdc.mint(who.address, U(1_000_000));
    }

    const seed = U(5000);
    await usdc.connect(deployer).approve(await factory.getAddress(), seed);
    const resolveTime = (await time.latest()) + 7 * 24 * 3600;
    const key = ethers.keccak256(ethers.toUtf8Bytes("CPI_MOM:2026-05"));

    const tx = await factory.createMarket(
      key,
      "US headline CPI MoM for May 2026 >= 0.30%?",
      3000, // strikeScaled (0.30% * 1e6)
      resolveTime,
      "CPI_MOM",
      6500, // framework prob = 65.00%
      seed
    );
    const rcpt = await tx.wait();
    const ev = rcpt!.logs
      .map((l) => factory.interface.parseLog(l as any))
      .find((p) => p?.name === "MarketCreated");
    const marketAddr = ev!.args[0] as string;
    const market = await ethers.getContractAt("PharosMarket", marketAddr);

    return { usdc, factory, market, deployer, alice, bob, seed, resolveTime };
  }

  // total outstanding of each side must always equal collateral held.
  async function assertSolvent(market: any, holders: string[]) {
    const [, , collateral, rYes, rNo] = await market.snapshot();
    let sumYes = rYes,
      sumNo = rNo;
    for (const h of holders) {
      sumYes += await market.yesBalance(h);
      sumNo += await market.noBalance(h);
    }
    expect(sumYes).to.equal(collateral, "YES outstanding != collateral");
    expect(sumNo).to.equal(collateral, "NO outstanding != collateral");
  }

  it("opens at 0.50 crowd price with the framework price posted separately", async () => {
    const { market } = await deployFixture();
    const [mkt, fw, collateral] = await market.snapshot();
    expect(mkt).to.equal(5000); // 0.50
    expect(fw).to.equal(6500); // 0.65 framework
    expect(collateral).to.equal(U(5000));
    expect(await market.edgeBps()).to.equal(1500n); // framework sees YES underpriced
  });

  it("buying moves the crowd price and stays solvent", async () => {
    const { usdc, market, alice, bob, deployer } = await deployFixture();
    const addrs = [deployer.address, alice.address, bob.address];

    await usdc.connect(alice).approve(await market.getAddress(), U(1000));
    await market.connect(alice).buy(YES, U(1000), 0);
    const afterBuyYes = await market.marketProbBps();
    expect(afterBuyYes).to.be.greaterThan(5000);
    await assertSolvent(market, addrs);

    await usdc.connect(bob).approve(await market.getAddress(), U(400));
    await market.connect(bob).buy(NO, U(400), 0);
    expect(await market.marketProbBps()).to.be.lessThan(afterBuyYes);
    await assertSolvent(market, addrs);

    expect(await market.yesBalance(alice.address)).to.be.greaterThan(0);
    expect(await market.noBalance(bob.address)).to.be.greaterThan(0);
  });

  it("selling returns USDC and stays solvent", async () => {
    const { usdc, market, alice, deployer, bob } = await deployFixture();
    const addrs = [deployer.address, alice.address, bob.address];
    await usdc.connect(alice).approve(await market.getAddress(), U(1000));
    await market.connect(alice).buy(YES, U(1000), 0);

    const shares = await market.yesBalance(alice.address);
    const balBefore = await usdc.balanceOf(alice.address);
    await market.connect(alice).sell(YES, shares / 2n, 0);
    expect(await usdc.balanceOf(alice.address)).to.be.greaterThan(balBefore);
    await assertSolvent(market, addrs);
  });

  it("the pricing oracle can re-post the framework price", async () => {
    const { market, deployer, alice } = await deployFixture();
    await expect(market.connect(alice).updateFrameworkProb(7000)).to.be.revertedWith(
      "not pricing oracle"
    );
    await market.connect(deployer).updateFrameworkProb(7000);
    const [, fw] = await market.snapshot();
    expect(fw).to.equal(7000);
    expect(await market.edgeBps()).to.equal(2000n); // 0.70 - 0.50
  });

  it("enforces access control and resolution timing", async () => {
    const { factory, market, alice } = await deployFixture();
    await expect(
      factory
        .connect(alice)
        .createMarket(
          ethers.keccak256(ethers.toUtf8Bytes("x")),
          "q",
          0,
          (await time.latest()) + 1000,
          "CPI_MOM",
          5000,
          U(1)
        )
    ).to.be.revertedWith("not owner");

    await expect(market.connect(alice).resolve(YES)).to.be.revertedWith("not resolver");
    await expect(market.resolve(YES)).to.be.revertedWith("too early");
  });

  it("resolves, pays winners 1 USDC/share, and the contract ends solvent", async () => {
    const { usdc, market, alice, bob, deployer, resolveTime } = await deployFixture();
    const mAddr = await market.getAddress();

    await usdc.connect(alice).approve(mAddr, U(2000));
    await market.connect(alice).buy(YES, U(2000), 0);
    await usdc.connect(bob).approve(mAddr, U(1500));
    await market.connect(bob).buy(NO, U(1500), 0);

    await time.increaseTo(resolveTime + 1);
    await market.connect(deployer).resolve(YES); // YES wins

    const aliceYes = await market.yesBalance(alice.address);
    const balBefore = await usdc.balanceOf(alice.address);
    await market.connect(alice).redeem();
    expect(await usdc.balanceOf(alice.address)).to.equal(balBefore + aliceYes);

    // Loser holds only NO -> nothing to redeem.
    await expect(market.connect(bob).redeem()).to.be.revertedWith("nothing to redeem");

    // LP (creator) sweeps the pool residual.
    await market.connect(deployer).withdrawLiquidity();

    // Perfectly solvent: every USDC in has a claim, contract fully drained.
    expect(await usdc.balanceOf(mAddr)).to.equal(0n);
  });
});
