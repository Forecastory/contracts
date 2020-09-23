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

contract Connector {
    using SafeMath for uint256;
    using Address for address;

    address public factory;
    address public reality;
    address public arbitrator;

    mapping(address => bytes32) public questionId;

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

        return market;
    }

    function settleMarket(address market) public {
        bytes32 id = getQuestionId(market);
        bytes32 response = Realitio(reality).resultFor(id);
        uint256 length = IResolution(market).outcomeNumbers();
        uint256[] memory payout = new uint256[](length);

        if (
            response ==
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ) {
            for (uint256 i = 0; i < length - 1; i++) {
                payout[i] = 0;
            }
            payout[length - 1] = 100000;
        } else {
            uint256 result = uint256(response);
            for (uint256 i = 0; i < length; i++) {
                if (i != result) {
                    payout[i] = 0;
                } else {
                    payout[i] = 100000;
                }
            }
        }

        IResolution(market).settle(payout);
    }

    function getQuestionId(address market) public view returns (bytes32) {
        return questionId[market];
    }
}
