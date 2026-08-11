import { Platform } from 'react-native';
import {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    purchaseUpdatedListener,
    purchaseErrorListener,
    type Purchase,
    type Product,
    type EventSubscription,
} from 'react-native-iap';
import { supabase } from './supabase';

/**
 * Freemium purchase wrapper around react-native-iap (v14, Nitro).
 *
 * Flow: initPremium() once (connection + global listeners) -> fetch real
 * product prices -> requestPurchase(sku) -> the global purchaseUpdatedListener
 * resolves a per-sku pending promise -> set_premium RPC extends the user's
 * entitlement server-side (stacking renewals) -> finishTransaction()
 * acknowledges the purchase so Google stops re-delivering it.
 *
 * Entitlement lives on profiles.premium_until (server-authoritative). The
 * purchase token is passed to set_premium but deliberately NOT persisted yet;
 * server-side receipt verification is a later hardening step.
 */

export const PREMIUM_PRODUCT_IDS = [
    'doitmate_premium_monthly',
    'doitmate_premium_yearly',
] as const;

export type PremiumPeriod = 'monthly' | 'yearly';

export interface PremiumProduct {
    sku: string;
    period: PremiumPeriod;
    /** Locale-formatted price, e.g. "€4.99" */
    price: string;
    /** Numeric price (may be null on some platforms) */
    priceValue: number | null;
    title: string;
    description: string;
}

interface PendingPurchase {
    sku: string;
    resolve: (purchase: Purchase) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

const PURCHASE_TIMEOUT_MS = 60_000;

let initPromise: Promise<void> | null = null;
let purchaseSubscription: EventSubscription | null = null;
let errorSubscription: EventSubscription | null = null;
let pendingPurchase: PendingPurchase | null = null;

/** Map a react-native-iap product to our display shape. */
function toPremiumProduct(product: Product): PremiumProduct {
    const sku = product.id;
    const period: PremiumPeriod = sku === 'doitmate_premium_yearly' ? 'yearly' : 'monthly';
    return {
        sku,
        period,
        price: product.displayPrice || (product.price != null ? `${product.currency} ${product.price}` : ''),
        priceValue: product.price ?? null,
        title: product.title || (period === 'yearly' ? 'Yearly' : 'Monthly'),
        description: product.description || '',
    };
}

function readableError(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes('cancelled') || lower.includes('canceled') || lower.includes('user cancel')) {
        return 'Purchase cancelled.';
    }
    if (lower.includes('unavailable') || lower.includes('store not available')) {
        return 'Store unavailable. Check your Play Store connection and try again.';
    }
    if (lower.includes('already owned') || lower.includes('duplicate')) {
        return 'You already own this subscription. Use Restore Purchases to sync it.';
    }
    if (lower.includes('not authenticated')) {
        return 'Please sign in before upgrading.';
    }
    return raw || 'Purchase failed. Please try again.';
}

/**
 * A premium purchase that still needs entitlement delivery. On Android this
 * means NOT yet acknowledged: getAvailablePurchases returns ACTIVE
 * subscriptions even after acknowledgment, so without this guard every app
 * launch (and every restore) would stack another month/year on top.
 */
function needsEntitlement(purchase: Purchase): boolean {
    if (purchase.purchaseState !== 'purchased') return false;
    if (!PREMIUM_PRODUCT_IDS.includes(purchase.productId as (typeof PREMIUM_PRODUCT_IDS)[number])) return false;
    if (Platform.OS === 'android' && 'isAcknowledgedAndroid' in purchase && purchase.isAcknowledgedAndroid === true) return false;
    return true;
}

/** Grant entitlement server-side. Throws a readable error on failure. */
async function grantEntitlement(sku: string, purchaseToken: string): Promise<void> {
    const { data, error } = await supabase.rpc('set_premium', {
        p_product_id: sku,
        p_purchase_token: purchaseToken,
    });

    if (error) throw error;
    if (!data || data.success !== true) {
        throw new Error((data as { error?: string } | null)?.error || 'Could not activate Premium');
    }
}

/** Acknowledge/close a purchase so the store stops re-delivering it. */
async function closePurchase(purchase: Purchase): Promise<void> {
    try {
        await finishTransaction({ purchase, isConsumable: false });
    } catch (err) {
        // Finishing is best-effort — the entitlement is already granted. An
        // unacknowledged purchase will be re-delivered by getAvailablePurchases
        // on next launch and re-synced, so this is safe to swallow.
        console.warn('[Premium] finishTransaction failed (will re-sync later):', err);
    }
}

/**
 * Deliver entitlement for a completed premium purchase (the shared handler
 * for both the live purchase flow and the previous-session sync path).
 */
async function deliverEntitlement(purchase: Purchase): Promise<void> {
    const sku = purchase.productId;
    if (!PREMIUM_PRODUCT_IDS.includes(sku as (typeof PREMIUM_PRODUCT_IDS)[number])) return;

    // Android: purchaseToken is the Play token. iOS: it's the StoreKit JWS —
    // still passed through so the RPC signature is exercised identically.
    const token = purchase.purchaseToken || purchase.transactionId || '';
    await grantEntitlement(sku, token);
    await closePurchase(purchase);
}

/**
 * Initialize the IAP connection + register the GLOBAL purchase listeners.
 * Safe to call repeatedly — connection and listeners are created once.
 */
export async function initPremium(): Promise<void> {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        await initConnection();

        if (!purchaseSubscription) {
            purchaseSubscription = purchaseUpdatedListener(async (purchase) => {
                // Handle ANY premium purchase that arrives: resolves the
                // pending paywall flow, and also catches purchases that were
                // started in a previous session and finished on the store
                // while the app was closed.
                if (purchase.purchaseState !== 'purchased') return;

                if (pendingPurchase && purchase.productId === pendingPurchase.sku) {
                    const pending = pendingPurchase;
                    pendingPurchase = null;
                    clearTimeout(pending.timer);
                    pending.resolve(purchase);
                    return;
                }

                if (PREMIUM_PRODUCT_IDS.includes(purchase.productId as (typeof PREMIUM_PRODUCT_IDS)[number])) {
                    deliverEntitlement(purchase).catch((err) => {
                        console.warn('[Premium] Failed to deliver entitlement for pending purchase:', err);
                    });
                }
            });
        }

        if (!errorSubscription) {
            errorSubscription = purchaseErrorListener((error) => {
                if (pendingPurchase) {
                    const pending = pendingPurchase;
                    pendingPurchase = null;
                    clearTimeout(pending.timer);
                    pending.reject(new Error(error?.message || 'Purchase failed'));
                }
            });
        }

        // Sync entitlements from a previous session: any unacknowledged
        // premium purchase (e.g. the app crashed between store payment and
        // finishTransaction) is granted now, then acknowledged.
        try {
            const purchases = await getAvailablePurchases();
            for (const purchase of purchases) {
                if (needsEntitlement(purchase)) {
                    deliverEntitlement(purchase).catch((err) => {
                        console.warn('[Premium] Failed to sync previous-session purchase:', err);
                    });
                }
            }
        } catch (err) {
            console.warn('[Premium] getAvailablePurchases sync failed:', err);
        }
    })();

    return initPromise;
}

/** Fetch the two premium subscriptions with their REAL store prices. */
export async function getPremiumProducts(): Promise<PremiumProduct[]> {
    await initPremium();

    // fetchProducts can return platform-specific subscription types; every
    // variant carries the ProductCommon fields we read, so narrow to Product.
    const products = (await fetchProducts({
        skus: [...PREMIUM_PRODUCT_IDS],
        type: 'subs',
    })) as Product[] | null;

    const mapped = (products || [])
        .filter((p) => PREMIUM_PRODUCT_IDS.includes(p.id as (typeof PREMIUM_PRODUCT_IDS)[number]))
        .map(toPremiumProduct);

    // Stable order: monthly first, yearly second.
    return mapped.sort((a, b) => (a.period === b.period ? 0 : a.period === 'monthly' ? -1 : 1));
}

/**
 * Purchase a premium subscription. Resolves once the entitlement has been
 * granted server-side AND the transaction finished. Throws a readable error.
 */
export async function purchasePremium(sku: string): Promise<void> {
    await initPremium();

    if (pendingPurchase) {
        throw new Error('A purchase is already in progress.');
    }

    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            if (pendingPurchase) {
                pendingPurchase = null;
                reject(new Error('Purchase timed out. Please try again.'));
            }
        }, PURCHASE_TIMEOUT_MS);

        pendingPurchase = {
            sku,
            resolve: (purchase) => {
                deliverEntitlement(purchase)
                    .then(() => resolve())
                    .catch(reject);
            },
            reject,
            timer,
        };

        const request =
            Platform.OS === 'ios'
                ? { apple: { sku } }
                : { google: { skus: [sku] } };

        requestPurchase({ request, type: 'subs' }).catch((error: unknown) => {
            if (pendingPurchase) {
                const pending = pendingPurchase;
                pendingPurchase = null;
                clearTimeout(pending.timer);
                pending.reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }).catch((error: unknown) => {
        throw new Error(readableError(error));
    });
}

/**
 * Restore purchases: re-grant entitlement for every active premium
 * subscription found on the store account, then acknowledge it.
 * Returns the number of entitlements restored.
 */
export async function restorePremium(): Promise<number> {
    await initPremium();

    const purchases = await getAvailablePurchases();
    const premiumPurchases = (purchases || []).filter(needsEntitlement);

    for (const purchase of premiumPurchases) {
        await deliverEntitlement(purchase);
    }

    return premiumPurchases.length;
}

/** Tear down the connection (sign-out / app shutdown). Best-effort. */
export async function endPremium(): Promise<void> {
    try {
        purchaseSubscription?.remove();
        errorSubscription?.remove();
    } finally {
        purchaseSubscription = null;
        errorSubscription = null;
        pendingPurchase = null;
        initPromise = null;
        try {
            await endConnection();
        } catch {
            // Ignore — connection may already be closed.
        }
    }
}
