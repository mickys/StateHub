/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */


import ByteArray from "../utils/ByteArray";
import bignumber from "bignumber.js";
import utils from "web3-utils";

interface channelCommand {
    type: number;
    dataLength: number;
    resultId: number;
    offset: number;
    toAddress: Buffer;
}


export default class statehub {

    public version: number = 1;
    public binary: any = [];
    private channels: any = [];
    
    constructor() {}

    public toEthSignedMessageHash (messageHex) {
        const messageBuffer = Buffer.from(messageHex.substring(2), 'hex');
        const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n${messageBuffer.length}`);
        return utils.sha3(Buffer.concat([prefix, messageBuffer]).toString("hex"));
    }

    public async sign (messageHex, privateKey, web3)  {
        return await web3.eth.accounts.sign(messageHex, privateKey);
    }

    public async getSpendReceipt( channelId: bignumber, round: bignumber, balanceA: bignumber, balanceB: bignumber, privateKey:string, web3: any ) {
        const data = this.getSpendString( channelId, round, balanceA, balanceB);
        const hash = this.toEthSignedMessageHash(data);
        const signature = await this.sign(hash, privateKey, web3);
        return {
            data: data,
            hash: hash,
            signed: signature.signature,
            signature: signature,
        }
    }

    public getSpendString( channelId: bignumber, round: bignumber, balanceA: bignumber, balanceB: bignumber ): string {
        let output = "0x";
        output+=this.BNtoHex(channelId);
        output+=this.BNtoHex(round);
        output+=this.BNtoHex(balanceA);
        output+=this.BNtoHex(balanceB);
        return output;
    }

    public getBinaryChannelCreationString( channelId: bignumber, amount: bignumber, toAddress?: string ): string {

        let output = "0x";
        let type: number = 2;
        const bytes: ByteArray = new ByteArray(Buffer.alloc(1));
        if(toAddress) {
            // we have a receiver address
            type = 1;
        }
        bytes.writeByte(type);
        output+=bytes.toString("hex");

        output+=this.BNtoHex(amount);
        if(toAddress) {
            output+=this.removeZeroX(toAddress);
        } else {
            output+=this.BNtoHex(channelId);
        }

        return output;
    }

    public BNtoHex( _bn: bignumber ): string {
        return this.removeZeroX(
            utils.toHex(
                utils.padLeft(
                    utils.toHex(
                        _bn.toString()
                    ),
                64)
            )
        );
    }


    // TODO: Change amount to bignumber
    public createChannelDeposit( channelId: number, amount: number ) {
        this.channels.push({ id: channelId, amount: amount});
    }

    /** 
     * Get payload 
     * 
     * @returns {ByteArray}
     */
    public getPayload(): string {

        const bytes: ByteArray = new ByteArray(Buffer.alloc(8));

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
    }


    /** 
     * create binary call byte array
     * 
     * @param packet - {@link (packetFormat:interface)}
     * @param callData - Buffer containing method sha and hex encoded parameter values
     * @returns {ByteArray}
     */
    public createBinaryChannelInfoByteArray(packet: channelCommand, callData: Buffer): ByteArray {

        const bytes: ByteArray = new ByteArray(Buffer.alloc(8));

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
    }


    /** 
     * Concatenate all binary calls we have into one large hex string
     * @param data - the string containing all the channels we want to create / update
     * @returns string
     */
    public addHeader(data: string): string {

        const bytes = new ByteArray(Buffer.alloc(2 + 2 + 2));
        // add version
        bytes.writeUnsignedShort(this.version);

        // add channels num
        bytes.writeUnsignedShort(this.channels.length);

        // add buffer length
        bytes.writeUnsignedShort(data.length + 6);

        // add 0x start and return
        return bytes.toString("hex") + data;
    }


    /** 
     * Remove 0x from string then return it
     * @param string
     * @returns string
     */
    public removeZeroX(string: string): string {
        return string.replace("0x", "");
    }

    /** 
     * Convert string to Buffer
     * @param string
     * @returns {Buffer}
     */
    public toBuffer(string): Buffer {
        return Buffer.from(string, "hex");
    }

};
