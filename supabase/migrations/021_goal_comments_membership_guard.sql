-- ============================================================================
-- MIGRATION 021: goal_comments membership guard (red-team cycle 3)
--
-- Finding: the INSERT policy on goal_comments only checks
--   WITH CHECK ( user_id = auth.uid() )
-- It never verifies the commenter is a MEMBER of the group that owns the
-- completion. Any authenticated user who can guess/enumerate a completion_id
-- can write comments into groups they don't belong to (the SELECT side IS
-- properly scoped, so they wouldn't see replies — a one-way spam/tamper
-- channel). The client hook (useGoalComments) is used from group screens
-- where membership is implied, so tightening the policy breaks no legit flow.
--
-- Fix: INSERT requires auth.uid() = user_id AND the completion's goal belongs
-- to a group where the writer is a member — same shape as the hardened
-- messages INSERT policy from migration 010.
--
-- Idempotent; re-asserts the correct SELECT/DELETE policies too so the whole
-- table converges on one guarded set regardless of apply order.
-- ============================================================================

DROP POLICY IF EXISTS "Group members can view comments" ON public.goal_comments;
CREATE POLICY "Group members can view comments"
  ON public.goal_comments FOR SELECT
  TO authenticated
  USING (
    completion_id IN (
      SELECT id FROM public.goal_completions
      WHERE goal_id IN (
        SELECT id FROM public.goals
        WHERE group_id IN (SELECT get_my_group_ids())
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.goal_comments;
CREATE POLICY "Authenticated users can add comments"
  ON public.goal_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND completion_id IN (
      SELECT id FROM public.goal_completions
      WHERE goal_id IN (
        SELECT id FROM public.goals
        WHERE group_id IN (SELECT get_my_group_ids())
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.goal_comments;
CREATE POLICY "Users can delete their own comments"
  ON public.goal_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
