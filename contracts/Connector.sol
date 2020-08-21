/**
 * @title Rality.eth Connector for MVP
 * @author @kohshiba
 * @notice facilitate seamless connection
 */

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./mocks/Realitio/Realitio.sol";
import "./IMarket.sol";
import "./IResolution.sol";
import "./Core.sol";

contract Connector is Ownable {
    using SafeMath for uint256;
    using Address for address;

    address factory;
    address reality;
    address arbitrator;

    mapping(address => bytes32) questionId;

    constructor(
        address _factory,
        address _reality,
        address _arbitrator
    ) public {
        factory = _factory;
        reality = _reality;
        arbitrator = _arbitrator;
    }

    /**
     * @notice A function to create markets.
     * This function is market model agnostic.
     * If oracle does not report the result, the market become broken.
     */

    function createWithOracle(
        IMarket template,
        string memory settings,
        uint256 outcomeNum,
        uint256[] memory conditions,
        address[] memory references,
        address[] memory beneficiaries,
        uint256[] memory shares, //1.000% = 1000 & need to be devided by 100000
        string memory realityParams,
        uint256 tempNum,
        uint32 timeout
    ) public returns (address) {
        references[1] = address(this);

        address market = Core(factory).createMarket(
            template,
            settings,
            outcomeNum,
            conditions,
            references,
            beneficiaries,
            shares //1.000% = 1000 & need to be devided by 100000
        );

        bytes32 qid = Realitio(reality).askQuestion(
            tempNum,
            realityParams,
            arbitrator,
            timeout,
            uint32(conditions[2]),
            0
        );

        questionId[market] = qid;
    }

    function settleMarket(address market, uint256[] memory payout) public {
        bytes32 id = questionId[market];
        bytes32 response = Realitio(reality).resultFor(id);
        uint256 num = payout.length;
        uint256[] memory result;
        if (
            response ==
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ) {
            require(payout[num - 1] == 100000);
        } else {
            uint256 decode;
            assembly {
                decode := mload(add(response, 32))
            }
            require(payout[decode] == 100000);
        }
        IResolution(market).settle(result);
    }
}
