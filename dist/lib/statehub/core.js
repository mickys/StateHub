"use strict";
/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ByteArray_1 = __importDefault(require("../utils/ByteArray"));
var web3_utils_1 = __importDefault(require("web3-utils"));
var statehub = /** @class */ (function () {
    function statehub() {
        this.version = 1;
        this.binary = [];
        this.channels = [];
    }
    statehub.prototype.getBinaryChannelCreationString = function (channelId, amount, toAddress) {
        var output = "0x";
        var type = 2;
        var bytes = new ByteArray_1.default(Buffer.alloc(1));
        if (toAddress) {
            // we have a receiver address
            type = 1;
        }
        bytes.writeByte(type);
        output += bytes.toString("hex");
        output += this.BNtoHex(amount);
        if (toAddress) {
            output += this.removeZeroX(toAddress);
        }
        else {
            output += this.BNtoHex(channelId);
        }
        return output;
    };
    statehub.prototype.BNtoHex = function (_bn) {
        return this.removeZeroX(web3_utils_1.default.toHex(web3_utils_1.default.padLeft(web3_utils_1.default.toHex(_bn.toString()), 64)));
    };
    // TODO: Change amount to bignumber
    statehub.prototype.createChannelDeposit = function (channelId, amount) {
        this.channels.push({ id: channelId, amount: amount });
    };
    /**
     * Get payload
     *
     * @returns {ByteArray}
     */
    statehub.prototype.getPayload = function () {
        var bytes = new ByteArray_1.default(Buffer.alloc(8));
        // 1 byte - uint8 call type ( 1 normal / 2 - to address is result of a previous call )
        bytes.writeByte(1);
        // // 2 bytes - uint16 call_data length
        // bytes.writeUnsignedShort(packet.dataLength);
        // // 2 bytes - uint16 result_id that holds our call's address
        // bytes.writeUnsignedShort(packet.resultId);
        // // 2 bytes - bytes uint16 offset in bytes where the address starts in said result
        // bytes.writeUnsignedShort(packet.offset);
        // // 1 empty byte
        // bytes.writeByte(0);
        // // 20 bytes address / or none if type 2
        // bytes.copyBytes(packet.toAddress, 0);
        // // 4 bytes method sha + dynamic for the rest 0 to any
        // bytes.copyBytes(callData, 0);
        return this.addHeader(bytes.toString("hex"));
    };
    /**
     * create binary call byte array
     *
     * @param packet - {@link (packetFormat:interface)}
     * @param callData - Buffer containing method sha and hex encoded parameter values
     * @returns {ByteArray}
     */
    statehub.prototype.createBinaryChannelInfoByteArray = function (packet, callData) {
        var bytes = new ByteArray_1.default(Buffer.alloc(8));
        // 1 byte - uint8 call type ( 1 normal / 2 - to address is result of a previous call )
        bytes.writeByte(packet.type);
        // 2 bytes - uint16 call_data length
        bytes.writeUnsignedShort(packet.dataLength);
        // 2 bytes - uint16 result_id that holds our call's address
        bytes.writeUnsignedShort(packet.resultId);
        // 2 bytes - bytes uint16 offset in bytes where the address starts in said result
        bytes.writeUnsignedShort(packet.offset);
        // 1 empty byte
        bytes.writeByte(0);
        // 20 bytes address / or none if type 2
        bytes.copyBytes(packet.toAddress, 0);
        // 4 bytes method sha + dynamic for the rest 0 to any
        bytes.copyBytes(callData, 0);
        return bytes;
    };
    /**
     * Concatenate all binary calls we have into one large hex string
     * @param data - the string containing all the channels we want to create / update
     * @returns string
     */
    statehub.prototype.addHeader = function (data) {
        var bytes = new ByteArray_1.default(Buffer.alloc(2 + 2 + 2));
        // add version
        bytes.writeUnsignedShort(this.version);
        // add channels num
        bytes.writeUnsignedShort(this.channels.length);
        // add buffer length
        bytes.writeUnsignedShort(data.length + 6);
        // add 0x start and return
        return bytes.toString("hex") + data;
    };
    /**
     * Remove 0x from string then return it
     * @param string
     * @returns string
     */
    statehub.prototype.removeZeroX = function (string) {
        return string.replace("0x", "");
    };
    /**
     * Convert string to Buffer
     * @param string
     * @returns {Buffer}
     */
    statehub.prototype.toBuffer = function (string) {
        return Buffer.from(string, "hex");
    };
    return statehub;
}());
exports.default = statehub;
;
//# sourceMappingURL=core.js.map