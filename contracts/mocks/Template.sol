pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../LinerV1.sol";

contract Template is LinerV1 {
    constructor() public {}

    function nextMarketStatus() public {
        _nextMarketStatus();
    }
}
