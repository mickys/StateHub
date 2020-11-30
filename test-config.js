const {BN} = require("@openzeppelin/test-helpers");

const tokenDecimals = 18;
const ether = 1000000000000000000;      // 1 ether in wei
const etherBN = new BN(ether.toString());

module.exports = {
    settings: {
        token: {
            name: "Test Token",
            symbol: "Test",
            decimals: tokenDecimals,
            supply: new BN(100) // 100 milion
                .mul( new BN("10").pow(new BN("6")) )
                .mul(
                    // 10^18 to account for decimals
                    new BN("10").pow(new BN( tokenDecimals ))
                ),
        }
    }
}