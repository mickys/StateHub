const helpers = setup.helpers;
const BN = helpers.BN;
const MAX_UINT256 = helpers.MAX_UINT256;
const expect = helpers.expect;

const defaultOperators = []; // accounts[0] maybe
const data = web3.utils.sha3("OZ777TestData");
const operatorData = web3.utils.sha3("OZ777TestOperatorData");
const anyone = "0x0000000000000000000000000000000000000001";
const deployer = accounts[10];
const projectAddress = accounts[9];

let _StateHubAddress;

const {
    requiresERC1820Instance,
    restoreFromSnapshot
} = require('./includes/deployment');

describe("StateHub - State Channels", async function () {
    before(async function () {
        requiresERC1820Instance();
        await restoreFromSnapshot("ERC1820_ready");
    });

});
