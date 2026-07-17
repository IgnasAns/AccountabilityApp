import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import AppIcon, { AppIconName } from '../AppIcon';

export type TabOption = 'dashboard' | 'leaderboard' | 'activity' | 'balances' | 'settings';

export const TABS: { key: TabOption; label: string; icon: AppIconName }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'view-dashboard-outline' },
    { key: 'leaderboard', label: 'Leaderboard', icon: 'trophy-outline' },
    { key: 'activity', label: 'Activity', icon: 'clipboard-text-outline' },
    { key: 'balances', label: 'Balances', icon: 'wallet-outline' },
    { key: 'settings', label: 'Settings', icon: 'cog-outline' },
];

interface GroupDetailHeaderProps {
    groupName: string;
    activeTab: TabOption;
    onBack: () => void;
    onTabChange: (tab: TabOption) => void;
    onOpenChat: () => void;
    onShareInvite: () => void;
}

export default function GroupDetailHeader({
    groupName,
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

            {/* Tabs */}
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
                    >
                        <AppIcon
                            name={tab.icon}
                            size={16}
                            color={activeTab === tab.key ? '#fff' : colors.textMuted}
                        />
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
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 8,
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
    },
    activeTab: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMuted,
    },
    activeTabText: {
        color: '#fff',
    },
});
