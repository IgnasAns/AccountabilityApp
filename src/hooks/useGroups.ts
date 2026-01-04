import { useEffect, useState, useCallback } from 'react';
import { supabase, getNetBalance } from '../services/supabase';
import { useAuth } from './useAuth';
import { Group, GroupMember, GroupMemberWithProfile, GroupBalance } from '../types/database';

export function useGroups() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
    const [netBalance, setNetBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGroups = useCallback(async () => {
        if (!user) return;

        // Guest mode support
        if (user.id === 'guest_user_id') {
            setLoading(false);
            setGroups([]);
            setGroupBalances([]);
            setNetBalance(0);
            return;
        }

        let isMounted = true;

        // Longer timeout to see actual error
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('REQUEST TIMED OUT after 60 seconds')), 60000)
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
              groups (*)
            `)
                    .eq('user_id', user.id);

                if (memberError) {
                    throw memberError;
                }

                // Safe casting for the joined data
                const memberData = data as unknown as (GroupMember & { groups: Group })[];

                const groupsData = memberData?.map((m) => m.groups).filter(Boolean) || [];
                const balances = memberData?.map((m) => ({
                    group: m.groups,
                    balance: m.current_balance,
                })).filter((b) => b.group) || [];


                // Fetch net balance
                const net = await getNetBalance();

                return { groupsData, balances, net };
            };

            // Race against timeout
            const result: any = await Promise.race([fetchData(), timeoutPromise]);

            if (isMounted) {
                setGroups(result.groupsData);
                setGroupBalances(result.balances);
                setNetBalance(result.net);
            }

        } catch (err: any) {
            if (isMounted) {
                console.error('Error fetching groups:', err);
                // Check for generic Supabase "fetch failed" to give better advice
                if (err.message === 'Network request failed' || err.message?.includes('timed out')) {
                    setError('Connection timed out. Check your network.');
                } else if (err.message && err.message.includes('infinite recursion')) {
                    setError('Database Setup Incomplete. Run the SQL script from supabase/schema.sql in your Supabase Dashboard.');
                } else {
                    setError(err.message || 'Failed to load groups');
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

    async function createGroup(name: string, description?: string, penaltyAmount?: number) {
        if (!user) throw new Error('Not authenticated');

        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert({
                name,
                description,
                default_penalty_amount: penaltyAmount || 1.0,
                created_by: user.id,
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
                throw new Error(`You owe €${Math.abs(balance).toFixed(2)} to other members. Please settle your debts before leaving.`);
            } else {
                throw new Error(`Other members owe you €${balance.toFixed(2)}. Please have them settle before you leave.`);
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

    return {
        groups,
        groupBalances,
        netBalance,
        loading,
        error,
        createGroup,
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
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching group detail:', err);
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
