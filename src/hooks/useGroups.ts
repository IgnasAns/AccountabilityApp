import { useEffect, useState, useCallback } from 'react';
import { supabase, getNetBalance } from '../services/supabase';
import { useAuth } from './useAuth';
import { Group, GroupMember, GroupMemberWithProfile, GroupBalance } from '../types/database';
import { DEFAULT_PAGE_SIZE, REQUEST_TIMEOUT_MS, CURRENCY_SYMBOL } from '../constants';

export function useGroups() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
    const [netBalance, setNetBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGroups = useCallback(async () => {
        if (!user) return;

        let isMounted = true;

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('REQUEST TIMED OUT')), REQUEST_TIMEOUT_MS)
        );

        try {
            setLoading(true);
            setError(null);


            // Fetch groups logic wrapped in logic to ensure we don't set state if unmounted
            const fetchData = async () => {
                const startTime = Date.now();

                // Fetch groups the user is a member of
                const { data, error: memberError } = await supabase
                    .from('group_members')
                    .select(`
              group_id,
              current_balance,
              groups (
                  *,
                  group_members (
                      profiles (
                          avatar_url
                      )
                  )
              )
            `)
                    .eq('user_id', user.id);

                if (memberError) {
                    throw memberError;
                }

                // Safe casting for the joined data
                const memberData = data as unknown as (GroupMember & { groups: Group & { group_members: { profiles: { avatar_url: string } }[] } })[];

                const groupsData = memberData?.map((m) => m.groups).filter(Boolean) || [];
                const balances = memberData?.map((m) => {
                    const rawGroup = m.groups;
                    // Extract avatars (max 3)
                    const memberAvatars = rawGroup.group_members
                        ?.map((gm: { profiles: { avatar_url: string | null } | null }) => gm.profiles?.avatar_url)
                        .filter((url: string | null | undefined): url is string => typeof url === 'string') || [];

                    return {
                        group: rawGroup,
                        balance: m.current_balance,
                        memberAvatars
                    };
                }).filter((b) => b.group) || [];


                // Fetch net balance
                const net = await getNetBalance();

                return { groupsData, balances, net };
            };

            // Race against timeout; one quiet retry covers cold starts / slow
            // first paint before we surface the error banner.
            let result: Awaited<ReturnType<typeof fetchData>>;
            try {
                result = await Promise.race([fetchData(), timeoutPromise]) as Awaited<ReturnType<typeof fetchData>>;
            } catch (firstErr) {
                result = await Promise.race([fetchData(), timeoutPromise]) as Awaited<ReturnType<typeof fetchData>>;
            }

            if (isMounted) {
                setGroups(result.groupsData);
                setGroupBalances(result.balances);
                setNetBalance(result.net);
            }

        } catch (err: unknown) {
            if (isMounted) {
                const message = err instanceof Error ? err.message : String(err);
                if (message === 'Network request failed' || message.includes('timed out')) {
                    setError('Connection timed out. Check your network.');
                } else if (message.includes('infinite recursion')) {
                    setError('Database Setup Incomplete. Run the SQL script from supabase/schema.sql in your Supabase Dashboard.');
                } else {
                    setError(message || 'Failed to load groups');
                }
            }
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }

        return () => { isMounted = false; };
    }, [user]);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    async function createGroup(name: string, description?: string, penaltyAmount?: number, imageUrl?: string) {
        if (!user) throw new Error('Not authenticated');

        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert({
                name,
                description,
                default_penalty_amount: penaltyAmount || 1.0,
                created_by: user.id,
                image_url: imageUrl || null,
            })
            .select()
            .single();

        if (groupError) throw groupError;

        // Add creator as a member
        const { error: memberError } = await supabase
            .from('group_members')
            .insert({
                group_id: group.id,
                user_id: user.id,
            });

        if (memberError) throw memberError;

        await fetchGroups();
        return group;
    }

    async function joinGroup(inviteCode: string) {
        const { data, error } = await supabase.rpc('join_group_by_code', {
            p_invite_code: inviteCode,
        });

        if (error) throw error;
        if (!data) throw new Error('Failed to join group');
        if (!data.success) throw new Error(data.error || 'Failed to join group');

        await fetchGroups();
        return data;
    }

    async function leaveGroup(groupId: string) {
        if (!user) throw new Error('Not authenticated');

        // Check if user has unsettled balance
        const { data: memberData, error: memberCheckError } = await supabase
            .from('group_members')
            .select('current_balance')
            .eq('group_id', groupId)
            .eq('user_id', user.id)
            .single();

        if (memberCheckError) throw memberCheckError;

        if (memberData && memberData.current_balance !== 0) {
            const balance = memberData.current_balance;
            if (balance < 0) {
                throw new Error(`You owe ${CURRENCY_SYMBOL}${Math.abs(balance).toFixed(2)} to other members. Please settle your debts before leaving.`);
            } else {
                throw new Error(`Other members owe you ${CURRENCY_SYMBOL}${balance.toFixed(2)}. Please have them settle before you leave.`);
            }
        }

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id);

        if (error) throw error;
        await fetchGroups();
    }

    async function deleteGroup(groupId: string) {
        if (!user) throw new Error('Not authenticated');

        // First, check if user is the creator
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('created_by')
            .eq('id', groupId)
            .single();

        if (groupError) throw groupError;
        if (group.created_by !== user.id) {
            throw new Error('Only the group creator can delete this group');
        }

        // Delete all transactions in the group
        const { error: txError } = await supabase
            .from('transactions')
            .delete()
            .eq('group_id', groupId);

        if (txError) throw txError;

        // Delete all group members
        const { error: memberError } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId);

        if (memberError) throw memberError;

        // Delete the group itself
        const { error: deleteError } = await supabase
            .from('groups')
            .delete()
            .eq('id', groupId);

        if (deleteError) throw deleteError;

        await fetchGroups();
    }

    async function updateGroup(groupId: string, updates: Partial<Pick<Group, 'name' | 'description' | 'default_penalty_amount' | 'image_url'>>) {
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
            .from('groups')
            .update(updates)
            .eq('id', groupId);

        if (error) throw error;
        await fetchGroups();
    }

    return {
        groups,
        groupBalances,
        netBalance,
        loading,
        error,
        createGroup,
        updateGroup,
        joinGroup,
        leaveGroup,
        deleteGroup,
        refetch: fetchGroups,
    };
}

export function useGroupDetail(groupId: string) {
    const { user } = useAuth();
    const [group, setGroup] = useState<Group | null>(null);
    const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGroupDetail = useCallback(async () => {
        if (!groupId) return;

        try {
            setLoading(true);
            setError(null);

            // Fetch group details
            const { data: groupData, error: groupError } = await supabase
                .from('groups')
                .select('*')
                .eq('id', groupId)
                .single();

            if (groupError) throw groupError;
            setGroup(groupData);

            // Fetch members with profiles
            const { data: membersData, error: membersError } = await supabase
                .from('group_members')
                .select(`
          *,
          profile:profiles (*)
        `)
                .eq('group_id', groupId)
                .order('failure_count', { ascending: false });

            if (membersError) throw membersError;

            // Supabase returns the joined data, which we assert to our defined type
            setMembers(membersData as unknown as GroupMemberWithProfile[] || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load group details');
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => {
        fetchGroupDetail();
    }, [fetchGroupDetail]);

    return {
        group,
        members,
        loading,
        error,
        refetch: fetchGroupDetail,
    };
}
