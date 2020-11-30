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

describe("ERC777 - TestERC777 Token", async function () {
    
    before(async function () {
        requiresERC1820Instance();
        await restoreFromSnapshot("ERC1820_ready");
    });

    describe("Deployment", async function () {
        before(async function () {
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
                this.TestERC777Token.receipt.gasUsed
            );
            console.log(
                "      Contract Address:",
                this.TestERC777Token.receipt.contractAddress
            );
            console.log("");

            helpers.addresses.Token = this.TestERC777Token.receipt.contractAddress;
        });

        it("Gas usage should be lower than 6.7m.", function () {
            expect(this.TestERC777Token.receipt.gasUsed).to.be.below(6500000);
        });

        describe("basic information", function () {
            it("returns the name", async function () {
                expect(await this.TestERC777Token.methods.name().call()).to.equal(
                    setup.settings.token.name
                );
            });

            it("returns the symbol", async function () {
                expect(await this.TestERC777Token.methods.symbol().call()).to.equal(
                    setup.settings.token.symbol
                );
            });

            it("returns a granularity of 1", async function () {
                expect(await this.TestERC777Token.methods.granularity().call()).to.be.equal(
                    "1"
                );
            });

            it("returns the default operators", async function () {
                expect(
                    await this.TestERC777Token.methods.defaultOperators().call()
                ).to.deep.equal(defaultOperators);
            });

            it("default operators are operators for all accounts", async function () {
                for (const operator of defaultOperators) {
                    expect(
                        await this.TestERC777Token.methods.isOperatorFor(operator, anyone).call()
                    ).to.equal(true);
                }
            });

            it("returns the total supply", async function () {
                expect(await this.TestERC777Token.methods.totalSupply().call()).to.be.equal(
                    setup.settings.token.supply.toString()
                );
            });

            it("returns 18 when decimals is called", async function () {
                expect(await this.TestERC777Token.methods.decimals().call()).to.be.equal(
                    "18"
                );
            });

            it("the ERC777Token interface is registered in the registry", async function () {
                expect(
                    await helpers.ERC1820.instance.methods
                        .getInterfaceImplementer(
                            helpers.addresses.Token,
                            web3.utils.soliditySha3("ERC777Token")
                        )
                        .call()
                ).to.equal(helpers.addresses.Token);
            });

            it("the ERC20Token interface is registered in the registry", async function () {
                expect(
                    await helpers.ERC1820.instance.methods
                        .getInterfaceImplementer(
                            helpers.addresses.Token,
                            web3.utils.soliditySha3("ERC20Token")
                        )
                        .call()
                ).to.equal(helpers.addresses.Token);
            });
        });


        describe("balanceOf", function () {
            context("for an account with no tokens", function () {
                it("returns zero", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(anyone).call()
                    ).to.be.equal("0");
                });
            });

            context("for an account with tokens", function () {
                it("returns their balance", async function () {
                    expect(
                        await this.TestERC777Token.methods.balanceOf(deployer).call()
                    ).to.be.equal(setup.settings.token.supply.toString());
                });
            });
        }); //describe


        describe("Transfers to contracts and addresses", () => {
            const ERC777data = web3.utils.sha3('777TestData');
            let EmptyReceiver;
            before( async () => {
                EmptyReceiver = await helpers.utils.deployNewContractInstance(
                    helpers,
                    "EmptyReceiver",
                    {
                        from: deployer,
                        gas: 6500000,
                        gasPrice: helpers.solidity.gwei * 10
                    }
                );
            })

            describe("receiver is a contract that does not implement ERC777TokensRecipient", async () => {
                it("ERC777 - send() reverts \"token recipient contract has no implementer for ERC777TokensRecipient\"", async function(){
                    await helpers.assertInvalidOpcode(async () => {
                        await this.TestERC777Token.methods
                            .send(EmptyReceiver.receipt.contractAddress, 1, ERC777data)
                            .send({ from: deployer, gas: 200000 });
                    }, "ERC777: token recipient contract has no implementer for ERC777TokensRecipient");
                });

                it("ERC20 - transfer() works ", async function(){
                    await this.TestERC777Token.methods
                    .transfer(EmptyReceiver.receipt.contractAddress, 1)
                    .send({ from: deployer, gas: 200000 });
                });
            });

            describe("receiver is an address", async () => {
                it("ERC777 - send() works", async function(){
                    await this.TestERC777Token.methods
                        .send(accounts[5], 1, ERC777data)
                        .send({ from: deployer, gas: 200000 });
                });

                it("ERC20 - transfer() works", async function(){
                    await this.TestERC777Token.methods
                    .transfer(accounts[5], 1)
                    .send({ from: deployer, gas: 200000 });
                });
            });
        });


        describe("Token _burn()", async () => {
            const ERC777data = web3.utils.sha3('777TestData');

            let amount = new BN("10000");

            it("works if amount is lower or equal to balance", async function() {

                await this.TestERC777Token.methods
                    .transfer(accounts[3], amount.toString())
                    .send({ from: deployer, gas: 200000 });

                await this.TestERC777Token.methods
                    .burn(1, ERC777data)
                    .send({ from: accounts[3], gas: 200000 });
            });

            it("throws if amount is higher than balance", async function() {
                await helpers.assertInvalidOpcode(async () => {
                    await this.TestERC777Token.methods
                        .burn(amount.add( new BN(1)).toString(), ERC777data)
                        .send({ from: accounts[3], gas: 200000 });
                }, "SafeMath: subtraction overflow");

            });
        });
    });
});
