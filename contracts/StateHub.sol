pragma solidity ^0.5.17;

contract StateHub {

    function tokensReceived(
        address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    )
        external
    {
        // update user balance
    }

}