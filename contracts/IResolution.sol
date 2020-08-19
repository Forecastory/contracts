/**
 * @title IResolution
 * @author @kohshiba
 * @dev This contract defines interface for all market models
 */

pragma solidity ^0.6.0;

interface IResolution {
    function settle(uint256[] calldata report) external;
}
