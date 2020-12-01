/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */

pragma solidity ^0.5.0;

import '../StateHub.sol';


contract StateHubMock is StateHub {

    uint256 currentBlockNumber = 0;

    // required so we can override when running tests
    function getCurrentBlockNumber() public view returns (uint256) {
        return currentBlockNumber;
    }

    function increaseCurrentBlockNumber(uint256 _num) public {
        currentBlockNumber += _num;
    }

    function jumpToBlockNumber(uint256 _num) public {
        currentBlockNumber = _num;
    }

}