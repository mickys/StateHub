/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */

pragma solidity ^0.5.17;

import "./zeppelin/math/SafeMath.sol";
import "./zeppelin/token/ERC777/IERC777.sol";
import "./zeppelin/token/ERC777/IERC777Sender.sol";
import "./zeppelin/token/ERC777/IERC777Recipient.sol";
import "./zeppelin/introspection/IERC1820Registry.sol";

contract StateHub is IERC777Recipient {

    // no fees / slashing for now.

    // A to B; A.balance = 50;
    // B to A; B.balance = 100;
    // B to C; B.balance = 50;
    // C to B; C.balance = 75;

    // A.balance = 50;
    // B.balance = 150;
    // C.balance = 75;

    // A could potentially send C max 50, using B as a proxy
    // if B sends 10 to C before this, A can send max 40
    
    // C cound potentially send A max 75, usinb B as a proxy
    // if B sends 25 to A before this, C can still send 75



    /*
     *   Instances
     */
    using SafeMath for uint256;

    /// @dev The address of the introspection registry contract.
    IERC1820Registry private ERC1820 = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

    /*
     *   Public Variables
     */

    /// @dev Maps user info to their address.
    mapping(address => User) public users;
    /// @dev Maps user info to their assigned id.
    mapping(uint256 => User) public userById;
    /// @dev Number of users in the system
    uint256 public userCount = 0;
    
    /// @dev Maps channels by id.
    mapping(uint256 => Channel) public channel;
    /// @dev Number of channels in the system
    uint256 public channelCount = 0;

    /// @dev Maps channels by PartyA and PartyB.
    mapping(address => Channel) public channelByAddress;

    /*
     * Users
     */
    struct User {
        uint256 userId;
        mapping(address => tokenData) tokensByTrackerAddress; // per token tracker address balance of this user
        mapping(uint256 => address) tokensById;         // ** info, can be removed: required so we can iterate through balances
        uint256 balanceCount;                           // ** info, can be removed: required so we can iterate through balances
        mapping(address =>                              // tracker address
            mapping(address => uint256)                 // receiver address => channel id
        ) channelByAddress;
        mapping(uint256 => uint256) channelById;        // ** info, can be removed: required so we can iterate through user channels
        uint256 channelCount;                           // ** info, can be removed: required so we can iterate through user channels
    }

    struct tokenData {
        uint id;
        uint256 inContract;
        uint256 committed;
    }

    struct Channel {
        uint256 id;
        address tracker;
        address partyA;
        uint256 balanceA;
        address partyB;
        uint256 balanceB;
        uint256 nonce;
        ChannelStateTypes state;
    }

    enum ChannelType {
        NONE,       // 0
        A2B,        // 1
        B2A         // 2
    }

    enum ChannelStateTypes {
        NOT_SET,    // 0
        OPEN,       // 1
        CLOSING,    // 2
        CLOSED      // 3
    }

    /// @notice Constructor defines ERC777TokensRecipient interface support.
    constructor() public {
        ERC1820.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
    }

    /**
     * @notice Create or update a payment channel between the two parties for specified token address
     * @param _from     Party A.
     * @param _to       Party B.
     * @param _tracker  Token Tracker address.
     * @param _amount   Token amount.
     */
    function createChannel(
        address _from,
        address _to,
        address _tracker,
        uint256 _amount
    )
    internal 
    {
        require(_from != address(0), "_from cannot be 0x");
        require(_to != address(0), "_to cannot be 0x");
        require(_tracker != address(0), "_tracker cannot be 0x");
        require(_amount > 0, "_amount cannot be 0");

        // make sure creator has enough available balance for the operation
        uint256 available = getAvailableTokenBalance(_from, _tracker);
        require(available >= _amount, "_amount cannot be higher than available balance");

        // make sure no channel for the 2 parties already exists
        ChannelType ct = getChannelType(_from, _to, _tracker);
        require(ct == ChannelType.NONE, "channel already exists");

        // require(channel[users[_from].channelByAddress[_tracker][_to]].id == 0, "a2b channel already exists");
        // require(channel[users[_to].channelByAddress[_tracker][_from]].id == 0, "b2a channel already exists");


        // get channel mapping in the user's records
        uint256 existingChannelId = getChannelId(_from, _to, _tracker);
        if(existingChannelId > 0) {
            // increase balance of the channel on the msg.sender's end
            Channel storage existingChannel = channel[existingChannelId];

        } else {
            Channel storage newChannel = channel[++channelCount];
            // create new channel
            newChannel.partyA = _from;
            newChannel.balanceA = _amount;
            newChannel.partyB = _to;
            newChannel.balanceB = 0;
            newChannel.state = ChannelStateTypes.OPEN;


            // create a token balance for user
            users[_from].tokensByTrackerAddress[_tracker].id;

            // balanceId
            // users[_from].tokens[_tracker].id

        }

        // update token balances for user
        // users[_from].tokensByTrackerAddress[_tracker].inContract+= _amount;


        // token tracker ( i.e. Lukso / DAI )
        // IERC777 tracker = IERC777(msg.sender);

        // increase the sender's balance ( _from )

        // read userData, and if channel exists fund it
    }


    /**
     * @notice Get channel type
     * @param _from     Party A.
     * @param _to       Party B.
     * @param _tracker  Token Tracker address.
     * @return ChannelType The channel type
     */
    function getChannelType(
        address _from,
        address _to,
        address _tracker
    )
    public 
    view
    returns (ChannelType)
    {
        ChannelType ct = ChannelType.NONE;
        if( channel[users[_from].channelByAddress[_tracker][_to]].id > 0) {
            ct = ChannelType.A2B;
        } else if( channel[users[_to].channelByAddress[_tracker][_from]].id > 0) {
            ct = ChannelType.B2A;
        }
        return ct;
    }

    /**
     * @notice Fund or create a payment channel between msg.sender and _to addresses
     * @param _from     Party A.
     * @param _to       Party B.
     * @param _tracker  Token Tracker address.
     */
    function getChannelId(
        address _from,
        address _to,
        address _tracker
    )
    public 
    view
    returns (uint256)
    {
        // uint256 a2b = users[_from].channelByAddress[_tracker][_to];
        // uint256 b2a = users[_to].channelByAddress[_tracker][_from];
        return users[_from].channelByAddress[_tracker][_to];
    }

    /**
     * @notice Get available token balance
     * @param _user     User address.
     * @param _tracker  Token Tracker address.
     */
    function getAvailableTokenBalance(
        address _user,
        address _tracker
    )
    public view returns (uint256) 
    {
        tokenData storage tokenStats = users[_user].tokensByTrackerAddress[_tracker];
        return tokenStats.inContract
            .sub(tokenStats.committed);
    }

    /**
     * @notice ERC777TokensRecipient implementation for receiving ERC777 tokens.
     * @param _from     Token sender.
     * @param _amount   Token amount.
     * @param _userData User data.
     */
    function tokensReceived(
        address,
        address _from,
        address,
        uint256 _amount,
        bytes calldata _userData,
        bytes calldata
    )
    external 
    {
        require(_from != address(0), "_from cannot be 0x");
        require(_amount > 0, "_amount cannot be 0");

        // increase the sender's balance ( _from )
        // users[_from].tokensByTrackerAddress[msg.sender].inContract+= _amount;

        // token tracker ( i.e. Lukso / DAI )
        // IERC777 tracker = IERC777(msg.sender);


        // read userData, and if channel exists fund it

        // createChannel(_from, _to, _tracker, _amount);

        ( uint8 _typeId, uint256 _channelAmount, uint256 _channelId, address _toAddress ) = parseUserData(_userData);
        
        if(_typeId == 0) {
            // Do nothing else, just emit received funds event
        }
        else if(_typeId == 1) {
            require(_channelAmount > 0,         "userData: _channelAmount cannot be 0");
            require(_toAddress != address(0),   "userData: _toAddress cannot be 0x");
            

            // // createOrUpdateChannel()
            // if(_channelId > 0 && ( channel[_channelId].partyA == _from || channel[_channelId].partyB == _from) ) {
            //     // sender is actually part of an existing channel
            //     // we need to update their balance there
            // }
        }
        else if(_typeId == 2) {
            require(_channelAmount > 0,         "userData: _channelAmount cannot be 0");
            require(_channelId > 0,             "userData: _channelId cannot be 0");

        }

    }

    /**
     * @notice Parse ERC777 provided userData
     * @param _userData User data.
     */
    function parseUserData(
        bytes memory _userData
    )
    public pure returns ( uint8 _typeId, uint256 _amount, uint256 _channelId, address _address )
    {
        assembly {
            // move by 32 bytes since input is a variable 
            let ptr := add( _userData, 32 )

            _typeId :=  byte( 0, mload( ptr ) )
            ptr := add(ptr, 1)

            _amount := mload( ptr ) 
            ptr := add(ptr, 32)

            _address := 0x0
            _channelId := 0x0

            switch _typeId
            case 1 {
                _address := and( 
                    // load 32 bytes, 12 garbage + 20 address
                    mload( 
                        sub(ptr, 12)
                    ),
                    // 20 byte address bitmask
                    sub( exp(256, 20), 1 )
                )
            }
            case 2 {
                _channelId := mload( ptr )
            }

        }
    }

    // ERC20 needs the approve and transfer 2 tx model
    // tx1: User approves this contract to transfer tokens from them
    // tx2: User calls contract to "fund a channel with said token amount" they just approved.

}