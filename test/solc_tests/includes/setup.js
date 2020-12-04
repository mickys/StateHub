global.helpers = setup.helpers;
global.BN = helpers.BN;
global.MAX_UINT256 = helpers.MAX_UINT256;
global.expect = helpers.expect

global.deployingAddress = accounts[0];
global.whitelistingAddress = accounts[1];

global.holder = accounts[10];
global.projectAddress = holder;

global.participant_1 = accounts[4];
global.participant_2 = accounts[5];
global.participant_3 = accounts[6];
global.participant_4 = accounts[7];
global.participant_5 = accounts[8];
global.participant_6 = accounts[9];


global.ApplicationEventTypes = {
    NOT_SET:0,          // will match default value of a mapping result
    CONTRIBUTION_ADDED:1,
    CONTRIBUTION_CANCELED:2,
    CONTRIBUTION_ACCEPTED:3,
    WHITELIST_APPROVED:4,
    WHITELIST_REJECTED:5,
    PROJECT_WITHDRAWN:6
}

global.ChannelType = {
    NONE    : 0,
    A2B     : 1,
    B2A     : 2
}

global.ChannelStateTypes = {
    NOT_SET : 0,
    OPEN    : 1,
    CLOSING : 2,
    CLOSED  : 3,
}


global.snapshotsEnabled = true;
global.snapshots = {};
global.dropped = {};

const _ = require('lodash');
function clone(_what) {
    return _.cloneDeep(_what);
}

module.exports = {
    clone
};
