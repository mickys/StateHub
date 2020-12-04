/// <reference types="node" />
import ByteArray from "../utils/ByteArray";
import bignumber from "bignumber.js";
interface channelCommand {
    type: number;
    dataLength: number;
    resultId: number;
    offset: number;
    toAddress: Buffer;
}
export default class statehub {
    version: number;
    binary: any;
    private channels;
    constructor();
    toEthSignedMessageHash(messageHex: any): string;
    sign(messageHex: any, privateKey: any, web3: any): Promise<any>;
    getSpendReceipt(channelId: bignumber, round: bignumber, balanceA: bignumber, balanceB: bignumber, privateKey: string, web3: any): Promise<{
        data: string;
        hash: string;
        signed: any;
        signature: any;
    }>;
    getSpendString(channelId: bignumber, round: bignumber, balanceA: bignumber, balanceB: bignumber): string;
    getBinaryChannelCreationString(channelId: bignumber, amount: bignumber, toAddress?: string): string;
    BNtoHex(_bn: bignumber): string;
    createChannelDeposit(channelId: number, amount: number): void;
    /**
     * Get payload
     *
     * @returns {ByteArray}
     */
    getPayload(): string;
    /**
     * create binary call byte array
     *
     * @param packet - {@link (packetFormat:interface)}
     * @param callData - Buffer containing method sha and hex encoded parameter values
     * @returns {ByteArray}
     */
    createBinaryChannelInfoByteArray(packet: channelCommand, callData: Buffer): ByteArray;
    /**
     * Concatenate all binary calls we have into one large hex string
     * @param data - the string containing all the channels we want to create / update
     * @returns string
     */
    addHeader(data: string): string;
    /**
     * Remove 0x from string then return it
     * @param string
     * @returns string
     */
    removeZeroX(string: string): string;
    /**
     * Convert string to Buffer
     * @param string
     * @returns {Buffer}
     */
    toBuffer(string: any): Buffer;
}
export {};
