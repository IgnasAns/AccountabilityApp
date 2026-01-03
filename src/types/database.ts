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
                    created_by: string;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    name?: string;
                    description?: string | null;
                    default_penalty_amount?: number;
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
                Args: { p_group_id: string; p_description: string | null };
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
}
