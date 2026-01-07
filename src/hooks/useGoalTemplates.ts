import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { GoalTemplate, GoalCategory } from '../types/database';

// Default templates to use when database table doesn't exist
const DEFAULT_TEMPLATES: GoalTemplate[] = [
    { id: '1', name: 'Daily Exercise', description: 'Get at least 30 minutes of exercise', emoji: '💪', category: 'fitness', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 5.00, is_featured: true, usage_count: 0, created_at: '' },
    { id: '2', name: 'Gym Session', description: 'Hit the gym for a workout', emoji: '🏋️', category: 'fitness', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 2, suggested_target_per_week: 3, suggested_penalty: 10.00, is_featured: true, usage_count: 0, created_at: '' },
    { id: '3', name: 'Morning Run', description: 'Start the day with a run', emoji: '🏃', category: 'fitness', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 2, suggested_target_per_week: 3, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '4', name: 'Meditation', description: 'Practice mindfulness meditation', emoji: '🧘', category: 'mindfulness', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 2.00, is_featured: true, usage_count: 0, created_at: '' },
    { id: '5', name: 'Read 10 Pages', description: 'Read at least 10 pages of a book', emoji: '📚', category: 'productivity', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 3.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '6', name: 'Drink 2L Water', description: 'Stay hydrated throughout the day', emoji: '💧', category: 'health', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 2.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '7', name: '8 Hours Sleep', description: 'Get a full night of rest', emoji: '😴', category: 'health', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '8', name: 'Healthy Meal', description: 'Eat a nutritious home-cooked meal', emoji: '🥗', category: 'health', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 3.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '9', name: 'No Smoking', description: 'Avoid cigarettes all day', emoji: '🚭', category: 'health', goal_type: 'frequency', goal_mode: 'negative', suggested_frequency_days: 1, suggested_target_per_week: null, suggested_penalty: 10.00, is_featured: true, usage_count: 0, created_at: '' },
    { id: '10', name: 'No Alcohol', description: 'Stay sober for the day', emoji: '🍺', category: 'health', goal_type: 'frequency', goal_mode: 'negative', suggested_frequency_days: 1, suggested_target_per_week: null, suggested_penalty: 10.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '11', name: 'No Junk Food', description: 'Avoid processed/fast food', emoji: '🍕', category: 'health', goal_type: 'frequency', goal_mode: 'negative', suggested_frequency_days: 1, suggested_target_per_week: null, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '12', name: 'No Social Media', description: 'Limit social media usage', emoji: '📱', category: 'productivity', goal_type: 'frequency', goal_mode: 'negative', suggested_frequency_days: 1, suggested_target_per_week: null, suggested_penalty: 5.00, is_featured: true, usage_count: 0, created_at: '' },
    { id: '13', name: 'No Gaming', description: 'Avoid video games', emoji: '🎮', category: 'productivity', goal_type: 'frequency', goal_mode: 'negative', suggested_frequency_days: 1, suggested_target_per_week: null, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '14', name: 'Early Wake Up', description: 'Wake up before 7 AM', emoji: '🌅', category: 'productivity', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '15', name: 'Journal Entry', description: 'Write in your journal', emoji: '✍️', category: 'mindfulness', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 2.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '16', name: 'Clean Room', description: 'Tidy up your living space', emoji: '🧹', category: 'productivity', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 3, suggested_target_per_week: 2, suggested_penalty: 3.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '17', name: 'Take Vitamins', description: 'Remember daily supplements', emoji: '💊', category: 'health', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 1.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '18', name: 'Call Family', description: 'Stay connected with loved ones', emoji: '📞', category: 'social', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 7, suggested_target_per_week: 1, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '19', name: 'Save Money', description: 'No unnecessary purchases today', emoji: '💰', category: 'finance', goal_type: 'frequency', goal_mode: 'negative', suggested_frequency_days: 1, suggested_target_per_week: null, suggested_penalty: 5.00, is_featured: false, usage_count: 0, created_at: '' },
    { id: '20', name: '10K Steps', description: 'Walk 10,000 steps', emoji: '👣', category: 'fitness', goal_type: 'frequency', goal_mode: 'positive', suggested_frequency_days: 1, suggested_target_per_week: 7, suggested_penalty: 5.00, is_featured: true, usage_count: 0, created_at: '' },
];

export function useGoalTemplates() {
    const [templates, setTemplates] = useState<GoalTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('goal_templates')
                .select('*')
                .order('usage_count', { ascending: false });

            if (fetchError) {
                // Table might not exist - use defaults
                if (fetchError.message.includes('does not exist')) {
                    setTemplates(DEFAULT_TEMPLATES);
                    return;
                }
                throw fetchError;
            }

            setTemplates((data || []) as GoalTemplate[]);
        } catch (err: any) {
            setError(err.message);
            // Fallback to defaults on error
            setTemplates(DEFAULT_TEMPLATES);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Get templates by category
    const getByCategory = (category: GoalCategory): GoalTemplate[] => {
        return templates.filter(t => t.category === category);
    };

    // Get featured templates
    const getFeatured = (): GoalTemplate[] => {
        return templates.filter(t => t.is_featured);
    };

    // Get templates by mode
    const getByMode = (mode: 'positive' | 'negative'): GoalTemplate[] => {
        return templates.filter(t => t.goal_mode === mode);
    };

    // Search templates
    const search = (query: string): GoalTemplate[] => {
        const lowerQuery = query.toLowerCase();
        return templates.filter(t =>
            t.name.toLowerCase().includes(lowerQuery) ||
            t.description?.toLowerCase().includes(lowerQuery) ||
            t.category.toLowerCase().includes(lowerQuery)
        );
    };

    // Increment usage count when a template is used
    const markAsUsed = async (templateId: string) => {
        try {
            await supabase
                .from('goal_templates')
                .update({ usage_count: supabase.rpc('increment_usage', { row_id: templateId }) })
                .eq('id', templateId);
        } catch (err) {
            // Non-critical, ignore errors
        }
    };

    // Get category info
    const getCategoryInfo = (category: GoalCategory): { emoji: string; label: string; color: string } => {
        switch (category) {
            case 'fitness':
                return { emoji: '💪', label: 'Fitness', color: '#EF4444' };
            case 'health':
                return { emoji: '❤️', label: 'Health', color: '#EC4899' };
            case 'productivity':
                return { emoji: '📈', label: 'Productivity', color: '#3B82F6' };
            case 'finance':
                return { emoji: '💰', label: 'Finance', color: '#10B981' };
            case 'mindfulness':
                return { emoji: '🧘', label: 'Mindfulness', color: '#8B5CF6' };
            case 'social':
                return { emoji: '👥', label: 'Social', color: '#F59E0B' };
            case 'custom':
            default:
                return { emoji: '⭐', label: 'Custom', color: '#6B7280' };
        }
    };

    // Get all categories
    const getAllCategories = (): GoalCategory[] => {
        return ['fitness', 'health', 'productivity', 'finance', 'mindfulness', 'social', 'custom'];
    };

    return {
        templates,
        loading,
        error,
        getByCategory,
        getFeatured,
        getByMode,
        search,
        markAsUsed,
        getCategoryInfo,
        getAllCategories,
        refetch: fetchTemplates,
    };
}
