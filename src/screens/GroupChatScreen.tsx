import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../hooks/useMessages';
import { MessageWithProfile } from '../types/database';
import { colors } from '../theme/colors';

type RootStackParamList = {
    GroupChat: { groupId: string; groupName: string };
};

type Props = NativeStackScreenProps<RootStackParamList, 'GroupChat'>;

export default function GroupChatScreen({ navigation, route }: Props) {
    const { groupId, groupName } = route.params;
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const { messages, loading, sending, sendMessage } = useMessages(groupId);
    const [inputText, setInputText] = useState('');
    const flatListRef = useRef<FlatList>(null);

    // Set navigation title
    useEffect(() => {
        navigation.setOptions({
            title: `💬 ${groupName}`,
            headerStyle: {
                backgroundColor: colors.surface,
            },
            headerTintColor: colors.text,
        });
    }, [navigation, groupName]);

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    const safeHaptics = () => {
        if (Platform.OS !== 'web') {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (e) { }
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || sending) return;

        const text = inputText.trim();
        setInputText('');
        safeHaptics();

        try {
            await sendMessage(text);
        } catch (error) {
            console.error('Failed to send message:', error);
            setInputText(text); // Restore text on failure
        }
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
        }
    };

    const shouldShowDateHeader = (message: MessageWithProfile, index: number) => {
        if (index === 0) return true;
        const prevMessage = messages[index - 1];
        const messageDate = new Date(message.created_at).toDateString();
        const prevDate = new Date(prevMessage.created_at).toDateString();
        return messageDate !== prevDate;
    };

    const renderMessage = ({ item, index }: { item: MessageWithProfile; index: number }) => {
        const isOwnMessage = item.user_id === user?.id;
        const showDateHeader = shouldShowDateHeader(item, index);

        // Check if we should show the sender name (different from previous message)
        const showSenderName = !isOwnMessage && (
            index === 0 ||
            messages[index - 1].user_id !== item.user_id ||
            showDateHeader
        );

        return (
            <View>
                {showDateHeader && (
                    <View style={styles.dateHeader}>
                        <Text style={styles.dateHeaderText}>
                            {formatDate(item.created_at)}
                        </Text>
                    </View>
                )}

                <View style={[
                    styles.messageRow,
                    isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow
                ]}>
                    {!isOwnMessage && (
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatarText}>
                                {item.user?.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        </View>
                    )}

                    <View style={[
                        styles.messageBubble,
                        isOwnMessage ? styles.ownBubble : styles.otherBubble
                    ]}>
                        {showSenderName && (
                            <Text style={styles.senderName}>
                                {item.user?.name || 'Unknown'}
                            </Text>
                        )}
                        <Text style={[
                            styles.messageText,
                            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
                        ]}>
                            {item.content}
                        </Text>
                        <Text style={[
                            styles.timeText,
                            isOwnMessage ? styles.ownTimeText : styles.otherTimeText
                        ]}>
                            {formatTime(item.created_at)}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* Messages List */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={[
                    styles.messagesList,
                    messages.length === 0 && styles.emptyList
                ]}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>💬</Text>
                        <Text style={styles.emptyTitle}>No messages yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Start the conversation! Motivate your group or throw some friendly trash talk.
                        </Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />

            {/* Input Area */}
            <View style={[
                styles.inputContainer,
                { paddingBottom: Math.max(insets.bottom, 16) }
            ]}>
                <TextInput
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textMuted}
                    style={styles.textInput}
                    multiline
                    maxLength={500}
                    editable={!sending}
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!inputText.trim() || sending) && styles.sendButtonDisabled
                    ]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.sendButtonText}>➤</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.textMuted,
        marginTop: 12,
    },
    messagesList: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    emptyList: {
        flex: 1,
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptySubtitle: {
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },
    dateHeader: {
        alignItems: 'center',
        marginVertical: 16,
    },
    dateHeaderText: {
        color: colors.textMuted,
        fontSize: 12,
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-end',
    },
    ownMessageRow: {
        justifyContent: 'flex-end',
    },
    otherMessageRow: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    ownBubble: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 4,
    },
    senderName: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    ownMessageText: {
        color: '#fff',
    },
    otherMessageText: {
        color: colors.text,
    },
    timeText: {
        fontSize: 11,
        marginTop: 4,
    },
    ownTimeText: {
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'right',
    },
    otherTimeText: {
        color: colors.textMuted,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    textInput: {
        flex: 1,
        backgroundColor: colors.surfaceHighlight,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingRight: 16,
        marginRight: 12,
        color: colors.text,
        fontSize: 16,
        maxHeight: 100,
        minHeight: 44,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.border,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 20,
    },
});
