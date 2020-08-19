pragma solidity ^0.6.0;

contract Balanceholder {
    mapping(address => uint256) public balanceOf;

    event LogWithdraw(address indexed user, uint256 amount);

    function withdraw() public {
        uint256 bal = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        msg.sender.transfer(bal);
        emit LogWithdraw(msg.sender, bal);
    }
}
