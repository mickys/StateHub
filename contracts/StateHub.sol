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
import "./zeppelin/cryptography/ECDSA.sol";


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

    // TODO:
    //
    // ERC20 needs the approve and transfer 2 tx model
    // tx1: User approves this contract to transfer tokens from them
    // tx2: User calls contract to "fund a channel with said token amount" they just approved.
    //
    // user: retrieve tokens from contract.
    //

    /*
     *   Instances
     */
    using SafeMath for uint256;
    using ECDSA for bytes32;
    /// @dev Signature size is 65 bytes (tightly packed v + r + s), but gets padded to 96 bytes
    uint256 private constant _SIGNATURE_SIZE = 96;

    /// @dev The address of the introspection registry contract.
    IERC1820Registry private ERC1820 = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    bytes32 constant private TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

    /*
     *   Public Variables
     */

    /// @dev Maps user info to their address.
    mapping(address => User) public users;
    /// @dev Maps user id to their address.
    mapping(uint256 => address) public userById;
    /// @dev Number of users in the system
    uint256 public userCount = 0;
    
    /// @dev Maps channels by id.
    mapping(uint256 => Channel) public channel;
    /// @dev Number of channels in the system
    uint256 public channelCount = 0;

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
        uint256 round;
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
     * @notice Createa payment channel between the two parties for specified token address and allocate amount for party A
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
        require(_from != address(0),    "createChannel: _from cannot be 0x");
        require(_to != address(0),      "createChannel: _to cannot be 0x");
        require(_tracker != address(0), "createChannel: _tracker cannot be 0x");
        require(_amount > 0,            "createChannel: _amount cannot be 0");

        // make sure creator has enough available balance for the operation
        uint256 available = getAvailableTokenBalance(_from, _tracker);
        require(available >= _amount, "createChannel: _amount cannot be higher than available balance");

        ChannelType ct = getChannelType(_from, _to, _tracker);
        // make sure no channel for the 2 parties already exists
        require(ct == ChannelType.NONE, "createChannel: channel already exists!");

        // create new channel
        channelCount++;
        Channel storage newChannel = channel[channelCount];
        newChannel.id = channelCount;
        newChannel.partyA = _from;
        newChannel.balanceA = _amount;
        newChannel.partyB = _to;
        newChannel.balanceB = 0;
        newChannel.tracker = _tracker;
        newChannel.state = ChannelStateTypes.OPEN;

        users[_from].channelCount++;
        users[_from].channelById[users[_from].channelCount] = newChannel.id;
        users[_from].channelByAddress[_tracker][_to] = newChannel.id;

        users[_from].tokensByTrackerAddress[_tracker].committed = users[_from].tokensByTrackerAddress[_tracker].committed.add(_amount);

        // TODO: emit event
    }

    /**
     * @notice Update a payment channel between the two parties for specified token address
     * @param _from     Party A.
     * @param _to       Party B.
     * @param _tracker  Token Tracker address.
     * @param _amount   Token amount.
     */
    function updateChannel(
        address _from,
        address _to,
        address _tracker,
        uint256 _amount,
        uint256 _channelId
    )
    internal 
    {
        require(_amount > 0,         "userData: _channelAmount cannot be 0!");

        if(_channelId > 0) {
            // find the channel and get the receiver address from it.
            address fromParty = channel[_channelId].partyA;
            address toParty = channel[_channelId].partyB;
            // _to = channel[_channelId].partyB;
            if(_from == fromParty) {
                _to = toParty;
            } else {
                _from = toParty;
                _to = fromParty;
            }
        }

        ChannelType ct = getChannelType(_from, _to, _tracker);
        require(ct != ChannelType.NONE,     "Channel does not exist!");

        if(ct == ChannelType.A2B) {
            // from is party A
        } else if(ct == ChannelType.B2A) {
            // from is party B
        }

        // TODO:
        // switch party A / B based on channel direction
        // check supplier balance 
        // get channel id and update it's stats

        // make sure creator has enough available balance for the operation
        uint256 available = getAvailableTokenBalance(_from, _tracker);
        require(available >= _amount, "createChannel: _amount cannot be higher than available balance");


        // TODO: emit event
    }

    /**
     * @notice Get user tokens in contract
     * @param _from     User
     * @param _tracker  Token Tracker address.
     * @return ChannelType The channel type
     */
    function getUserTokensInContract(
        address _from,
        address _tracker
    ) public view returns (uint256 inContract, uint256 committed)
    {
        tokenData storage token = users[_from].tokensByTrackerAddress[_tracker];
        inContract = token.inContract;
        committed = token.committed;
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
     * @notice Find channel id for interaction between msg.sender and _to addresses
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
        uint256 a2b = users[_from].channelByAddress[_tracker][_to];
        uint256 b2a = users[_to].channelByAddress[_tracker][_from];
        if( channel[a2b].id > 0) {
            return a2b;
        } else {
            return b2a;
        }
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
     * @notice Get committed token balance
     * @param _user     User address.
     * @param _tracker  Token Tracker address.
     */
    function getCommittedTokenBalance(
        address _user,
        address _tracker
    )
    public view returns (uint256) 
    {
        return users[_user].tokensByTrackerAddress[_tracker].committed;
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

        address _tracker = msg.sender;

        User storage user = users[_from];
        if(user.userId == 0) {
            // new user in the system
            user.userId = ++userCount;
            userById[user.userId] = _from;
        }

        // create a token balance for user
        tokenData storage tokenBalance = user.tokensByTrackerAddress[_tracker];
        if(tokenBalance.id == 0) {
            tokenBalance.id = ++user.balanceCount;
            // save balance id to address mapping
            user.tokensById[tokenBalance.id] = _tracker;
        }
        
        user.tokensByTrackerAddress[_tracker].inContract = user.tokensByTrackerAddress[_tracker].inContract.add(_amount);

        ( uint8 _typeId, uint256 _channelAmount, uint256 _channelId, address _toAddress ) = parseUserData(_userData);
        
        if(_typeId == 1) {
            createChannel(_from, _toAddress, _tracker, _channelAmount);
        } else if(_typeId == 2) {
            require(_channelId > 0,      "userData: _channelId cannot be 0!");
            updateChannel(_from, _toAddress, _tracker, _channelAmount, _channelId);
        }
        
        // TODO: emit receive event
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

    /**
     * @notice Settle a channel
     * @param _userData   User Data
     * @param _userData   User Data Hash
     * @param _signatureA  Signed Hash by party A
     * @param _signatureB  Signed Hash by party B
     */
    function onChainSettle(
        bytes calldata _userData,
        bytes32 _hash,
        bytes calldata _signatureA,
        bytes calldata _signatureB
    )
    external returns (address) 
    {
        
        ( uint8 _channelId, uint256 _round, uint256 _balanceA, uint256 _balanceB ) = parseSettlementData(_userData);
        require(_channelId > 0,                  "onChainSettle: requested _channelId cannot be 0");

        // load the channel, find the sender party
        Channel storage existingChannel = channel[_channelId];
        require(existingChannel.id > 0,          "onChainSettle: contract channel.id cannot be 0");

        require(existingChannel.round <= _round, "onChainSettle: _round cannot be lower than current");

        // validate signatures 
        address partyA = _hash.toEthSignedMessageHash().recover(_signatureA);
        address partyB = _hash.toEthSignedMessageHash().recover(_signatureB);

        require(partyA == existingChannel.partyA, "onChainSettle: partyA address does not match");
        require(partyB == existingChannel.partyB, "onChainSettle: partyB address does not match");

        // validate against max balance amounts
        uint256 totalBefore = existingChannel.balanceA.add(existingChannel.balanceB);
        uint256 totalInRequest = _balanceA.add(_balanceB);
        require(totalBefore == totalInRequest,    "onChainSettle: existing balance does not match request balances");

        // by totaling up both balances, we make sure our users cannot allocate more than they own.
        // so we don't actually need to check if they had enough before the operation

        // update balances
        uint256 balanceADifference = 0;
        uint256 balanceBDifference = 0;

        if(existingChannel.balanceA > _balanceA) {
            // A sent B some tokens
            balanceADifference = existingChannel.balanceA.sub(_balanceA);
            balanceBDifference = _balanceB.sub(existingChannel.balanceB);
    
            // update commited balances
            users[partyA].tokensByTrackerAddress[existingChannel.tracker].committed = 
                users[partyA].tokensByTrackerAddress[existingChannel.tracker].committed.sub(balanceADifference);
            users[partyA].tokensByTrackerAddress[existingChannel.tracker].inContract = 
                users[partyA].tokensByTrackerAddress[existingChannel.tracker].inContract.sub(balanceADifference);

            users[partyB].tokensByTrackerAddress[existingChannel.tracker].committed = 
                users[partyB].tokensByTrackerAddress[existingChannel.tracker].committed.add(balanceBDifference);
            users[partyB].tokensByTrackerAddress[existingChannel.tracker].inContract =
                users[partyB].tokensByTrackerAddress[existingChannel.tracker].inContract.add(balanceBDifference);

        } else {
            // B sent A some tokens
            balanceADifference = _balanceA.sub(existingChannel.balanceA);
            balanceBDifference = existingChannel.balanceB.add(_balanceB);

            // update commited balances
            users[partyA].tokensByTrackerAddress[existingChannel.tracker].committed = 
                users[partyA].tokensByTrackerAddress[existingChannel.tracker].committed.add(balanceADifference);
            users[partyA].tokensByTrackerAddress[existingChannel.tracker].inContract = 
                users[partyA].tokensByTrackerAddress[existingChannel.tracker].inContract.add(balanceADifference);
            
            users[partyB].tokensByTrackerAddress[existingChannel.tracker].committed = 
                users[partyB].tokensByTrackerAddress[existingChannel.tracker].committed.sub(balanceBDifference);
            users[partyB].tokensByTrackerAddress[existingChannel.tracker].inContract = 
                users[partyB].tokensByTrackerAddress[existingChannel.tracker].inContract.sub(balanceBDifference);
        }

        require(balanceADifference == balanceBDifference, "onChainSettle: balance differences do not match");
        
        existingChannel.balanceA = _balanceA;
        existingChannel.balanceB = _balanceB;

        // increment round!
        existingChannel.round++;

        // TODO: emit event.
    }


    /**
     * @notice Parse Settlement userData
     * @param _userData User data.
     */
    function parseSettlementData(
        bytes memory _userData
    )
    public pure returns ( uint8 _channelId, uint256 _round, uint256 _balanceA, uint256 _balanceB )
    {
        assembly {
            // move by 32 bytes since input is a variable 
            let ptr := add( _userData, 32 )

            _channelId := mload( ptr ) 
            ptr := add(ptr, 32)

            _round := mload( ptr ) 
            ptr := add(ptr, 32)

            _balanceA := mload( ptr ) 
            ptr := add(ptr, 32)
            
            _balanceB := mload( ptr ) 
            ptr := add(ptr, 32)

        }
    }


    /// @notice converts number to string
    /// @dev source: https://github.com/provable-things/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L1045
    /// @param _i integer to convert
    /// @return _uintAsString
    function uintToStr(uint _i) internal pure returns (string memory _uintAsString) {
        uint number = _i;
        if (number == 0) {
            return "0";
        }
        uint j = number;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (number != 0) {
            bstr[k--] = byte(uint8(48 + number % 10));
            number /= 10;
        }
        return string(bstr);
    }

    function addressToString(address _pool) public pure returns (string memory _uintAsString) {
        uint _i = uint256(_pool);
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len - 1;
        while (_i != 0) {
            bstr[k--] = byte(uint8(48 + _i % 10));
            _i /= 10;
        }
        return string(bstr);
    }

}