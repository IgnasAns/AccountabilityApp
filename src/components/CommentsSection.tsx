import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { colors } from '../theme/colors';
import { useGoalComments } from '../hooks/useGoalComments';
import { GoalCommentWithProfile } from '../types/database';
import { safeHaptics } from '../utils/haptics';

interface Props {
    completionId: string;
    onCommentAdded?: () => void;
    scrollEnabled?: boolean;
}

export default function CommentsSection({ completionId, onCommentAdded, scrollEnabled = true }: Props) {
    const {
        comments,
        loading,
        error,
        fetchComments,
        addComment,
        deleteComment,
        canDelete,
    } = useGoalComments();

    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchComments(completionId);
    }, [completionId]);

    const handleSubmit = async () => {
        if (!newComment.trim() || submitting) return;

        setSubmitting(true);
        safeHaptics('light');

        const success = await addComment(completionId, newComment);

        if (success) {
            setNewComment('');
            onCommentAdded?.();
            safeHaptics('success');
        }

        setSubmitting(false);
    };

    const handleDelete = async (commentId: string) => {
        safeHaptics('warning');
        await deleteComment(commentId);
    };

    const renderComment = ({ item }: { item: GoalCommentWithProfile }) => (
        <View style={styles.commentItem}>
            {item.user?.avatar_url ? (
                <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>
                        {item.user?.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                </View>
            )}
            <View style={styles.commentContent}>
                <View style={styles.commentHeader}>
                    <Text style={styles.userName}>{item.user?.name || 'Unknown'}</Text>
                    <Text style={styles.timeAgo}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </Text>
                </View>
                <Text style={styles.commentText}>{item.content}</Text>
            </View>
            {canDelete(item) && (
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item.id)}
                >
                    <Text style={styles.deleteText}>🗑️</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <Text style={styles.title}>💬 Comments</Text>
                <Text style={styles.count}>{comments.length}</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : comments.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No comments yet</Text>
                    <Text style={styles.emptySubtext}>Be the first to encourage!</Text>
                </View>
            ) : (
                <FlatList
                    data={comments}
                    renderItem={renderComment}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={scrollEnabled}
                />
            )}

            {error && (
                <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Input Area */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Add a comment..."
                    placeholderTextColor={colors.textMuted}
                    value={newComment}
                    onChangeText={setNewComment}
                    maxLength={500}
                    multiline
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!newComment.trim() || submitting) && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={!newComment.trim() || submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.sendText}>Send</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    count: {
        marginLeft: 8,
        fontSize: 12,
        color: colors.textMuted,
        backgroundColor: colors.surfaceHighlight,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: colors.textMuted,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 12,
        color: colors.textMuted,
    },
    list: {
        flex: 1,
        padding: 16,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    avatarPlaceholder: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    commentContent: {
        flex: 1,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 12,
        padding: 10,
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    userName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    timeAgo: {
        fontSize: 10,
        color: colors.textMuted,
    },
    commentText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    deleteButton: {
        padding: 8,
        marginLeft: 4,
    },
    deleteText: {
        fontSize: 14,
    },
    errorText: {
        color: colors.error,
        fontSize: 12,
        textAlign: 'center',
        padding: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    input: {
        flex: 1,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: colors.text,
        fontSize: 14,
        maxHeight: 100,
        marginRight: 10,
    },
    sendButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        minWidth: 70,
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
});
