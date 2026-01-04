import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { Message, MessageWithProfile, Profile } from '../types/database';

export function useMessages(groupId: string) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<MessageWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const subscriptionRef = useRef<any>(null);

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        if (!user || !groupId) return;

        // Guest mode support
        if (user.id === 'guest_user_id') {
            setLoading(false);
            setMessages([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('messages')
                .select(`
                    *,
                    user:profiles!messages_user_id_fkey(*)
                `)
                .eq('group_id', groupId)
                .order('created_at', { ascending: true })
                .limit(100);

            if (fetchError) throw fetchError;

            setMessages((data || []) as MessageWithProfile[]);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching messages:', err);
        } finally {
            setLoading(false);
        }
    }, [user, groupId]);

    // Subscribe to real-time updates
    useEffect(() => {
        if (!user || !groupId || user.id === 'guest_user_id') return;

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

        try {
            setSending(true);

            const { error: insertError } = await supabase
                .from('messages')
                .insert({
                    group_id: groupId,
                    user_id: user.id,
                    content: content.trim(),
                    message_type: imageUrl ? 'image' : 'text',
                    image_url: imageUrl || null,
                });

            if (insertError) throw insertError;
        } catch (err: any) {
            setError(err.message);
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
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    }

    return {
        messages,
        loading,
        error,
        sending,
        sendMessage,
        deleteMessage,
        refetch: fetchMessages,
    };
}
