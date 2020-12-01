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
exports.ByteArray = exports.statehub = void 0;
var core_1 = __importDefault(require("./statehub/core"));
exports.statehub = core_1.default;
var ByteArray_1 = __importDefault(require("./utils/ByteArray"));
exports.ByteArray = ByteArray_1.default;
if (typeof window !== 'undefined') {
    window.statehub = window.statehub || {};
    window.statehub.statehub = core_1.default;
    window.statehub.ByteArray = ByteArray_1.default;
}
//# sourceMappingURL=index.js.map