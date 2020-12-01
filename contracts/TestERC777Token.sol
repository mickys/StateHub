/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */

pragma solidity ^0.5.0;

import "./zeppelin/token/ERC777/ERC777.sol";


contract TestERC777Token is ERC777 {

    // ------------------------------------------------------------------------------------------------

    constructor(
        string memory name,
        string memory symbol,
        uint256 _initialSupply,
        address[] memory _defaultOperators
    )
    ERC777(name, symbol, _defaultOperators)
    public
    {
        _mint(msg.sender, msg.sender, _initialSupply, "", "");
    }

}
