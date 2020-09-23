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
const Connector = artifacts.require("./contracts/Connector.sol");
const Template = artifacts.require("./contracts/mocks/Template.sol");
const Reality = artifacts.require("./contracts/mocks/Realitio/Realitio.sol");

contract("Connector", (accounts) => {
  let factory;
  let template;
  let connector;
  let reality;
  let start;
  let end;

  const [creator, bob, alice, mock, token] = accounts;
  const minter = creator;

  const settings = `{
    question: "これは日本語だよ　这个是中文　TEST QUESTION",
    outcomes: [“Yes”, “No”],
    description: "The website is compliant. This will release the funds to Alice."
  }`;

  beforeEach(async () => {
    factory = await Core.new({ from: creator });
    template = await Template.new({ from: creator });
    reality = await Reality.new({ from: creator });
    connector = await Connector.new(factory.address, reality.address, mock, {
      from: creator,
    });
    start = await time.latest();
    end = parseInt(start) + parseInt(time.duration.days(30));
    report = end;
    await factory.approveTemplate(template.address, true, {
      from: minter,
    });
    await factory.approveReference(template.address, 0, token, true, {
      from: minter,
    });
    await factory.approveReference(template.address, 1, ZERO_ADDRESS, true, {
      from: minter,
    });
    await connector.createWithOracle(
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
      [token, mock],
      [alice],
      [5000],
      settings,
      "2",
      "86400",
      { from: bob }
    );
    const marketAddress = await factory.markets(0);
    market = await Template.at(marketAddress);
  });

  it("Should contracts be deployed", async () => {
    expect(factory.address).to.exist;
    expect(template.address).to.exist;
    expect(reality.address).to.exist;
    expect(connector.address).to.exist;
  });

  describe("Connector interaction", function () {
    context("When create a market", function () {
      it("successfully creates market", async function () {
        expect(await market.creator()).to.equal(factory.address);
      });
    });

    context("When the answer was 'invalid'", function () {
      it("settles the market", async function () {
        await market.nextMarketStatus();
        await time.increase(time.duration.days(31));
        let id = await connector.getQuestionId(market.address);
        await reality.submitAnswer(
          id,
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          0,
          {
            from: bob,
            value: 1000000000,
          }
        );
        await time.increase(time.duration.days(2));
        await connector.settleMarket(market.address, { from: bob });
        expect(await market.marketStatus()).to.be.bignumber.equal("3");
      });
    });

    context("When the answer was '0'", function () {
      it("settles the market", async function () {
        await market.nextMarketStatus();
        await time.increase(time.duration.days(31));
        let id = await connector.getQuestionId(market.address);
        await reality.submitAnswer(
          id,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          0,
          {
            from: bob,
            value: 1000000000,
          }
        );
        await time.increase(time.duration.days(2));
        await connector.settleMarket(market.address, { from: bob });
        expect(await market.marketStatus()).to.be.bignumber.equal("3");
      });
    });
  });
});
