import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    Animated,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/colors';
import { StyledAlert } from './StyledAlert';
import { safeHaptics } from '../utils/haptics';
import {
    initPremium,
    getPremiumProducts,
    purchasePremium,
    restorePremium,
    PREMIUM_PRODUCT_IDS,
    PremiumProduct,
} from '../services/premium';

interface PaywallModalProps {
    visible: boolean;
    onClose: () => void;
    /** Called after a successful purchase or restore (parent refreshes premium state). */
    onPremiumChanged?: () => void;
}

const BENEFITS: { emoji: string; title: string; subtitle: string }[] = [
    { emoji: '👥', title: 'Unlimited groups', subtitle: 'Create as many accountability pacts as you need' },
    { emoji: '👑', title: 'Premium crown badge', subtitle: 'Stand out on every leaderboard' },
    { emoji: '📊', title: 'Premium stats & insights', subtitle: 'Deeper streaks, trends and progress views' },
    { emoji: '💜', title: 'Support development', subtitle: 'Keep Do It Mate growing and improving' },
];

function formatPrice(product: PremiumProduct | undefined): string {
    if (!product) return '';
    return product.price;
}

export default function PaywallModal({ visible, onClose, onPremiumChanged }: PaywallModalProps) {
    const [products, setProducts] = useState<PremiumProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [storeError, setStoreError] = useState<string | null>(null);
    const [buyingSku, setBuyingSku] = useState<string | null>(null);
    const [restoring, setRestoring] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    damping: 20,
                    stiffness: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            loadStoreProducts();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.9,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const loadStoreProducts = async () => {
        setLoadingProducts(true);
        setStoreError(null);
        try {
            await initPremium();
            const fetched = await getPremiumProducts();
            setProducts(fetched);
        } catch (err) {
            console.warn('[Paywall] Failed to load products:', err);
            setStoreError('Store unavailable right now. Please try again in a moment.');
        } finally {
            setLoadingProducts(false);
        }
    };

    const monthly = products.find((p) => p.sku === PREMIUM_PRODUCT_IDS[0]);
    const yearly = products.find((p) => p.sku === PREMIUM_PRODUCT_IDS[1]);

    // "-N months free" hint for the yearly plan when real prices allow it.
    let monthsFree = 0;
    if (monthly?.priceValue && yearly?.priceValue && yearly.priceValue > 0) {
        const saved = monthly.priceValue * 12 - yearly.priceValue;
        if (saved > 0) {
            monthsFree = Math.min(11, Math.max(1, Math.round(saved / monthly.priceValue)));
        }
    }

    const handleBuy = async (sku: string) => {
        if (buyingSku || restoring) return;
        setBuyingSku(sku);
        safeHaptics('light');
        try {
            await purchasePremium(sku);
            safeHaptics('success');
            onPremiumChanged?.();
            onClose();
            StyledAlert.alert('Welcome to Premium 🎉', 'Your account is now premium. Enjoy unlimited groups!');
        } catch (err) {
            safeHaptics('error');
            StyledAlert.alert('Purchase Failed', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setBuyingSku(null);
        }
    };

    const handleRestore = async () => {
        if (buyingSku || restoring) return;
        setRestoring(true);
        safeHaptics('light');
        try {
            const count = await restorePremium();
            safeHaptics('success');
            if (count > 0) {
                onPremiumChanged?.();
                onClose();
                StyledAlert.alert('Purchases Restored', 'Your Premium subscription has been restored. 🎉');
            } else {
                StyledAlert.alert('Nothing to Restore', 'No active Premium purchases were found on this account.');
            }
        } catch (err) {
            safeHaptics('error');
            StyledAlert.alert('Restore Failed', err instanceof Error ? err.message : 'Please try again.');
        } finally {
            setRestoring(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                ) : (
                    <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                )}
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <Animated.View
                    style={[
                        styles.modalContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <View style={styles.modal}>
                        {/* Close X */}
                        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>

                        {/* Crown icon with glow */}
                        <View style={styles.iconGlow} />
                        <View style={styles.iconContainer}>
                            <Text style={styles.iconText}>👑</Text>
                        </View>

                        {/* Title */}
                        <Text style={styles.title}>Go Premium</Text>
                        <Text style={styles.subtitle}>
                            Unlock the full Do It Mate experience
                        </Text>

                        {/* Benefits */}
                        <View style={styles.benefits}>
                            {BENEFITS.map((benefit) => (
                                <View key={benefit.title} style={styles.benefitRow}>
                                    <Text style={styles.benefitEmoji}>{benefit.emoji}</Text>
                                    <View style={styles.benefitTextWrap}>
                                        <Text style={styles.benefitTitle}>{benefit.title}</Text>
                                        <Text style={styles.benefitSubtitle}>{benefit.subtitle}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Price buttons / loading */}
                        {loadingProducts ? (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator color={colors.primary} />
                                <Text style={styles.loadingText}>Loading prices…</Text>
                            </View>
                        ) : storeError ? (
                            <View style={styles.storeErrorBox}>
                                <Text style={styles.storeErrorText}>{storeError}</Text>
                                <TouchableOpacity onPress={loadStoreProducts} activeOpacity={0.7}>
                                    <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.priceButton, buyingSku === PREMIUM_PRODUCT_IDS[0] && styles.priceButtonBusy]}
                                    onPress={() => handleBuy(PREMIUM_PRODUCT_IDS[0])}
                                    disabled={!!buyingSku || restoring}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.priceButtonTextWrap}>
                                        <Text style={styles.priceButtonLabel}>Monthly</Text>
                                        <Text style={styles.priceButtonValue}>
                                            {formatPrice(monthly) || '€4.99'}{' '}
                                            <Text style={styles.priceButtonPeriod}>/ month</Text>
                                        </Text>
                                    </View>
                                    {buyingSku === PREMIUM_PRODUCT_IDS[0] && <ActivityIndicator color="#fff" />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.priceButton, styles.priceButtonYearly, buyingSku === PREMIUM_PRODUCT_IDS[1] && styles.priceButtonBusy]}
                                    onPress={() => handleBuy(PREMIUM_PRODUCT_IDS[1])}
                                    disabled={!!buyingSku || restoring}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.priceButtonTextWrap}>
                                        <Text style={styles.priceButtonLabel}>
                                            Yearly {monthsFree > 0 && <Text style={styles.monthsFree}>−{monthsFree} months free</Text>}
                                        </Text>
                                        <Text style={styles.priceButtonValue}>
                                            {formatPrice(yearly) || '€39.99'}{' '}
                                            <Text style={styles.priceButtonPeriod}>/ year</Text>
                                        </Text>
                                    </View>
                                    {buyingSku === PREMIUM_PRODUCT_IDS[1] && <ActivityIndicator color="#fff" />}
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Restore */}
                        <TouchableOpacity onPress={handleRestore} disabled={!!buyingSku || restoring} activeOpacity={0.7}>
                            {restoring ? (
                                <ActivityIndicator color={colors.textMuted} style={styles.restoreLink} />
                            ) : (
                                <Text style={styles.restoreLink}>Restore purchases</Text>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.termsNote}>
                            Payment is handled by Google Play. Subscriptions renew automatically until cancelled in Play Store settings.
                        </Text>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    modalContainer: {
        width: '100%',
        maxWidth: 360,
    },
    modal: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    closeButton: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    closeButtonText: {
        color: colors.textMuted,
        fontSize: 14,
        fontWeight: '700',
    },
    iconGlow: {
        position: 'absolute',
        top: -16,
        left: '50%',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.warning,
        opacity: 0.12,
        transform: [{ translateX: -50 }],
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: `${colors.warning}22`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    iconText: {
        fontSize: 34,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        color: colors.textMuted,
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 20,
    },
    benefits: {
        width: '100%',
        marginBottom: 20,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    benefitEmoji: {
        fontSize: 20,
        marginRight: 12,
    },
    benefitTextWrap: {
        flex: 1,
    },
    benefitTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    benefitSubtitle: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 1,
    },
    loadingBox: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 24,
    },
    loadingText: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 10,
    },
    storeErrorBox: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 20,
    },
    storeErrorText: {
        color: colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 8,
    },
    retryText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '700',
    },
    priceButton: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 14,
        marginBottom: 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    priceButtonYearly: {
        backgroundColor: colors.surfaceHighlight,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    priceButtonBusy: {
        opacity: 0.7,
    },
    priceButtonTextWrap: {
        flex: 1,
    },
    priceButtonLabel: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    priceButtonValue: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
    },
    priceButtonPeriod: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.75)',
    },
    monthsFree: {
        color: colors.success,
    },
    restoreLink: {
        color: colors.textMuted,
        fontSize: 14,
        fontWeight: '600',
        marginTop: 6,
        padding: 8,
    },
    termsNote: {
        color: colors.textSubtle,
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        marginTop: 10,
        paddingHorizontal: 8,
    },
});
