"use strict";
/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
    statehub.prototype.toEthSignedMessageHash = function (messageHex) {
        var messageBuffer = Buffer.from(messageHex.substring(2), 'hex');
        var prefix = Buffer.from("\u0019Ethereum Signed Message:\n" + messageBuffer.length);
        return web3_utils_1.default.sha3(Buffer.concat([prefix, messageBuffer]).toString("hex"));
    };
    statehub.prototype.sign = function (messageHex, privateKey, web3) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, web3.eth.accounts.sign(messageHex, privateKey)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    statehub.prototype.getSpendReceipt = function (channelId, round, balanceA, balanceB, privateKey, web3) {
        return __awaiter(this, void 0, void 0, function () {
            var data, hash, signature;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        data = this.getSpendString(channelId, round, balanceA, balanceB);
                        hash = this.toEthSignedMessageHash(data);
                        return [4 /*yield*/, this.sign(hash, privateKey, web3)];
                    case 1:
                        signature = _a.sent();
                        return [2 /*return*/, {
                                data: data,
                                hash: hash,
                                signed: signature.signature,
                                signature: signature,
                            }];
                }
            });
        });
    };
    statehub.prototype.getSpendString = function (channelId, round, balanceA, balanceB) {
        var output = "0x";
        output += this.BNtoHex(channelId);
        output += this.BNtoHex(round);
        output += this.BNtoHex(balanceA);
        output += this.BNtoHex(balanceB);
        return output;
    };
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