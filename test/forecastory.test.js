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
  let token;
  let start;
  let end;

  const [creator, bob, alice, eve, tom, mock, mock2] = accounts;
  const minter = creator;

  const settings = `{
    question: "これは日本語だよ　这个是中文　TEST QUESTION",
    outcomes: [“Yes”, “No”],
    description: "The website is compliant. This will release the funds to Alice."
  }`;

  beforeEach(async () => {
    factory = await Core.new({ from: creator });
    template = await Template.new({ from: creator });
    token = await Token.new({ from: creator });
    start = await time.latest();
    end = parseInt(start) + parseInt(time.duration.days(30));
    report = end;
    await token.mint(bob, (1e20).toString(), { from: minter });
    await token.mint(alice, (1e20).toString(), { from: minter });
    await factory.approveTemplate(template.address, true, {
      from: minter,
    });
    await factory.approveReference(template.address, 0, token.address, true, {
      from: minter,
    });
    await factory.approveReference(template.address, 1, ZERO_ADDRESS, true, {
      from: minter,
    });
    /** market 1: option price rise 1e16 per one option token issuance  */
    await factory.createMarket(
      template.address,
      settings,
      2,
      [
        start,
        end,
        report,
        (1e16).toString(),
        0,
        (1e18).toString(),
        (1e18).toString(),
      ],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    /** market 2: option price rise 1e17 per one option token issuance  */
    await factory.createMarket(
      template.address,
      settings,
      2,
      [
        start,
        end,
        report,
        (1e17).toString(),
        0,
        (1e18).toString(),
        (1e18).toString(),
      ],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    /** market 3: option price rise 1e18 per one option token issuance  */
    await factory.createMarket(
      template.address,
      settings,
      2,
      [
        start,
        end,
        report,
        (1e18).toString(),
        0,
        (1e18).toString(),
        (1e18).toString(),
      ],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    /** market 4: mocking weth env */
    await factory.createMarket(
      template.address,
      settings,
      2,
      [
        start,
        end,
        report,
        (1e11).toString(),
        0,
        (1e12).toString(),
        (1e12).toString(),
      ],
      [token.address, mock],
      [eve],
      [5000],
      { from: mock }
    );
    /** market 5: mocking usdc env */
    await factory.createMarket(
      template.address,
      settings,
      2,
      [
        start,
        end,
        report,
        (1e5).toString(),
        0,
        (1e6).toString(),
        (1e6).toString(),
      ],
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
    const marketAddress4 = await factory.markets(3);
    market4 = await Template.at(marketAddress4);
    const marketAddress5 = await factory.markets(4);
    market5 = await Template.at(marketAddress5);
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
      // mocking dai function
      context("test case for market 1", function () {
        it("returns the proper amount", async function () {
          await market1.nextMarketStatus();
          expect(
            await market1.calcBuyAmount((1e19).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("9087121146357144115");
        });
      });
      context("test case for market 2 ", function () {
        it("returns the proper amount", async function () {
          await market2.nextMarketStatus();
          expect(
            await market2.calcBuyAmount((1e19).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("7029386365926401166");
        });
      });
      context("test case for market 3 ", function () {
        it("returns the proper amount", async function () {
          await market3.nextMarketStatus();
          expect(
            await market3.calcBuyAmount((1e19).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("3472135954999579392");
        });
      });
      context("test case for market 1 and fee", function () {
        it("returns the proper amount", async function () {
          await market1.nextMarketStatus();
          expect(
            await market1.calcBuyAmount((1e19).toString(), 0, 5000, {
              from: bob,
            })
          ).to.be.bignumber.equal("8627804912002157238");
        });
      });
      // mocking weth function
      context("test case for market 4", function () {
        it("returns the proper amount", async function () {
          await market4.nextMarketStatus();
          expect(
            await market4.calcBuyAmount((1e17).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("1368441148544253230499");
        });
      });
      // mocking usdc function
      context("test case for market 5", function () {
        it("returns the proper amount", async function () {
          await market5.nextMarketStatus();
          expect(
            await market5.calcBuyAmount((1e7).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("7029386365926401166");
        });
      });
    });

    describe("buy", function () {
      context("test case for market 1", function () {
        it("returns the option token", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          expect(await market1.balanceOf(bob, 0)).to.be.bignumber.equal(
            "9087121146357144115"
          );
          expect(await token.balanceOf(bob)).to.be.bignumber.equal(
            "90000000000000000000"
          );
          expect(
            await market1.calcBuyAmount((1e19).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("8386280098350161754");
          expect(await market1.getStake(0)).to.be.bignumber.equal(
            "9500000000000000000"
          );
          expect(await market1.getSupply(0)).to.be.bignumber.equal(
            "9087121146357144115"
          );
          expect(await market1.collectedFees(eve)).to.be.bignumber.equal(
            "500000000000000000"
          );
        });
      });
      context("test case for market 1 and fee", function () {
        it("returns the option token", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 5000],
            [bob, bob, alice],
            {
              from: bob,
            }
          );
          expect(await market1.balanceOf(bob, 0)).to.be.bignumber.equal(
            "8627804912002157238"
          );
          expect(await token.balanceOf(bob)).to.be.bignumber.equal(
            "90000000000000000000"
          );
          expect(
            await market1.calcBuyAmount((1e19).toString(), 0, 0, { from: bob })
          ).to.be.bignumber.equal("8419194195194093853");
          expect(await market1.getStake(0)).to.be.bignumber.equal(
            "9000000000000000000"
          );
          expect(await market1.getSupply(0)).to.be.bignumber.equal(
            "8627804912002157238"
          );
          expect(await market1.collectedFees(eve)).to.be.bignumber.equal(
            "500000000000000000"
          );
          expect(await market1.collectedFees(alice)).to.be.bignumber.equal(
            "500000000000000000"
          );
        });
      });
      context("Attempt buying by a zero-balance account", function () {
        it("reverts", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await expectRevert(
            market1.buy(
              [(1e19).toString(), 1, 0, 0],
              [bob, bob, ZERO_ADDRESS],
              {
                from: eve,
              }
            ),
            "SafeMath: subtraction overflow"
          );
        });
      });
    });

    describe("Calculate sell return", function () {
      context("test case for market 1", function () {
        let sell = new BN("9087121146357144115");
        it("returns the proper amount", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          expect(
            await market1.calcSellAmount(sell, 0, {
              from: bob,
            })
          ).to.be.bignumber.equal("9500000000000000000");
        });
      });

      context("test case for market 2", function () {
        let sell = new BN("7029386365926401166");
        it("returns the proper amount", async function () {
          await token.approve(market2.address, (1e19).toString(), {
            from: bob,
          });
          await market2.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          expect(
            await market2.calcSellAmount(sell, 0, { from: bob })
          ).to.be.bignumber.equal("9500000000000000000");
        });
      });
      context("test case for market 3 ", function () {
        let sell = new BN("3472135954999579392");
        it("returns the proper amount", async function () {
          await token.approve(market3.address, (1e19).toString(), {
            from: bob,
          });
          await market3.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          expect(
            await market3.calcSellAmount(sell, 0, { from: bob })
          ).to.be.bignumber.equal("9500000000000000000");
        });
      });

      context("test case for market 4", function () {
        let sell = new BN("1368441148544253230499");
        it("returns the proper amount", async function () {
          await token.approve(market4.address, (1e17).toString(), {
            from: bob,
          });
          await market4.buy(
            [(1e17).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          expect(
            await market4.calcSellAmount(sell, 0, { from: bob })
          ).to.be.bignumber.equal("95000000000000000");
        });
      });

      context("test case for market 1/ buy double and sell half", function () {
        let buy = new BN("20000000000000000000");
        let sell = new BN("8386280098350161754");
        it("returns the proper amount", async function () {
          await token.approve(market1.address, buy, {
            from: bob,
          });
          await market1.buy([buy, 1, 0, 0], [bob, bob, ZERO_ADDRESS], {
            from: bob,
          });
          expect(
            await market1.calcSellAmount(sell, 0, {
              from: bob,
            })
          ).to.be.bignumber.closeTo("9500000000000000000", "1000");
        });
      });

      context("test case for market 4 / buy double and sell half", function () {
        let buy = new BN("200000000000000000");
        let sell = new BN("570943369707597460544");
        it("returns the proper amount", async function () {
          await token.approve(market4.address, buy, {
            from: bob,
          });
          await market4.buy([buy, 1, 0, 0], [bob, bob, ZERO_ADDRESS], {
            from: bob,
          });
          expect(
            await market4.calcSellAmount(sell, 0, { from: bob })
          ).to.be.bignumber.closeTo("95000000000000000", "1000");
        });
      });

      context("test case for market 5 / buy double and sell half", function () {
        let buy = new BN("20000000");
        let sell = new BN("4879515934280243372");
        it("returns the proper amount", async function () {
          await token.approve(market5.address, buy, {
            from: bob,
          });
          await market5.buy([buy, 1, 0, 0], [bob, bob, ZERO_ADDRESS], {
            from: bob,
          });
          expect(
            await market5.calcSellAmount(sell, 0, { from: bob })
          ).to.be.bignumber.closeTo("9500000", "1000");
        });
      });
      context("calculate sell more than balance", function () {
        let buy = new BN("20000000");
        let sell = new BN("100000000000000000000");
        it("reverts", async function () {
          await token.approve(market5.address, buy, {
            from: bob,
          });
          await market5.buy([buy, 1, 0, 0], [bob, bob, ZERO_ADDRESS], {
            from: bob,
          });
          await expectRevert(
            market5.calcSellAmount(sell, 0, { from: bob }),
            "BEYOND_SUPPLY"
          );
        });
      });
    });

    describe("Sell", function () {
      let sell = new BN("9087121146357144115");
      let fiction = new BN("10000000000000000000");
      context("test case for market 1", function () {
        it("returns the proper amount of the collateral", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          await market1.sell([sell, 1, 0], [bob, bob], { from: bob });
          expect(await market1.balanceOf(bob, 0)).to.be.bignumber.equal("0");
          expect(await token.balanceOf(bob)).to.be.bignumber.equal(
            "99500000000000000000"
          );
          expect(await market1.getStake(0)).to.be.bignumber.equal("0");
          expect(await market1.getSupply(0)).to.be.bignumber.equal("0");
        });
      });
      context("attempt sell by an other person", function () {
        it("reverts", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          await expectRevert(
            market1.sell([sell, 1, 0], [bob, alice], { from: alice }),
            "NOT_ELIGIBLE_TO_SELL"
          );
        });
      });
      context("attempt sell more than the balance", function () {
        it("reverts", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          await expectRevert(
            market1.sell([fiction, 1, 0], [bob, bob], { from: bob }),
            "INSUFFICIENT_AMOUNT"
          );
        });
      });
    });

    describe("withdraw fees", function () {
      context("test case for market 1", function () {
        it("allows withdrawal", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          await market1.withdrawFees(eve, { from: eve });
          expect(await token.balanceOf(eve)).to.be.bignumber.equal(
            "500000000000000000"
          );
          expect(await market1.collectedFees(eve)).to.be.bignumber.equal("0");
        });
      });
      context("Attempt by a non-stakeholder", function () {
        it("allows withdrawal, and return nothing", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [bob, bob, ZERO_ADDRESS],
            {
              from: bob,
            }
          );
          await market1.withdrawFees(eve, { from: tom });
          expect(await token.balanceOf(tom)).to.be.bignumber.equal("0");
          expect(await token.balanceOf(eve)).to.be.bignumber.equal(
            "500000000000000000"
          );
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
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [ZERO_ADDRESS, bob, bob],
            {
              from: bob,
            }
          );
          await token.approve(market1.address, (1e19).toString(), {
            from: alice,
          });
          await market1.buy(
            [(1e19).toString(), 1, 1, 0],
            [ZERO_ADDRESS, alice, alice],
            {
              from: alice,
            }
          );
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          await market1.claim(alice, { from: alice });
          expect(await token.balanceOf(alice)).to.be.bignumber.equal(
            "109000000000000000000"
          );
        });
      });

      context("When there is no correct predictor", function () {
        it("returns the dividend", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [ZERO_ADDRESS, bob, bob],
            {
              from: bob,
            }
          );
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          await market1.claim(bob, { from: bob });
          expect(await token.balanceOf(bob)).to.be.bignumber.equal(
            "99500000000000000000"
          );
        });
      });

      context("When claimed by a stranger", function () {
        it("returns nothing", async function () {
          await token.approve(market1.address, (1e19).toString(), {
            from: bob,
          });
          await market1.buy(
            [(1e19).toString(), 1, 0, 0],
            [ZERO_ADDRESS, bob, bob],
            {
              from: bob,
            }
          );
          await time.increase(time.duration.days(31));
          await market1.settle([0, 100000], { from: mock });
          await market1.claim(bob, { from: eve });
          expect(await token.balanceOf(eve)).to.be.bignumber.equal("0");
          expect(await token.balanceOf(bob)).to.be.bignumber.equal(
            "99500000000000000000"
          );
        });
      });
    });
  });
});
