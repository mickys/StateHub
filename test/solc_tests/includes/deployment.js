
const setup = require('./setup');

function requiresERC1820Instance() {
    // test requires ERC1820.instance
    if (helpers.ERC1820.instance == false) {
        console.log(helpers.utils.colors.red, "  Error: ERC1820.instance not found, please make sure to run it first.", helpers.utils.colors.none);
        process.exit();
    }
}

async function deployContract(name, args = {}) {
    
    const contractInstance = await helpers.utils.deployNewContractInstance(
        helpers, name, args
    );

    console.log("      Contract deployed:  ", name);
    console.log("        Gas used:         ", contractInstance.receipt.gasUsed);
    console.log("        Contract Address: ", contractInstance.receipt.contractAddress);
    
    return {
        instance: contractInstance,
        receipt: contractInstance.receipt,
        address: contractInstance.receipt.contractAddress
    }
}

async function deployTokenContract() {
   return await deployContract(
       "TestERC777Token",
       {
            from: holder,
            arguments: [
                setup.settings.token.name,
                setup.settings.token.symbol,
                setup.settings.token.supply,
                defaultOperators = [], // accounts[0] maybe
            ],
            gas: 6500000,
            gasPrice: helpers.solidity.gwei * 10
        }
    );
}

async function deployStateHubContract() {
    return await deployContract("StateHubMock");
}

async function doFreshDeployment(testKey, phase = 0, settings = null ) {

    requiresERC1820Instance();
    const snapShotKey = testKey+"_Phase_"+phase;

    // TestRPC EVM Snapshots allow us to save and restore snapshots at any block
    // we use them to speed up the test runner.

    if (typeof snapshots[snapShotKey] !== "undefined" && snapshotsEnabled) {
        await restoreFromSnapshot(snapShotKey);
    } else {

        if (snapshotsEnabled) {
            if( snapShotKey in dropped ) {
                console.log(helpers.utils.colors.purple, "    * EVM snapshot key ["+snapShotKey+"] was previously used, you may want restore to it instead of a previous one.", helpers.utils.colors.none);
            }
            console.log(helpers.utils.colors.light_blue, "    * EVM snapshot["+snapShotKey+"] start", helpers.utils.colors.none);
        }

        const TokenContract = await deployTokenContract();
        TokenContractInstance = TokenContract.instance;
        TokenContractAddress = TokenContract.address;
        TokenContractReceipt = TokenContract.receipt;

        const StateHubContract = await deployStateHubContract();
        StateHubInstance = StateHubContract.instance;
        StateHubAddress = StateHubContract.address;
        StateHubReceipt = StateHubContract.receipt;

        // init settings / extra deployemnt initialisation goes here

        // create snapshot
        if (snapshotsEnabled) {
            await saveSnapshot(snapShotKey);
        }
    }

    // reinitialize instances so revert works properly.
    TokenContractInstance = await helpers.utils.getContractInstance(helpers, "TestERC777Token", TokenContractAddress);
    TokenContractInstance.receipt = TokenContractReceipt;
    StateHubInstance = await helpers.utils.getContractInstance(helpers, "StateHubMock", StateHubAddress);
    StateHubInstance.receipt = StateHubReceipt;
    
    // do some validation
    expect(
        await helpers.utils.getBalance(helpers, StateHubAddress)
    ).to.be.bignumber.equal( new BN(0) );

    let expectedTokenSupply = "0";
    if(phase >= 2 ) {
        expectedTokenSupply = setup.settings.token.sale.toString();
    }

    expect(await TokenContractInstance.methods.balanceOf(StateHubAddress).call()).to.be.equal(expectedTokenSupply);
    expect(
        await StateHubInstance.methods.tokenSupply().call()
    ).to.be.equal(
        await TokenContractInstance.methods.balanceOf(StateHubAddress).call()
    );

    return {
        TokenContractInstance: TokenContractInstance,
        StateHubInstance: StateHubInstance,
    }
};

async function saveSnapshot(_key, log = true) {
    snapshots[_key] = await helpers.web3.evm.snapshot();
    if(log) {
        console.log(helpers.utils.colors.light_blue, "    * EVM snapshot["+_key+"] saved", helpers.utils.colors.none);
    }
}

async function restoreFromSnapshot(_key, log = true) {
    if(_key == "") {
        throw "Restore key cannot be null";
    }

    // restoring from a snapshot purges all later snapshots in testrpc, we do the same
    for (const [key, value] of Object.entries(snapshots)) {
        if(value > snapshots[_key]) {
            dropped[key] = value;
            delete(snapshots[key]);
        }
    }

    if(log) {
        console.log(helpers.utils.colors.light_cyan, "    * EVM snapshot["+_key+"] restored", helpers.utils.colors.none);
    }
    // restore snapshot
    await helpers.web3.evm.revert(snapshots[_key]);
    // save again because whomever wrote test rpc had the impression no one would ever restore twice.. WHY?!
    // @TODO: not having to do this would speed up testing.. so a PR for this to ganache would be nice.
    snapshots[_key] = await helpers.web3.evm.snapshot();
    // reset account nonces..
    helpers.utils.resetAccountNonceCache(helpers);
}

module.exports = {
    requiresERC1820Instance,
    doFreshDeployment,
    saveSnapshot,
    restoreFromSnapshot
};