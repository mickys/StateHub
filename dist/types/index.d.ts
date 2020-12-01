import statehub from "./statehub/core";
import ByteArray from "./utils/ByteArray";
declare global {
    interface Window {
        statehub: any;
    }
}
export { statehub, ByteArray, };
