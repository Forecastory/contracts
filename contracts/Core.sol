/**
 * @title Core
 * @author @kohshiba
 * @notice This contract is the functory contract that manages functions related to market creation activities.
 */

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./Libraries/math/SafeMath.sol";
import "./Libraries//utils/Ownable.sol";
import "./Libraries/utils/Address.sol";
import "./Libraries/tokens/IERC20.sol";
import "./IMarket.sol";

contract Core is Ownable {
    using SafeMath for uint256;
    using Address for address;

    event MarketCreated(
        address indexed market,
        address indexed template,
        string question,
        bytes32[] outcomes,
        uint256[] conditions,
        address[] references,
        address[] beneficiaries,
        uint256[] shares,
        string detail
    );
    event FeeChanged(
        address template,
        uint256 indexed oldFee,
        uint256 indexed newFee
    );
    event TemplateApproval(IMarket indexed template, bool indexed approval);
    event ReferenceApproval(
        IMarket indexed template,
        uint256 indexed slot,
        address target,
        bool approval
    );

    address[] public markets;
    mapping(address => uint256) public marketIndex;

    mapping(address => bool) templates;
    mapping(address => mapping(uint256 => mapping(address => bool))) reflist;
    mapping(address => uint256) fees;
    mapping(address => bool) private tokens;

    constructor() public {}

    /**
     * @notice A function to set fees.
     * Only owner of the contract can set.
     */
    function setFee(address temp, uint256 newRate) external onlyOwner {
        uint256 oldRate = fees[temp];
        fees[temp] = newRate;
        emit FeeChanged(temp, oldRate, newRate);
    }

    /**
     * @notice A function to approve or disapprove templates.
     * Only owner of the contract can operate.
     */
    function approveTemplate(IMarket template, bool approval)
        external
        onlyOwner
    {
        require(address(template) != address(0));
        templates[address(template)] = approval;
        emit TemplateApproval(template, approval);
    }

    /**
     * @notice A function to preset reference.
     * Only owner of the contract can operate.
     */
    function approveReference(
        IMarket template,
        uint256 slot,
        address target,
        bool approval
    ) external onlyOwner {
        require(templates[address(template)] == true);
        reflist[address(template)][slot][target] = approval;
        emit ReferenceApproval(template, slot, target, approval);
    }

    /**
     * @notice A function to create markets.
     * This function is market model agnostic.
     * If oracle does not report the result, the market become broken.
     */
    function createMarket(
        IMarket template,
        string memory question,
        bytes32[] memory outcomes,
        uint256[] memory conditions,
        address[] memory references,
        address[] memory beneficiaries,
        uint256[] memory shares, //1.000% = 1000 & need to be devided by 100000
        string memory detail
    ) public returns (address) {
        require(templates[address(template)] == true, "UNAUTHORIZED_TEMPLATE");
        if (references.length > 0) {
            for (uint256 i = 0; i < references.length; i++) {
                require(
                    reflist[address(template)][i][references[i]] == true ||
                        reflist[address(template)][i][address(0)] == true,
                    "UNAUTHORIZED_REFERENCE"
                );
            }
        }
        if (fees[address(template)] > 0) {
            uint256 n = beneficiaries.length;

            address[] memory newBeneficiaries = new address[](n + 1);
            for (uint256 i = 0; i < beneficiaries.length; i++)
                newBeneficiaries[i] = beneficiaries[i];
            newBeneficiaries[n] = owner();

            uint256[] memory newShares = new uint256[](n + 1);
            for (uint256 i = 0; i < shares.length; i++)
                newShares[i] = shares[i];
            newShares[n] = fees[address(template)];

            beneficiaries = newBeneficiaries;
            shares = newShares;
        }

        require(
            template.validate(
                question,
                outcomes,
                conditions,
                references,
                beneficiaries,
                shares,
                detail
            )
        );

        IMarket market = IMarket(_createClone(address(template)));
        market.initialize(
            question,
            outcomes,
            conditions,
            references,
            beneficiaries,
            shares,
            detail
        );

        emit MarketCreated(
            address(market),
            address(template),
            question,
            outcomes,
            conditions,
            references,
            beneficiaries,
            shares,
            detail
        );
        markets.push(address(market));
        marketIndex[address(market)] = markets.length - 1;
        return address(market);
    }

    /**
     * @notice Template Code for the create clone method:
     * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1167.md
     */
    function _createClone(address target) internal returns (address result) {
        // convert address to bytes20 for assembly use
        bytes20 targetBytes = bytes20(target);
        assembly {
            // allocate clone memory
            let clone := mload(0x40)
            // store initial portion of the delegation contract code in bytes form
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            // store the provided address
            mstore(add(clone, 0x14), targetBytes)
            // store the remaining delegation contract code
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            // create the actual delegate contract reference and return its address
            result := create(0, clone, 0x37)
        }
    }
}
