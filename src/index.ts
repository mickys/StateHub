/*
 * source       https://github.com/mickys/statehub/
 * @name        StateHub - State Channels
 * @package     statehub
 * @author      Micky Socaci <micky@nowlive.ro>
 * @license     MIT
 */

import statehub from "./statehub/core";
import ByteArray from "./utils/ByteArray";

declare global {
    interface Window { statehub: any; }
}

if (typeof window !== 'undefined') {
    window.statehub = window.statehub || {};
    window.statehub.statehub = statehub;
    window.statehub.ByteArray = ByteArray;
}

export {
    statehub,
    ByteArray,
};
