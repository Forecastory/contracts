pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "../Libraries/tokens/ERC20.sol";

contract Faucet is ERC20 {
    string public name = "DAI";
    string public symbol = "DAI";
    uint8 public decimals = 18;

    constructor() public {}

    mapping(address => bool) minted;

    function mint() public {
        require(minted[msg.sender] == false);
        minted[msg.sender] = true;
        _mint(msg.sender, 1e20);
    }
}
