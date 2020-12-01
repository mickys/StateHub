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
    saveSnapshot,
    requiresERC1820Instance,
    restoreFromSnapshot
} = require('./includes/deployment');

describe("StateHub - State Channels", async function () {
    before(async function () {
        requiresERC1820Instance();
        await restoreFromSnapshot("ERC1820_ready");
    });


    describe("Deployment", async function () {
        before(async function () {

            // deploy our state hub
            this.StateHubMock = await helpers.utils.deployNewContractInstance(
                helpers,
                "StateHubMock",
                {
                    from: deployer,
                    gas: 6500000,
                    gasPrice: helpers.solidity.gwei * 10
                }
            );

            _StateHubAddress = this.StateHubMock.receipt.contractAddress;

            // deploy a test token
            this.TestERC777Token = await helpers.utils.deployNewContractInstance(
                helpers,
                "TestERC777Token",
                {
                    from: deployer,
                    arguments: [
                        setup.settings.token.name,
                        setup.settings.token.symbol,
                        setup.settings.token.supply,
                        defaultOperators
                    ],
                    gas: 6500000,
                    gasPrice: helpers.solidity.gwei * 10
                }
            );

            console.log(
                "      Gas used for deployment:",
                this.StateHubMock.receipt.gasUsed
            );
            console.log(
                "      Contract Address:",
                this.StateHubMock.receipt.contractAddress
            );
            console.log("");

            helpers.addresses.Token = this.TestERC777Token.receipt.contractAddress;
        });

        it("Gas usage should be lower than 6.7m.", function () {
            expect(this.StateHubMock.receipt.gasUsed).to.be.below(6500000);
        });

        describe("Basic information", function () {

            it("the ERC777TokensRecipient interface is registered in the registry", async function () {
                expect(
                    await helpers.ERC1820.instance.methods
                        .getInterfaceImplementer(
                            _StateHubAddress,
                            web3.utils.soliditySha3("ERC777TokensRecipient")
                        )
                        .call()
                ).to.equal(_StateHubAddress);
            });

            it("public variable userCount is 0", async function () {
                expect(await this.StateHubMock.methods.userCount().call()).to.equal("0");
            });

            it("public variable channelCount is 0", async function () {
                expect(await this.StateHubMock.methods.channelCount().call()).to.equal("0");
            });
            
            it("Contract balance is 0", async function () {
                expect(
                    await this.TestERC777Token.methods.balanceOf(_StateHubAddress).call()
                ).to.be.equal("0");
            });
        });

        describe("Helper Methods", function () {

            describe("parseUserData()", function () {

                const channelId = new BN(55);
                const amount = new BN("1234567890123456789");
                const testAddress = "0x58Ec20080706B78657bF684880F3D1899433f760";

                describe("userData contains type 1: amount, party B Address", function () {
                    let result;
                    before(async function () {
                        const statelib = new helpers.statehub();
                        const inputData = statelib.getBinaryChannelCreationString(null, amount, testAddress);
                        const call = await helpers.utils.measureCallExecution( this.StateHubMock.methods.parseUserData(inputData) );
                        result = call.data
                        // console.log("time: ", call.time, "gas: ", call.gas)
                    });
    
                    it("returns correct typeId", async function () {
                        expect(
                            result._typeId
                        ).to.be.equal("1"); // 1 if address is provided
                    });
    
                    it("returns channelID 0x0", async function () {
                        expect(
                            result._channelId
                        ).to.be.equal("0");
                    });
        
                    it("returns provided amount", async function () {
                        expect(
                            result._amount
                        ).to.be.equal(amount.toString());
                    });

                    it("returns provided address", async function () {
                        expect(
                            result._address
                        ).to.be.equal(testAddress.toString());
                    });
                });

                describe("userData contains type 2: amount, channelId", function () {
                    let result;
                    before(async function () {
                        const statelib = new helpers.statehub();
                        const inputData = statelib.getBinaryChannelCreationString(channelId, amount);
                        const call = await helpers.utils.measureCallExecution( this.StateHubMock.methods.parseUserData(inputData) );
                        result = call.data
                        // console.log("time: ", call.time, "gas: ", call.gas)

                    });
    
                    it("returns correct typeId", async function () {
                        expect(
                            result._typeId
                        ).to.be.equal("2"); // 2 if no address is provided
                    });
    
                    it("returns provided channelID", async function () {
                        expect(
                            result._channelId
                        ).to.be.equal(channelId.toString());
                    });
        
                    it("returns provided amount", async function () {
                        expect(
                            result._amount
                        ).to.be.equal(amount.toString());
                    });
    
                    it("returns address 0x0", async function () {
                        expect(
                            result._address
                        ).to.be.equal("0x0000000000000000000000000000000000000000");
                    });

                });
            });
        });


        

        describe("Channel creation", function () {

            const tokenAmount = new BN("100000");

            describe("Fund party A (participant_1) with ERC777 Test Tokens", function () {

                before(async function () {

                    expect(
                        await this.TestERC777Token.methods.balanceOf(participant_1).call()
                    ).to.be.equal("0");

                    // send some tokens to 
                    await this.TestERC777Token.methods
                        .send(participant_1, tokenAmount, web3.utils.toHex(0))
                        .send({ from: deployer, gas: 500000 });

                });

                it("participant_1 balance is 10000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(participant_1).call()
                    ).to.be.equal(tokenAmount.toString());
                });

                
            });

            describe("participant_1 sends 5000 tokens to contract, userData empty", function () {

                before(async function () {

                    await saveSnapshot("Participant_1_Funded");


                    // send some tokens to hub
                    const tx = await this.TestERC777Token.methods
                        .send(_StateHubAddress, new BN("5000"), web3.utils.toHex(""))
                        .send({ from: participant_1, gas: 500000 });

                    console.log("gas:", tx.gasUsed);
                });

                it("participant_1 balance is now 95000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(participant_1).call()
                    ).to.be.equal(new BN("95000").toString());
                });

                it("Contract balance is now 5000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(_StateHubAddress).call()
                    ).to.be.equal(new BN("5000").toString());
                });

            });

            describe("participant_1 sends 5000 tokens to contract, userData (type 1: amount, party B Address)", function () {

                before(async function () {

                    await restoreFromSnapshot("Participant_1_Funded");

                    const channelId = new BN(0);
                    const amount = new BN("2500");
                    const testAddress = participant_2;

                    const statelib = new helpers.statehub();
                    const userData = statelib.getBinaryChannelCreationString( channelId, amount, testAddress);

                    // send some tokens to hub
                    const tx = await this.TestERC777Token.methods
                        .send(_StateHubAddress, new BN("5000"), userData)
                        .send({ from: participant_1, gas: 500000 });

                    console.log("gas:", tx.gasUsed);
                });

                it("participant_1 balance is now 95000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(participant_1).call()
                    ).to.be.equal(new BN("95000").toString());
                });

                it("Contract balance is now 5000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(_StateHubAddress).call()
                    ).to.be.equal(new BN("5000").toString());
                });

            });

            describe("participant_1 sends 5000 tokens to contract, userData (type 2: amount, channelId)", function () {

                before(async function () {

                    await restoreFromSnapshot("Participant_1_Funded");

                    const channelId = new BN(5);
                    const amount = new BN("2500");
                    const testAddress = participant_2;

                    const statelib = new helpers.statehub();
                    const userData = statelib.getBinaryChannelCreationString( channelId, amount);

                    // send some tokens to hub
                    const tx = await this.TestERC777Token.methods
                        .send(_StateHubAddress, new BN("5000"), userData)
                        .send({ from: participant_1, gas: 500000 });

                    console.log("gas:", tx.gasUsed);
                });

                it("participant_1 balance is now 95000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(participant_1).call()
                    ).to.be.equal(new BN("95000").toString());
                });

                it("Contract balance is now 5000", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(_StateHubAddress).call()
                    ).to.be.equal(new BN("5000").toString());
                });

            });

            // it("userCount is 0", async function () {
            //     expect(await this.StateHubMock.methods.userCount().call()).to.equal("0");
            // });

            // it("channelCount is 0", async function () {
            //     expect(await this.StateHubMock.methods.channelCount().call()).to.equal("0");
            // });
            
        });

    });

});
