/**
 * @title LinerV1
 * @author @kohshiba
 * @dev This contract is the first iteration of liner bonding curve prediction market.
 */

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./Libraries/math/SafeMath.sol";
import "./Libraries/utils/Ownable.sol";
import "./Libraries/utils/Address.sol";
import "./Libraries/tokens/ERC1155.sol";
import "./Libraries/tokens/IERC20.sol";
import "./Libraries/math/BigDiv.sol";
import "./Libraries/math/Sqrt.sol";
import "./IMarket.sol";

contract LinerV1 is ERC1155, IMarket {
    using SafeMath for uint256;
    using Sqrt for uint256;
    using Address for address;

    /**
     * EVENTS
     */

    event Buy(
        address buyer,
        address to,
        uint256 outcomeIndex,
        uint256 investValue,
        uint256 returnValue
    );
    event Sell(
        address seller,
        address to,
        uint256 outcomeIndex,
        uint256 sellValue,
        uint256 returnValue
    );
    event Claimed(
        address owner,
        uint256 outcomeIndex,
        uint256 claimedValue,
        uint256 returnValue
    );
    event PoolBalanceChanged(uint256 pool);
    event FeeCollected(
        address beneficiary,
        uint256 totalAccrued,
        uint256 collected
    );
    event FeeWithdrawal(address beneficiary, uint256 amount);
    event MarketSettled(uint256[] report);
    event MarketStatusChanged(MarketStatus statusValue);

    /**
     * MARKET CONSTANTS
     */

    /// @dev Global denominator e.g., 1.000% = 1000 & need to be devided by 100000
    uint256 private constant GLOBAL_DENOMINATOR = 100000;

    /// @dev When multiplying 2 terms, the max value is 2^128-1
    uint256 private constant MAX_BEFORE_SQUARE = 2**128 - 1;

    /// @dev The factory address that deployed this contract
    address private factory;

    /// @dev True once initialized through initialize()
    bool private initialized;

    /// @dev The buy slope of the bonding curve.
    /// This is the numerator component of the fractional value.
    uint256 public buySlopeNum;

    /// @dev The minimum amount of `currency` investment accepted.
    uint256 public minInvestment;

    /// @dev When the sell option is disabled, option tokens cannot be sold.
    bool public sellOption;

    ///@dev Market contents (Registered when market is created)
    bytes32 public hashID;
    uint256 public startTime;
    uint256 public endTime;
    address public oracle;
    IERC20 public token;
    address[] public beneficiaries;
    uint256[] public shares;

    /**
     * OUTCOMES
     */
    struct Outcome {
        uint256 supply;
        uint256 reserve;
        uint256 dividend;
    }
    ///@dev mapping for each outcome
    mapping(uint256 => Outcome) public outcome;

    ///@dev total number of outcomes
    uint256 public outcomeNumbers;

    /**
     * MARKET VARIABLES
     */

    /// @dev Pool balance at a moment
    uint256 public pool;

    /// @dev
    uint256 public totalSupply;

    /// @dev
    uint256 public bonus;

    /// @dev collected fee balances
    mapping(address => uint256) public collectedFees;

    /**
     * MARKET STATES MANAGEMENT
     */

    ///@dev Market status transition management
    enum MarketStatus {BeforeTrading, Trading, Reporting, Finalized}
    MarketStatus public marketStatus;

    ///@dev a modifier checks the current market status
    modifier atMarketStatus(MarketStatus _marketStatus) {
        require(marketStatus == _marketStatus);
        _;
    }

    ///@dev a modifier manages market transitions
    modifier marketStatusTransitions() {
        if (marketStatus == MarketStatus.BeforeTrading && now >= startTime) {
            _nextMarketStatus();
        }
        if (marketStatus == MarketStatus.Trading && now >= endTime) {
            _nextMarketStatus();
        }
        _;
    }

    constructor() public {}

    /**
     * @dev Validate market
     * This function validates the argument set for initialization.
     * Can be called before contract deployments.
     * question = the thesis of the prediction market
     * outcomes = potential outcomes
     * conditions[0] = startTime
     * conditions[1] = endTime
     * conditions[2] = buySlopeNum
     * conditions[3] = sell option (0:yes 1:no)
     * conditions[4] = minimum investment value
     * references[0] = ERC20 token used as the collateral
     * references[1] = oracle address settles the market
     * beneficiaries[] = beneficiary addresses collect fees
     * shares[] = fee shares
     * detail = any additiona info about the market
     */
    function validate(
        string memory _settings,
        uint256 _outcomeNum,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares
    ) public override view returns (bool) {
        require(bytes(_settings).length > 10);
        require(_outcomeNum >= 2);
        require(
            _conditions[1].sub(_conditions[0]) > 1 days &&
                _conditions[1].sub(now) > 1 days
        );
        require(_conditions[2] < MAX_BEFORE_SQUARE);
        require(_conditions[3] < 2);
        require(_references[0] != address(0) && _references[1] != address(0));
        require(_beneficiaries.length == _shares.length);

        uint256 share;
        for (uint256 i = 0; i < _shares.length; i++)
            share = share.add(_shares[i]);
        require(GLOBAL_DENOMINATOR > share);

        return true;
    }

    /**
     * @dev Initialize market
     * This function registers market conditions.
     * arguments are verified by the 'validate' function.
     */
    function initialize(
        string memory _settings,
        uint256 _outcomeNum,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares
    ) public override returns (bool) {
        require(
            validate(
                _settings,
                _outcomeNum,
                _conditions,
                _references,
                _beneficiaries,
                _shares
            )
        );

        require(initialized == false);
        initialized = true;
        outcomeNumbers = _outcomeNum;
        startTime = _conditions[0];
        endTime = _conditions[1];
        buySlopeNum = _conditions[2];
        if (_conditions[3] == 0) {
            sellOption = true;
        } else {
            sellOption = false;
        }
        minInvestment = _conditions[4];
        token = IERC20(_references[0]);
        oracle = _references[1];
        beneficiaries = _beneficiaries;
        shares = _shares;
        factory = msg.sender;

        hashID = keccak256(
            abi.encodePacked(
                _settings,
                _outcomeNum,
                _conditions,
                _references,
                _beneficiaries,
                _shares
            )
        );

        marketStatus = MarketStatus.BeforeTrading;
        return true;
    }

    /**
     * @dev Buy
     * Market participants can buy option tokens through this function.
     * _params[0] investmentAmount,
     * _params[1] minTokensBought,
     * _params[2] outcomeIndex,
     * _params[3] fee,
     * _addresses[0] beneficiary,
     * _addresses[1] owner,
     * _addresses[2] to
     */
    function buy(uint256[] memory _params, address[] memory _addresses)
        public
        override
        marketStatusTransitions
        atMarketStatus(MarketStatus.Trading)
    {
        require(
            IERC20(token).balanceOf(msg.sender) >= _params[0] ||
                IERC20(token).allowance(_addresses[1], msg.sender) >=
                _params[0],
            "INSUFFICIENT_AMOUNT"
        );
        require(_addresses[2] != address(0), "INVALID_ADDRESS");
        require(_params[1] > 0, "MUST_BUY_AT_LEAST_1");

        // Calculate the tokenValue for this investment
        uint256 tokenValue = calcBuyAmount(_params[0], _params[2], _params[3]);
        require(tokenValue >= _params[1], "PRICE_SLIPPAGE");

        IERC20(token).transferFrom(msg.sender, address(this), _params[0]);
        if (shares.length > 0 || _params[3] > 0) {
            uint256 afterFee = _collectFees(
                _params[0],
                _params[3],
                _addresses[0]
            );
            outcome[_params[2]].reserve = outcome[_params[2]].reserve.add(
                afterFee
            );
            pool = pool.add(afterFee);
            emit PoolBalanceChanged(pool);
        } else {
            outcome[_params[2]].reserve = outcome[_params[2]].reserve.add(
                _params[0]
            );
            pool = pool.add(_params[0]);
            emit PoolBalanceChanged(pool);
        }

        _mint(_addresses[2], _params[2], tokenValue, "");
        outcome[_params[2]].supply = outcome[_params[2]].supply.add(tokenValue);
        totalSupply = totalSupply.add(tokenValue);

        emit Buy(msg.sender, _addresses[2], _params[2], _params[0], tokenValue);
    }

    /**
     * @dev Sell
     * Market participants can sell option tokens through this function.
     * _params[0] sellAmount,
     * _params[1] minReturned,
     * _params[2] outcomeIndex,
     * _addresses[0] owner,
     * _addresses[1] to
     */
    function sell(uint256[] memory _params, address[] memory _addresses)
        public
        override
        marketStatusTransitions
        atMarketStatus(MarketStatus.Trading)
    {
        require(sellOption == true, "SELL_OPTION_DISABLED");
        require(
            balanceOf(_addresses[0], _params[2]) >= _params[0],
            "INSUFFICIENT_AMOUNT"
        );
        require(
            msg.sender == _addresses[0] ||
                _operatorApprovals[_addresses[0]][msg.sender],
            "NOT_ELIGIBLE_TO_SELL"
        );

        uint256 returnValue = calcSellAmount(_params[0], _params[2]);
        require(returnValue >= _params[1], "PRICE_SLIPPAGE");
        _burn(_addresses[0], _params[2], _params[0]);
        _withdraw(_addresses[1], returnValue);
        outcome[_params[2]].reserve = outcome[_params[2]].reserve.sub(
            returnValue
        );
        outcome[_params[2]].supply = outcome[_params[2]].supply.sub(_params[0]);
        totalSupply = totalSupply.sub(_params[0]);
        emit Sell(
            msg.sender,
            _addresses[0],
            _params[2],
            _params[0],
            returnValue
        );
    }

    /**
     * @dev Settle
     * Registered oracle settles market by reporting payout shares.
     */
    function settle(uint256[] memory report)
        public
        override
        marketStatusTransitions
        atMarketStatus(MarketStatus.Reporting)
    {
        require(msg.sender == oracle, "UNAUTHORIZED_ORACLE");
        uint256 total;
        for (uint256 i = 0; i < report.length; i++) {
            total = total.add(report[i]);
        }
        require(
            total == GLOBAL_DENOMINATOR && report.length == outcomeNumbers,
            "INVALID_REPORT"
        );
        _nextMarketStatus();

        /**
         * If there is no supply for a winning option,
         * the dividend of that will be distributed to all token holders.
         */
        for (uint256 i = 0; i < report.length; i++) {
            if (outcome[i].supply == 0) {
                uint256 temp = BigDiv.bigDiv2x1(
                    pool,
                    report[i],
                    GLOBAL_DENOMINATOR
                );
                bonus = bonus.add(temp);
            } else {
                outcome[i].dividend = BigDiv.bigDiv2x1(
                    pool,
                    report[i],
                    GLOBAL_DENOMINATOR
                );
            }
        }

        emit MarketSettled(report);
    }

    /**
     * @dev Winnig token holders can claim redemption through this function
     */
    function claim() public override atMarketStatus(MarketStatus.Finalized) {
        uint256 redemption;
        for (uint256 i = 0; i < outcomeNumbers; i++) {
            uint256 balance = balanceOf(msg.sender, i);
            if (balance > 0) {
                uint256 retVal;

                if (bonus > 0) {
                    uint256 value = BigDiv.bigDiv2x1(
                        bonus,
                        balance,
                        totalSupply
                    );
                    bonus = bonus.sub(value);
                    retVal = retVal.add(value);
                }
                if (outcome[i].dividend > 0) {
                    uint256 value = BigDiv.bigDiv2x1(
                        outcome[i].dividend,
                        balance,
                        outcome[i].supply
                    );
                    outcome[i].dividend = outcome[i].dividend.sub(value);
                    retVal = retVal.add(value);
                }
                if (retVal > 0) {
                    _burn(msg.sender, i, balance);
                    outcome[i].supply = outcome[i].supply.sub(balance);
                    totalSupply = totalSupply.sub(balance);
                    redemption = redemption.add(retVal);
                    emit Claimed(msg.sender, i, balance, retVal);
                }
            }
        }
        if (redemption > 0) {
            _withdraw(msg.sender, redemption);
        }
    }

    /**
     * @dev Beneficiaries can withdraw fees through this function.
     */
    function withdrawFees() public override {
        uint256 amount = collectedFees[msg.sender];
        collectedFees[msg.sender] = 0;
        IERC20(token).transfer(msg.sender, amount);
        emit FeeWithdrawal(msg.sender, amount);
    }

    /**
     * @dev Calclate estimate option token amount for the investment at a time.
     */
    function calcBuyAmount(
        uint256 investmentAmount,
        uint256 outcomeIndex,
        uint256 fee
    ) public view returns (uint256) {
        if (investmentAmount < minInvestment) {
            return 0;
        }

        /**
         * Calculate the fee rate for this investment.
         */

        uint256 afterFee;
        if (shares.length > 0 || fee > 0) {
            uint256 feeRate;
            for (uint256 i = 0; i < shares.length; i++) {
                feeRate = feeRate.add(shares[i]);
            }
            feeRate = feeRate.add(fee);
            require(feeRate < GLOBAL_DENOMINATOR);
            uint256 fees = BigDiv.bigDiv2x1(
                investmentAmount,
                feeRate,
                GLOBAL_DENOMINATOR
            );
            afterFee = investmentAmount.sub(fees);
        } else {
            afterFee = investmentAmount;
        }

        /**
         * Calculate the tokenValue for this investment.
         * The formula is below.
         * token numbers to mint = sqrt((2*investment_amount/buy_slope)+(supply)^2)-(supply)
         * original formula from: https://github.com/c-org/whitepaper#annex
         */

        uint256 tokenValue;

        if (marketStatus == MarketStatus.Trading) {
            uint256 supply = outcome[outcomeIndex].supply;
            tokenValue = BigDiv.bigDiv2x1(
                afterFee,
                2 * GLOBAL_DENOMINATOR,
                buySlopeNum
            );
            tokenValue = tokenValue.add(supply * supply);
            tokenValue = tokenValue.sqrt();
            tokenValue = tokenValue.sub(supply);
        } else {
            return 0;
        }

        return tokenValue;
    }

    /**
     * @dev Calclate estimate collateralize token value for selling ptions
     */
    function calcSellAmount(uint256 sellAmount, uint256 outcomeIndex)
        public
        view
        returns (uint256)
    {
        require(sellOption == true, "SELL OPTION IS DISABLED");
        uint256 retVal;
        if (marketStatus == MarketStatus.Trading) {
            uint256 supply = outcome[outcomeIndex].supply;
            uint256 reserve = outcome[outcomeIndex].reserve;

            if (supply == 0) {
                return 0;
            }

            /**
             * Calculate the tokenValue for this investment.
             * reserve = r
             * supply = s
             * amount to sell = a
             * imp:  (2 a r)/(s) - (a^2 r)/(s)^2
             * original formula from: https://github.com/c-org/whitepaper#annex
             */

            uint256 temp = sellAmount.mul(2 * reserve);
            temp /= supply;

            retVal += temp;

            retVal -= BigDiv.bigDiv2x1(
                sellAmount.mul(sellAmount),
                reserve,
                supply * supply
            );

            return retVal;
        } else {
            return 0;
        }
    }

    /**
     * @dev function to get pool balance for each option
     */
    function getStake(uint256 outcomeIndex) public view returns (uint256) {
        return outcome[outcomeIndex].reserve;
    }

    /**
     * @dev function to get supply for each option
     */
    function getSupply(uint256 outcomeIndex) public view returns (uint256) {
        return outcome[outcomeIndex].supply;
    }

    /**
     * @dev a function to check the factory address
     */
    function creator() public override view returns (address) {
        return factory;
    }

    /**
     * @dev Validate market question and outcome lists
     */
    function validateHash(
        string memory _settings,
        uint256 _outcomeNum,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares
    ) public override view returns (bool) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                _settings,
                _outcomeNum,
                _conditions,
                _references,
                _beneficiaries,
                _shares
            )
        );
        return (hash == hashID);
    }

    function _nextMarketStatus() internal {
        marketStatus = MarketStatus(uint256(marketStatus) + 1);
        emit MarketStatusChanged(marketStatus);
    }

    function _withdraw(address to, uint256 amount) internal {
        IERC20(token).transfer(to, amount);
        pool = pool.sub(amount);
        emit PoolBalanceChanged(pool);
    }

    function _collectFees(
        uint256 amount,
        uint256 fee,
        address beneficiary
    ) internal returns (uint256) {
        uint256 fees;
        for (uint256 i = 0; i < shares.length; i++) {
            uint256 portion = BigDiv.bigDiv2x1(
                amount,
                shares[i],
                GLOBAL_DENOMINATOR
            );
            collectedFees[beneficiaries[i]] = collectedFees[beneficiaries[i]]
                .add(portion);
            fees = fees.add(portion);
            emit FeeCollected(
                beneficiaries[i],
                collectedFees[beneficiaries[i]],
                portion
            );
        }
        if (fee > 0) {
            uint256 portion = BigDiv.bigDiv2x1(amount, fee, GLOBAL_DENOMINATOR);
            collectedFees[beneficiary] = collectedFees[beneficiary].add(
                portion
            );
            fees = fees.add(portion);
            emit FeeCollected(beneficiary, collectedFees[beneficiary], portion);
        }
        return amount.sub(fees);
    }
}
