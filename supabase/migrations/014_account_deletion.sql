-- ============================================================================
-- MIGRATION 014: Account deletion
--
-- Google Play requires any app that lets users create an account to offer
-- in-app account deletion. Do It Mate had none, which also made an honest
-- answer to the Data safety "can users request deletion?" question impossible.
--
-- A plain `DELETE FROM auth.users` does not work here: profiles.id references
-- auth.users with NO ACTION, and goals.created_by, groups.created_by,
-- group_members.user_id and transactions.from_user_id / to_user_id all
-- reference profiles without ON DELETE CASCADE. Deleting therefore has to walk
-- the graph in dependency order.
--
-- Group ownership is transferred rather than destroyed: deleting the person who
-- happened to create a group must not wipe out everyone else's history.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_group RECORD;
    v_new_owner UUID;
    v_groups_deleted INT := 0;
    v_groups_transferred INT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Groups this user created. Hand them over if anyone else is still a
    --    member; only delete a group when it would otherwise be orphaned.
    FOR v_group IN
        SELECT id FROM groups WHERE created_by = v_user_id
    LOOP
        SELECT gm.user_id INTO v_new_owner
        FROM group_members gm
        WHERE gm.group_id = v_group.id
          AND gm.user_id <> v_user_id
        ORDER BY gm.joined_at ASC
        LIMIT 1;

        IF v_new_owner IS NULL THEN
            -- Nobody left to own it. Cascades clear goals, messages,
            -- activity_log, user_badges and notification_outbox.
            DELETE FROM transactions WHERE group_id = v_group.id;
            DELETE FROM group_members WHERE group_id = v_group.id;
            DELETE FROM groups WHERE id = v_group.id;
            v_groups_deleted := v_groups_deleted + 1;
        ELSE
            UPDATE groups SET created_by = v_new_owner WHERE id = v_group.id;
            -- Goals they authored survive under the new owner, so the group's
            -- tracking history stays intact for the remaining members.
            UPDATE goals SET created_by = v_new_owner
            WHERE group_id = v_group.id AND created_by = v_user_id;
            v_groups_transferred := v_groups_transferred + 1;
        END IF;
    END LOOP;

    -- 2. Goals this user created in groups they did not own. No one to hand
    --    these to, so remove them (cascades completions and comments).
    DELETE FROM goals WHERE created_by = v_user_id;

    -- 3. Money owed in either direction. Settle counterparties first so the
    --    remaining members' balances stay consistent after the transactions
    --    are removed: a pending debt the departed user owed is voided (the
    --    creditor's phantom credit is reversed), and a pending debt owed TO
    --    the departed user is written off (the debtor's phantom debit is
    --    reversed).
    UPDATE group_members gm SET current_balance = gm.current_balance - t.amount
    FROM transactions t
    WHERE t.from_user_id = v_user_id
      AND t.to_user_id = gm.user_id
      AND t.group_id = gm.group_id
      AND t.status = 'pending';

    UPDATE group_members gm SET current_balance = gm.current_balance + t.amount
    FROM transactions t
    WHERE t.to_user_id = v_user_id
      AND t.from_user_id = gm.user_id
      AND t.group_id = gm.group_id
      AND t.status = 'pending';

    DELETE FROM transactions
    WHERE from_user_id = v_user_id OR to_user_id = v_user_id;

    -- 4. Memberships.
    DELETE FROM group_members WHERE user_id = v_user_id;

    -- 5. Everything else referencing profiles cascades from here
    --    (activity_log, goal_completions, goal_comments, goal_failures,
    --     messages, push_tokens, user_badges, notification_outbox).
    DELETE FROM profiles WHERE id = v_user_id;

    -- 6. Finally the auth record itself, which is what actually revokes access.
    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN json_build_object(
        'deleted', true,
        'groups_deleted', v_groups_deleted,
        'groups_transferred', v_groups_transferred
    );
END;
$function$;


-- Only the signed-in user can invoke it, and it only ever acts on auth.uid(),
-- so there is no way to aim it at somebody else's account.
REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;

-- Storage cleanup: proof photos and avatars are keyed by user id, so remove
-- any objects owned by the departing user.
CREATE OR REPLACE FUNCTION delete_my_storage_objects()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    DELETE FROM storage.objects
    WHERE bucket_id IN ('avatars', 'proof-photos')
      AND owner = v_user_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION delete_my_storage_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_storage_objects() TO authenticated;
