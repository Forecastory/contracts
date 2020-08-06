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
        string memory _question,
        bytes32[] memory _outcomes,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares,
        string memory _detail
    ) public virtual view returns (bool);

    /**
     * @dev Define constructor functions for the proxy.
     */
    function initialize(
        string memory _question,
        bytes32[] memory _outcomes,
        uint256[] memory _conditions,
        address[] memory _references,
        address[] memory _beneficiaries,
        uint256[] memory _shares,
        string memory _detail
    ) public virtual returns (bool);

    /**
     * @dev Check the creator's address
     */
    function creator() public virtual view returns (address);

    /**
     * @dev Check whethere the question and outcomes are correct.
     */
    function validateHash(string memory _question, bytes32[] memory _outcomes)
        public
        virtual
        view
        returns (bool);
}
