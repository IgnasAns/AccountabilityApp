import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import AppIcon from '../AppIcon';

export type TabOption = 'dashboard' | 'leaderboard' | 'activity' | 'balances' | 'settings';

/**
 * The group-level tabs. Note 'activity' is LABELED "Feed" — the bottom tab
 * bar already has an "Activity" tab (the money ledger), so two "Activity"
 * tabs in one screen were a duplicate (UX audit #11).
 */
export const TABS: { key: TabOption; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'activity', label: 'Feed' },
    { key: 'balances', label: 'Balances' },
    { key: 'settings', label: 'Settings' },
];

interface GroupDetailHeaderProps {
    groupName: string;
    /** Set when this group is a public challenge the user joined — renders a small tag. */
    challengeTag?: { slug: string; name: string; emoji: string } | null;
    activeTab: TabOption;
    onBack: () => void;
    onTabChange: (tab: TabOption) => void;
    onOpenChat: () => void;
    onShareInvite: () => void;
}

export default function GroupDetailHeader({
    groupName,
    challengeTag,
    activeTab,
    onBack,
    onTabChange,
    onOpenChat,
    onShareInvite,
}: GroupDetailHeaderProps) {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            {/* Top Nav */}
            <View style={styles.topNav}>
                <TouchableOpacity onPress={onBack} style={styles.headerButton} accessibilityLabel="Go back">
                    <AppIcon name="chevron-left" size={28} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
                    {challengeTag && (
                        <View style={styles.challengeTag}>
                            <Text style={styles.challengeTagText} numberOfLines={1}>
                                {challengeTag.emoji} Public challenge · {challengeTag.name}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={onOpenChat} style={styles.headerButton} accessibilityLabel="Open group chat">
                        <AppIcon name="chat-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onShareInvite} style={styles.headerButton} accessibilityLabel="Share invite">
                        <AppIcon name="share-variant-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs — compact labels so all five fit on screen. The strip is
                still scrollable for narrow devices; the last tab deliberately
                peeks past the right edge as the scroll affordance. */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsContainer}
            >
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                        onPress={() => onTabChange(tab.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: activeTab === tab.key }}
                        accessibilityLabel={tab.label}
                    >
                        <Text style={[
                            styles.tabText,
                            activeTab === tab.key && styles.activeTabText,
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        backgroundColor: colors.background,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        zIndex: 10,
    },
    topNav: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
        height: 44,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
    },
    challengeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        backgroundColor: colors.primaryMuted,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        maxWidth: '100%',
    },
    challengeTagText: {
        color: colors.primary,
        fontSize: 10,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: colors.surfaceHighlight,
    },
    tabsScroll: {
        maxHeight: 50,
    },
    tabsContainer: {
        flexDirection: 'row',
        // Right padding lets the last tab peek past the edge on narrow
        // screens — the peek is the "there's more" affordance.
        paddingHorizontal: 12,
        paddingRight: 20,
        paddingBottom: 12,
        gap: 6,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeTab: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: colors.textMuted,
    },
    activeTabText: {
        color: '#fff',
    },
});
