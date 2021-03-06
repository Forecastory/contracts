/**
 * @title IMarket
 * @author @kohshiba
 * @dev This contract defines interface for all market models
 */

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

abstract contract IMarket {
    /**
     * @dev Check whether the conditonse are correct for the contract.
     */
    function validate(
        string memory _settings,
        uint256 _outcomeNum,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares
    ) public virtual view returns (bool);

    /**
     * @dev Define constructor functions for the proxy.
     */
    function initialize(
        string memory _settings,
        uint256 _outcomeNum,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares
    ) public virtual returns (bool);

    /**
     * @dev Check the creator's address
     */
    function creator() external virtual view returns (address);

    /**
     * @dev Check whethere the market conditions are correct.
     */
    function validateHash(
        string memory _settings,
        uint256 _outcomeNum,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares
    ) public virtual view returns (bool);
}
