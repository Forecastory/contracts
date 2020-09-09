/**
 * @title IResolution
 * @author @kohshiba
 * @dev This contract defines interface for all market models
 */

pragma solidity ^0.6.0;

abstract contract IResolution {
    function settle(uint256[] memory report) public virtual;

    function outcomeNumbers() public virtual view returns (uint256);
}
