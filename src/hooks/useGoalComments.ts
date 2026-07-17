import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { GoalCommentWithProfile } from '../types/database';
import { sanitizeText } from '../utils/sanitize';
import { MAX_COMMENT_LENGTH } from '../constants';

export function useGoalComments(completionId?: string) {
    const { user } = useAuth();
    const [comments, setComments] = useState<GoalCommentWithProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchComments = useCallback(async (targetCompletionId?: string) => {
        const id = targetCompletionId || completionId;
        if (!id || !user) return;

        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('goal_comments')
                .select(`
                    *,
                    user:profiles!goal_comments_user_id_fkey(*)
                `)
                .eq('completion_id', id)
                .order('created_at', { ascending: true });

            if (fetchError) {
                // Table might not exist
                if (fetchError.message.includes('does not exist')) {
                    setComments([]);
                    return;
                }
                throw fetchError;
            }

            setComments((data || []) as GoalCommentWithProfile[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    }, [user, completionId]);

    // Add a comment
    const addComment = async (targetCompletionId: string, content: string): Promise<boolean> => {
        if (!user) {
            setError('You must be logged in to comment');
            return false;
        }

        // Sanitize the comment content
        const sanitizedContent = sanitizeText(content, MAX_COMMENT_LENGTH);
        if (!sanitizedContent) {
            setError('Comment cannot be empty');
            return false;
        }

        try {
            setError(null);

            const { data, error: insertError } = await supabase
                .from('goal_comments')
                .insert({
                    completion_id: targetCompletionId,
                    user_id: user.id,
                    content: sanitizedContent,
                })
                .select(`
                    *,
                    user:profiles!goal_comments_user_id_fkey(*)
                `)
                .single();

            if (insertError) {
                // Table might not exist
                if (insertError.message.includes('does not exist')) {
                    setError('Comments feature not available yet');
                    return false;
                }
                throw insertError;
            }

            if (data) {
                setComments(prev => [...prev, data as GoalCommentWithProfile]);
            }

            return true;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
            return false;
        }
    };

    // Delete a comment
    const deleteComment = async (commentId: string): Promise<boolean> => {
        if (!user) {
            setError('You must be logged in');
            return false;
        }

        try {
            setError(null);

            const { error: deleteError } = await supabase
                .from('goal_comments')
                .delete()
                .eq('id', commentId)
                .eq('user_id', user.id);

            if (deleteError) throw deleteError;

            setComments(prev => prev.filter(c => c.id !== commentId));
            return true;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred");
            return false;
        }
    };

    // Check if user can delete a comment
    const canDelete = (comment: GoalCommentWithProfile): boolean => {
        return user?.id === comment.user_id;
    };

    return {
        comments,
        loading,
        error,
        fetchComments,
        addComment,
        deleteComment,
        canDelete,
    };
}
