/**
 * Web stub for react-native-iap.
 *
 * Why: react-native-iap v14 pulls in react-native-nitro-modules, which
 * deep-imports `react-native/Libraries/...`. Those paths have no .web
 * variants, so Metro fails to bundle them for web and `expo export
 * --platform web` dies inside node_modules (BaseViewConfig unresolvable).
 *
 * The app never touches IAP on web — services/premium.ts early-returns for
 * Platform.OS === 'web' before calling any of these — so this stub only has
 * to exist for Metro and throw loudly if something ever calls into it.
 * Wired per-platform via metro.config.js resolveRequest (Android unaffected).
 */

const WEB_IAP_NOT_AVAILABLE =
    '[IAP] react-native-iap is not available on web (stubbed in metro.config.js).';

export async function initConnection() {
    throw new Error(WEB_IAP_NOT_AVAILABLE);
}
export async function endConnection() {}
export async function fetchProducts() {
    throw new Error(WEB_IAP_NOT_AVAILABLE);
}
export async function requestPurchase() {
    throw new Error(WEB_IAP_NOT_AVAILABLE);
}
export async function finishTransaction() {
    throw new Error(WEB_IAP_NOT_AVAILABLE);
}
export async function getAvailablePurchases() {
    return [];
}
export function purchaseUpdatedListener() {
    return { remove() {} };
}
export function purchaseErrorListener() {
    return { remove() {} };
}

export const withIapContext = (Component) => Component;
export default {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    purchaseUpdatedListener,
    purchaseErrorListener,
};
