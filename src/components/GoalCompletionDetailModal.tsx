import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Image,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { colors } from '../theme/colors';
import { ActivityLogWithProfile, GoalCompletion } from '../types/database';
import { supabase } from '../services/supabase';
import { safeHaptics } from '../utils/haptics';
import CommentsSection from './CommentsSection';
import ProofPhotoViewer from './ProofPhotoViewer';


interface Props {
    visible: boolean;
    onClose: () => void;
    activityItem: ActivityLogWithProfile | null;
}

export default function GoalCompletionDetailModal({ visible, onClose, activityItem }: Props) {
    const [completion, setCompletion] = useState<GoalCompletion | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPhotoViewer, setShowPhotoViewer] = useState(false);

    useEffect(() => {
        if (visible && activityItem && activityItem.event_type === 'goal_completed' && activityItem.related_id) {
            fetchCompletionDetails(activityItem.related_id);
        } else {
            setCompletion(null);
        }
    }, [visible, activityItem]);

    const fetchCompletionDetails = async (completionId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('goal_completions')
                .select('*')
                .eq('id', completionId)
                .single();

            if (error) throw error;
            setCompletion(data);
        } catch {
            // Non-critical error
        } finally {
            setLoading(false);
        }
    };

    if (!activityItem) return null;

    const goalName = activityItem.metadata?.goal_name || 'Goal';
    const goalEmoji = activityItem.metadata?.goal_emoji || '🎯';

    // If fetch failed or loading, we can partially render.
    // If not goal_completed, we shouldn't supply this modal, but just in case.
    if (activityItem.event_type !== 'goal_completed') return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={styles.modalContainer}>
                    <View style={styles.dragHandle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.userInfo}>
                            {activityItem.user?.avatar_url ? (
                                <Image source={{ uri: activityItem.user.avatar_url }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarText}>
                                        {activityItem.user?.name?.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View>
                                <Text style={styles.userName}>{activityItem.user?.name}</Text>
                                <Text style={styles.actionText}>completed a goal</Text>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Goal Info */}
                        <View style={styles.goalCard}>
                            <Text style={styles.goalEmoji}>{goalEmoji}</Text>
                            <Text style={styles.goalName}>{goalName}</Text>
                        </View>

                        {/* Proof Photo Area */}
                        {loading ? (
                            <ActivityIndicator style={{ padding: 20 }} color={colors.primary} />
                        ) : completion ? (
                            <>
                                {completion.proof_photo_url && (
                                    <TouchableOpacity
                                        style={styles.photoContainer}
                                        onPress={() => setShowPhotoViewer(true)}
                                        activeOpacity={0.9}
                                    >
                                        <Image
                                            source={{ uri: completion.proof_photo_url }}
                                            style={styles.proofPhoto}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.photoOverlay}>
                                            <Text style={styles.photoLabel}>📸 Proof</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {completion.notes && (
                                    <View style={styles.notesContainer}>
                                        <Text style={styles.notesLabel}>Notes:</Text>
                                        <Text style={styles.notesText}>{completion.notes}</Text>
                                    </View>
                                )}
                            </>
                        ) : null}

                        {/* Comments Section */}
                        {activityItem.related_id && (
                            <View style={styles.commentsWrapper}>
                                <CommentsSection completionId={activityItem.related_id} scrollEnabled={false} />
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Photo Viewer — shared zoomable ProofPhotoViewer (pinch/double-tap) */}
                {showPhotoViewer && completion?.proof_photo_url && (
                    <ProofPhotoViewer photoUrl={completion.proof_photo_url} size="medium" />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 20,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    avatarPlaceholder: {
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text,
    },
    actionText: {
        fontSize: 13,
        color: colors.textMuted,
    },
    closeButton: {
        padding: 8,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 20,
    },
    closeIcon: {
        color: colors.text,
        fontSize: 14,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    goalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        margin: 16,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    goalEmoji: {
        fontSize: 32,
        marginRight: 16,
    },
    goalName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text,
        flex: 1,
    },
    photoContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        height: 250,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000',
        position: 'relative',
    },
    proofPhoto: {
        width: '100%',
        height: '100%',
    },
    photoOverlay: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    photoLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    notesContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: colors.surfaceHighlight,
        padding: 12,
        borderRadius: 12,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.textMuted,
        marginBottom: 4,
    },
    notesText: {
        fontSize: 14,
        color: colors.text,
        fontStyle: 'italic',
    },
    commentsWrapper: {
        flex: 1,
        minHeight: 300,
    }
});
