import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Animated skeleton loading placeholder
 */
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const animatedStyle = {
        width: width as ViewStyle['width'],
        height,
        borderRadius,
        opacity,
    };

    return (
        <Animated.View
            style={[
                styles.skeleton,
                animatedStyle,
                style,
            ]}
        />
    );
}

/**
 * Skeleton for a card-like element
 */
export function SkeletonCard({ lines = 3, style }: { lines?: number; style?: ViewStyle }) {
    return (
        <View style={[styles.card, style]}>
            <View style={styles.cardHeader}>
                <Skeleton width={48} height={48} borderRadius={14} />
                <View style={styles.cardHeaderText}>
                    <Skeleton width="60%" height={16} />
                    <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
                </View>
            </View>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    width={i === lines - 1 ? '70%' : '100%'}
                    height={12}
                    style={{ marginTop: i === 0 ? 16 : 8 }}
                />
            ))}
        </View>
    );
}

/**
 * Skeleton for a goal card
 */
export function SkeletonGoalCard() {
    return (
        <View style={styles.goalCard}>
            {/* Header */}
            <View style={styles.goalHeader}>
                <Skeleton width={56} height={56} borderRadius={16} />
                <View style={styles.goalHeaderText}>
                    <Skeleton width="50%" height={16} />
                    <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
                </View>
            </View>

            {/* Status Badge */}
            <Skeleton width="100%" height={44} borderRadius={12} style={{ marginTop: 16 }} />

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <Skeleton width={60} height={36} borderRadius={8} />
                <Skeleton width={1} height={28} />
                <Skeleton width={60} height={36} borderRadius={8} />
                <Skeleton width={1} height={28} />
                <Skeleton width={80} height={36} borderRadius={8} />
            </View>

            {/* Button */}
            <Skeleton width="100%" height={50} borderRadius={14} style={{ marginTop: 16 }} />
        </View>
    );
}

/**
 * Skeleton for a member row
 */
export function SkeletonMemberRow() {
    return (
        <View style={styles.memberRow}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <View style={styles.memberInfo}>
                <Skeleton width="40%" height={14} />
                <Skeleton width="30%" height={12} style={{ marginTop: 6 }} />
            </View>
        </View>
    );
}

/**
 * Skeleton for a message bubble
 */
export function SkeletonMessage({ isOwn = false }: { isOwn?: boolean }) {
    return (
        <View style={[styles.messageContainer, isOwn && styles.messageOwn]}>
            {!isOwn && <Skeleton width={32} height={32} borderRadius={16} />}
            <View style={[styles.messageBubble, isOwn && styles.messageBubbleOwn]}>
                <Skeleton width={isOwn ? 150 : 180} height={14} />
                <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
            </View>
        </View>
    );
}

/**
 * Skeleton for a list item (activity feed, etc.)
 */
export function SkeletonListItem() {
    return (
        <View style={styles.listItem}>
            <Skeleton width={40} height={40} borderRadius={12} />
            <View style={styles.listItemContent}>
                <Skeleton width="70%" height={14} />
                <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
            </View>
        </View>
    );
}

/**
 * Skeleton for home screen group card
 */
export function SkeletonGroupCard() {
    return (
        <View style={styles.groupCard}>
            <View style={styles.groupHeader}>
                <Skeleton width={56} height={56} borderRadius={16} />
                <View style={styles.groupHeaderText}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
                </View>
            </View>
            <View style={styles.groupFooter}>
                <Skeleton width={80} height={24} borderRadius={12} />
                <Skeleton width={60} height={20} borderRadius={8} />
            </View>
        </View>
    );
}

/**
 * Full page skeleton loader
 */
export function SkeletonPage() {
    return (
        <View style={styles.page}>
            <SkeletonGroupCard />
            <SkeletonGroupCard />
            <SkeletonGroupCard />
        </View>
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: colors.surfaceHighlight,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderText: {
        marginLeft: 16,
        flex: 1,
    },
    goalCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: colors.border,
    },
    goalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    goalHeaderText: {
        marginLeft: 16,
        flex: 1,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginTop: 16,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 14,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    memberInfo: {
        marginLeft: 12,
        flex: 1,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    messageOwn: {
        flexDirection: 'row-reverse',
    },
    messageBubble: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 12,
        marginLeft: 8,
        maxWidth: '75%',
    },
    messageBubbleOwn: {
        backgroundColor: colors.primary + '20',
        marginLeft: 0,
        marginRight: 8,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: 8,
    },
    listItemContent: {
        marginLeft: 12,
        flex: 1,
    },
    groupCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    groupHeaderText: {
        marginLeft: 16,
        flex: 1,
    },
    groupFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    page: {
        padding: 16,
    },
});

export default Skeleton;
