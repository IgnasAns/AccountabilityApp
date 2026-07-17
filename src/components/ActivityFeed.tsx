import React from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Image,
    TouchableOpacity,
} from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { colors } from '../theme/colors';
import { useActivityLog } from '../hooks/useActivityLog';
import { ActivityLogWithProfile } from '../types/database';
import { SkeletonListItem } from './Skeleton';

interface Props {
    groupId: string;
    maxItems?: number;
    showHeader?: boolean;
    onActivityPress?: (activity: ActivityLogWithProfile) => void;
}

export default function ActivityFeed({ groupId, maxItems = 50, showHeader = true, onActivityPress }: Props) {
    const { activities, loading, error, getActivityMessage, getActivityIcon } = useActivityLog(groupId);

    const displayActivities = maxItems ? activities.slice(0, maxItems) : activities;

    const renderActivity = ({ item }: { item: ActivityLogWithProfile }) => {
        const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
        const icon = getActivityIcon(item.event_type);
        const message = getActivityMessage(item);

        return (
            <TouchableOpacity
                style={styles.activityItem}
                onPress={() => onActivityPress?.(item)}
                disabled={!onActivityPress}
                activeOpacity={0.7}
            >
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>{icon}</Text>
                </View>
                <View style={styles.content}>
                    <View style={styles.userRow}>
                        {item.user?.avatar_url ? (
                            <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>
                                    {item.user?.name?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.message} numberOfLines={2}>
                            {message}
                        </Text>
                    </View>
                    <Text style={styles.time}>{timeAgo}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonListItem key={i} />
                ))}
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Failed to load activity</Text>
            </View>
        );
    }

    if (displayActivities.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No activity yet</Text>
                <Text style={styles.emptySubtext}>Group events will appear here</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {showHeader && (
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Recent Activity</Text>
                    <Text style={styles.headerCount}>{activities.length}</Text>
                </View>
            )}
            <FlatList
                data={displayActivities}
                renderItem={renderActivity}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
                getItemLayout={undefined}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    headerCount: {
        fontSize: 12,
        color: colors.textMuted,
        backgroundColor: colors.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    listContent: {
        padding: 16,
    },
    activityItem: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surfaceHighlight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    icon: {
        fontSize: 20,
    },
    content: {
        flex: 1,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        marginRight: 8,
    },
    avatarPlaceholder: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    message: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    time: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 6,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        color: colors.error,
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textMuted,
    },
});
