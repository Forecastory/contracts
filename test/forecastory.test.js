require("@openzeppelin/test-helpers/configure")({
  provider: web3.currentProvider,
  singletons: { abstraction: "truffle" },
});

const {
  BN,
  constants,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");

const { ZERO_ADDRESS } = constants;
const { expect } = require("chai");

const Core = artifacts.require("./contracts/Core.sol");
const Template = artifacts.require("./contracts/mocks/Template.sol");
const IMarket = artifacts.require("./contracts/IMarket.sol");
const Token = artifacts.require(
  "./contracts/Libraries/tokens/ERC20Mintable.sol"
);

contract("Forecastory", (accounts) => {
  let factory;
  let template;
  let market;
  let token;
  let start;
  let end;

  const [creator, bob, alice, eve, mock, mock2] = accounts;
  const minter = creator;

  const settings = `{
    question: "これは日本語だよ　这个是中文　TEST QUESTION",
    outcomes: [“Yes”, “No”],
    description: "The website is compliant. This will release the funds to Alice."
  }`;
  const question = "これは日本語だよ　这个是中文　TEST QUESTION";
  const outcomes = [
    "0x53616d706c654100000000000000000000000000000000000000000000000000",
    "0x53616d706c654200000000000000000000000000000000000000000000000000",
  ];
  const description = "sample";

  beforeEach(async () => {
    factory = await Core.new({ from: creator });
    template = await Template.new({ from: creator });
    token = await Token.new({ from: creator });
    start = await time.latest();
    end = parseInt(start) + parseInt(time.duration.days(30));
    report = end;
    await token.mint(bob, 10000000, { from: minter });
    await token.mint(alice, 10000000, { from: minter });
    await factory.approveTemplate(template.address, true, {
      from: minter,
    });
    await factory.approveReference(template.address, 0, token.address, true, {
      from: minter,
    });
    await factory.approveReference(template.address, 1, ZERO_ADDRESS, true, {
      from: minter,
    });
    await factory.createMarket(
      template.address,
      settings,
      2,
      [start, end, report, 100000, 0, 100],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    await factory.createMarket(
      template.address,
      settings,
      2,
      [start, end, report, 50000, 0, 100],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    await factory.createMarket(
      template.address,
      settings,
      2,
      [start, end, report, 200000, 0, 100],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    const marketAddress1 = await factory.markets(0);
    market1 = await Template.at(marketAddress1);
    const marketAddress2 = await factory.markets(1);
    market2 = await Template.at(marketAddress2);
    const marketAddress3 = await factory.markets(2);
    market3 = await Template.at(marketAddress3);
  });

  it("Should contracts be deployed", async () => {
    expect(factory.address).to.exist;
    expect(template.address).to.exist;
    expect(token.address).to.exist;
  });

  describe("Prediction market interaction", function () {
    describe("create market", function () {
      context("When the sender submits valid arguments", function () {
        it("successfully creates market", async function () {
          expect(await market1.creator()).to.equal(factory.address);
        });
      });
    });

    describe("Calculate investment return", function () {
      context("When the slope is 1 ", function () {
        it("returns the proper amount", async function () {
          await market1.nextMarketStatus();
          expect(
            await market1.calcBuyAmount(1000000, 0, 0, { from: bob })
          ).to.be.bignumber.equal("1378");
        });
      });
      context("When the slope is 1/2 ", function () {
        it("returns the proper amount", async function () {
          await market2.nextMarketStatus();
          expect(
            await market2.calcBuyAmount(1000000, 0, 0, { from: bob })
          ).to.be.bignumber.equal("1949");
        });
      });
      context("When the slope is 2 ", function () {
        it("returns the proper amount", async function () {
          await market3.nextMarketStatus();
          expect(
            await market3.calcBuyAmount(1000000, 0, 0, { from: bob })
          ).to.be.bignumber.equal("974");
        });
      });
      context("When the slope is 1 and fee", function () {
        it("returns the proper amount", async function () {
          await market1.nextMarketStatus();
          expect(
            await market1.calcBuyAmount(1000000, 0, 5000, { from: bob })
          ).to.be.bignumber.equal("1341");
        });
      });
    });

    describe("buy", function () {
      context("When the slope is 1", function () {
        it("returns the option token", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          expect(await market1.balanceOf(bob, 0)).to.be.bignumber.equal("1378");
          expect(await token.balanceOf(bob)).to.be.bignumber.equal("9000000");
          expect(
            await market1.calcBuyAmount(1000000, 0, 0, { from: bob })
          ).to.be.bignumber.equal("571");
          expect(await market1.getStake(0)).to.be.bignumber.equal("950000");
          expect(await market1.getSupply(0)).to.be.bignumber.equal("1378");
          expect(await market1.collectedFees(eve)).to.be.bignumber.equal(
            "50000"
          );
        });
      });
      context("When the slope is 1 and fee", function () {
        it("returns the option token", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 5000], [alice, bob, bob], {
            from: bob,
          });
          expect(await market1.balanceOf(bob, 0)).to.be.bignumber.equal("1341");
          expect(await token.balanceOf(bob)).to.be.bignumber.equal("9000000");
          expect(
            await market1.calcBuyAmount(1000000, 0, 0, { from: bob })
          ).to.be.bignumber.equal("582");
          expect(await market1.getStake(0)).to.be.bignumber.equal("900000");
          expect(await market1.getSupply(0)).to.be.bignumber.equal("1341");
          expect(await market1.collectedFees(eve)).to.be.bignumber.equal(
            "50000"
          );
          expect(await market1.collectedFees(alice)).to.be.bignumber.equal(
            "50000"
          );
        });
      });
    });

    describe("Calculate sell return", function () {
      context("When the slope is 1 ", function () {
        it("returns the proper amount", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          expect(
            await market1.calcSellAmount(1378, 0, { from: bob })
          ).to.be.bignumber.equal("950000");
        });
      });
      context("When the slope is 1/2 ", function () {
        it("returns the proper amount", async function () {
          await token.approve(market2.address, 1000000, { from: bob });
          await market2.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          expect(
            await market2.calcSellAmount(1949, 0, { from: bob })
          ).to.be.bignumber.equal("950000");
        });
      });
      context("When the slope is 2 ", function () {
        it("returns the proper amount", async function () {
          await token.approve(market3.address, 1000000, { from: bob });
          await market3.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          expect(
            await market3.calcSellAmount(974, 0, { from: bob })
          ).to.be.bignumber.equal("950000");
        });
      });
    });

    describe("Sell", function () {
      context("When the slope is 1 ", function () {
        it("returns the proper amount of the collateral", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          await market1.setApprovalForAll(market1.address, { from: bob });
          await market1.sell([1378, 1, 0], [bob, bob], { from: bob });
          expect(await market1.balanceOf(bob, 0)).to.be.bignumber.equal("0");
          expect(await token.balanceOf(bob)).to.be.bignumber.equal("9950000");
          expect(
            await market1.calcSellAmount(1000000, 0, { from: bob })
          ).to.be.bignumber.equal("0");
          expect(await market1.getStake(0)).to.be.bignumber.equal("0");
          expect(await market1.getSupply(0)).to.be.bignumber.equal("0");
        });
      });
    });

    describe("withdraw fees", function () {
      context("When the slope is 1", function () {
        it("allows withdrawal", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          await market1.withdrawFees({ from: eve });
          expect(await token.balanceOf(eve)).to.be.bignumber.equal("50000");
          expect(await market1.collectedFees(eve)).to.be.bignumber.equal("0");
        });
      });
    });

    describe("settle the market", function () {
      context("When settled by the correct conract", function () {
        it("settles the market", async function () {
          await market1.nextMarketStatus();
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          expect(await market1.marketStatus()).to.be.bignumber.equal("3");
        });
      });

      context("When settled by a wrong conract", function () {
        it("reverts", async function () {
          await market1.nextMarketStatus();
          await time.increase(time.duration.days(31));
          await expectRevert(
            market1.settle([0, 100000], { from: mock2 }),
            "UNAUTHORIZED_ORACLE"
          );
        });
      });

      context("When settled with a wrong report content", function () {
        it("reverts", async function () {
          await market1.nextMarketStatus();
          await time.increase(time.duration.days(31));
          await expectRevert(
            market1.settle([0, 50000], { from: mock }),
            "INVALID_REPORT"
          );
        });
      });
    });

    describe("claim", function () {
      context("when there is no bonus", function () {
        it("returns the dividend", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          await token.approve(market1.address, 1000000, { from: alice });
          await market1.buy([1000000, 1, 1, 0], [ZERO_ADDRESS, alice, alice], {
            from: alice,
          });
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          await market1.claim({ from: alice });
          expect(await token.balanceOf(alice)).to.be.bignumber.equal(
            "10900000"
          );
        });
      });

      context("When there is no correct predictor", function () {
        it("returns the dividend", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          await market1.claim({ from: bob });
          expect(await token.balanceOf(bob)).to.be.bignumber.equal("9950000");
        });
      });

      context("When claimed by a stranger", function () {
        it("returns nothing", async function () {
          await token.approve(market1.address, 1000000, { from: bob });
          await market1.buy([1000000, 1, 0, 0], [ZERO_ADDRESS, bob, bob], {
            from: bob,
          });
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          await market1.claim({ from: eve });
          expect(await token.balanceOf(eve)).to.be.bignumber.equal("0");
        });
      });
    });
  });
});
