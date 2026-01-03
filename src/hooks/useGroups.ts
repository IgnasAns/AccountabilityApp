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

        try {
            setLoading(true);
            setError(null);

            // Fetch groups the user is a member of
            const { data: memberData, error: memberError } = await supabase
                .from('group_members')
                .select(`
          group_id,
          current_balance,
          groups (*)
        `)
                .eq('user_id', user.id);

            if (memberError) throw memberError;

            const groupsData = memberData?.map((m: any) => m.groups).filter(Boolean) || [];
            const balances = memberData?.map((m: any) => ({
                group: m.groups,
                balance: m.current_balance,
            })).filter((b: any) => b.group) || [];

            setGroups(groupsData);
            setGroupBalances(balances);

            // Fetch net balance
            const net = await getNetBalance();
            setNetBalance(net);
        } catch (err: any) {
            setError(err.message);
            console.error('Error fetching groups:', err);
        } finally {
            setLoading(false);
        }
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

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id);

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
        joinGroup,
        leaveGroup,
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
            setMembers(membersData as any || []);
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
