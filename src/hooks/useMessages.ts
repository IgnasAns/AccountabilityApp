import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message, MessageWithProfile, Profile } from '../types/database';
import { sanitizeText } from '../utils/sanitize';
import { MESSAGES_PAGE_SIZE, CHAT_MESSAGE_MAX_LENGTH } from '../constants';

export function useMessages(groupId: string) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<MessageWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const subscriptionRef = useRef<RealtimeChannel | null>(null);

    // Fetch messages with pagination
    const fetchMessages = useCallback(async (before?: string) => {
        if (!user || !groupId) return;

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('messages')
                .select(`
                    *,
                    user:profiles!messages_user_id_fkey(*)
                `)
                .eq('group_id', groupId)
                .order('created_at', { ascending: false })
                .limit(MESSAGES_PAGE_SIZE);

            if (before) {
                query = query.lt('created_at', before);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const newMessages = (data || []) as MessageWithProfile[];
            // Reverse to chronological order
            newMessages.reverse();

            setHasMore(newMessages.length >= MESSAGES_PAGE_SIZE);

            if (before) {
                setMessages((prev) => [...newMessages, ...prev]);
            } else {
                setMessages(newMessages);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [user, groupId]);

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user || !groupId) return;

        fetchMessages();

        // Set up real-time subscription
        const channel = supabase
            .channel(`messages:${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `group_id=eq.${groupId}`,
                },
                async (payload) => {
                    // Fetch the new message with user profile
                    const { data } = await supabase
                        .from('messages')
                        .select(`
                            *,
                            user:profiles!messages_user_id_fkey(*)
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        setMessages((prev) => [...prev, data as MessageWithProfile]);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'messages',
                    filter: `group_id=eq.${groupId}`,
                },
                (payload) => {
                    setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                }
            )
            .subscribe();

        subscriptionRef.current = channel;

        return () => {
            if (subscriptionRef.current) {
                supabase.removeChannel(subscriptionRef.current);
            }
        };
    }, [user, groupId, fetchMessages]);

    // Send a message
    async function sendMessage(content: string, imageUrl?: string) {
        if (!user || !content.trim()) return;

        // Sanitize the message content
        const sanitizedContent = sanitizeText(content, CHAT_MESSAGE_MAX_LENGTH);
        if (!sanitizedContent) return;

        try {
            setSending(true);

            const { error: insertError } = await supabase
                .from('messages')
                .insert({
                    group_id: groupId,
                    user_id: user.id,
                    content: sanitizedContent,
                    message_type: imageUrl ? 'image' : 'text',
                    image_url: imageUrl || null,
                });

            if (insertError) throw insertError;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
            throw err;
        } finally {
            setSending(false);
        }
    }

    // Delete a message
    async function deleteMessage(messageId: string) {
        if (!user) return;

        try {
            const { error: deleteError } = await supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .eq('user_id', user.id);

            if (deleteError) throw deleteError;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
            throw err;
        }
    }

    return {
        messages,
        loading,
        error,
        sending,
        hasMore,
        sendMessage,
        deleteMessage,
        refetch: () => fetchMessages(),
        loadMore: () => {
            if (messages.length > 0) {
                return fetchMessages(messages[0].created_at);
            }
        },
    };
}
