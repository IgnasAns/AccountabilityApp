// Database types matching the Supabase schema
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    name: string;
                    avatar_url: string | null;
                    payment_link: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    name: string;
                    avatar_url?: string | null;
                    payment_link?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    avatar_url?: string | null;
                    payment_link?: string | null;
                    updated_at?: string;
                };
            };
            groups: {
                Row: {
                    id: string;
                    name: string;
                    description: string | null;
                    default_penalty_amount: number;
                    invite_code: string;
                    image_url: string | null;
                    created_by: string;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    description?: string | null;
                    default_penalty_amount?: number;
                    invite_code?: string;
                    image_url?: string | null;
                    created_by: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    name?: string;
                    description?: string | null;
                    default_penalty_amount?: number;
                    image_url?: string | null;
                    updated_at?: string;
                };
            };
            group_members: {
                Row: {
                    id: string;
                    group_id: string;
                    user_id: string;
                    current_balance: number;
                    failure_count: number;
                    joined_at: string;
                };
                Insert: {
                    id?: string;
                    group_id: string;
                    user_id: string;
                    current_balance?: number;
                    failure_count?: number;
                    joined_at?: string;
                };
                Update: {
                    current_balance?: number;
                    failure_count?: number;
                };
            };
            transactions: {
                Row: {
                    id: string;
                    group_id: string;
                    from_user_id: string;
                    to_user_id: string;
                    amount: number;
                    status: 'pending' | 'paid';
                    description: string | null;
                    proof_photo_url: string | null;
                    created_at: string;
                    settled_at: string | null;
                };
                Insert: {
                    id?: string;
                    group_id: string;
                    from_user_id: string;
                    to_user_id: string;
                    amount: number;
                    status?: 'pending' | 'paid';
                    description?: string | null;
                    proof_photo_url?: string | null;
                    created_at?: string;
                    settled_at?: string | null;
                };
                Update: {
                    status?: 'pending' | 'paid';
                    settled_at?: string | null;
                };
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            log_failure: {
                Args: { p_group_id: string; p_description: string | null; p_proof_photo_url?: string | null };
                Returns: {
                    success: boolean;
                    transactions_created: number;
                    total_debt: number;
                } | null;
            };
            settle_debt: {
                Args: { p_transaction_id: string };
                Returns: { success: boolean } | null;
            };
            get_net_balance: {
                Args: Record<string, never>;
                Returns: number | null;
            };
            join_group_by_code: {
                Args: { p_invite_code: string };
                Returns: { success: boolean; group_id: string | null; error: string | null } | null;
            };
        };
        Enums: {
            [_ in never]: never;
        };
    };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Group = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];

// Extended types with joins
export interface GroupWithMembers extends Group {
    members: (GroupMember & { profile: Profile })[];
}

export interface GroupMemberWithProfile extends GroupMember {
    profile: Profile;
}

export interface TransactionWithProfiles extends Transaction {
    from_user: Profile;
    to_user: Profile;
}

export interface GroupBalance {
    group: Group;
    balance: number;
    memberAvatars?: string[];
}

// Goal types for scheduled goals feature
export type GoalCategory = 'fitness' | 'health' | 'productivity' | 'finance' | 'mindfulness' | 'social' | 'custom';

export interface Goal {
    id: string;
    group_id: string;
    name: string;
    description: string | null;
    emoji: string;
    goal_type: 'frequency' | 'daily' | 'weekly';
    goal_mode: 'positive' | 'negative'; // positive = achievement, negative = habit breaking
    frequency_days: number;
    target_per_week: number | null; // For "3x per week" type goals
    penalty_amount: number;
    is_active: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    // Streak tracking
    current_streak: number;
    longest_streak: number;
    streak_broken_at: string | null;
    // Photo proof requirement
    requires_proof: boolean;
    // Category and tags
    category: GoalCategory;
    tags: string[];
    // Pause support
    is_paused: boolean;
    paused_at: string | null;
    paused_until: string | null;
    // Penalty escalation
    penalty_escalation_enabled: boolean;
    penalty_escalation_rate: number;
    consecutive_failures: number;
}

export interface GoalCompletion {
    id: string;
    goal_id: string;
    user_id: string;
    completed_at: string;
    proof_photo_url: string | null;
    notes: string | null;
    occurrence_count: number; // For negative goals, how many at once (e.g., 2 cigarettes)
    created_at: string;
}

export interface GoalWithCompletions extends Goal {
    completions: GoalCompletion[];
    creator?: Profile;
}

export interface GoalStatus {
    goal_id: string;
    user_id: string;
    last_completion: string | null;
    next_deadline: string;
    is_overdue: boolean;
    days_remaining: number;
    total_completions: number;
}

// Performance stats for a user on a goal
export interface GoalPerformance {
    user_id: string;
    user_name: string;
    completions_this_week: number;
    target_completions: number;
    percentage: number;
    is_on_track: boolean;
}

// Daily stats for graph
export interface GoalDailyStat {
    user_id: string;
    user_name: string;
    day_date: string;
    completion_count: number;
    has_photo: boolean;
}

// Message types for group chat
export interface Message {
    id: string;
    group_id: string;
    user_id: string;
    content: string;
    message_type: 'text' | 'image' | 'system';
    image_url: string | null;
    created_at: string;
}

export interface MessageWithProfile extends Message {
    user: Profile;
}

// Activity log types
export type ActivityEventType =
    | 'goal_completed'
    | 'goal_failed'
    | 'goal_created'
    | 'goal_deleted'
    | 'failure_logged'
    | 'debt_settled'
    | 'member_joined'
    | 'member_left'
    | 'group_created'
    | 'streak_achieved'
    | 'streak_broken'
    | 'comment_added';

export interface ActivityLog {
    id: string;
    group_id: string;
    user_id: string;
    event_type: ActivityEventType;
    related_id: string | null;
    related_type: string | null;
    metadata: Record<string, any>;
    created_at: string;
}

export interface ActivityLogWithProfile extends ActivityLog {
    user: Profile;
}

// Goal comments for peer encouragement
export interface GoalComment {
    id: string;
    completion_id: string;
    user_id: string;
    content: string;
    created_at: string;
}

export interface GoalCommentWithProfile extends GoalComment {
    user: Profile;
}

// User badges/achievements
export type BadgeType =
    | 'first_completion'
    | 'week_streak'
    | 'month_streak'
    | 'perfect_week'
    | 'perfect_month'
    | 'top_performer'
    | 'consistency_king'
    | 'early_bird'
    | 'night_owl';

export interface UserBadge {
    id: string;
    user_id: string;
    group_id: string;
    badge_type: BadgeType;
    earned_at: string;
    metadata: Record<string, any>;
}

// Goal templates
export interface GoalTemplate {
    id: string;
    name: string;
    description: string | null;
    emoji: string;
    category: GoalCategory;
    goal_type: string;
    goal_mode: 'positive' | 'negative';
    suggested_frequency_days: number;
    suggested_target_per_week: number | null;
    suggested_penalty: number;
    is_featured: boolean;
    usage_count: number;
    created_at: string;
}

// Leaderboard entry
export interface LeaderboardEntry {
    user_id: string;
    user_name: string;
    avatar_url: string | null;
    completions_count: number;
    streak_days: number;
    failure_count: number;
    score: number;
}

// Streak update result
export interface StreakUpdateResult {
    success: boolean;
    new_streak: number;
    longest_streak: number;
    streak_continued: boolean;
    error?: string;
}
