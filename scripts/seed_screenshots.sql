-- Do It Mate — screenshot seed data (QA account Alex + Brenda, Gym Squad)
DO $$
DECLARE
    v_alex uuid;
    v_brenda uuid;
    v_group uuid;
    v_gym uuid;
    v_sugar uuid;
    v_now timestamptz := now();
BEGIN
    SELECT id INTO v_alex FROM auth.users WHERE email = 'alex.qa.doitmate@gmail.com';
    SELECT id INTO v_brenda FROM auth.users WHERE email = 'brenda.qa.doitmate@gmail.com';

    -- Group
    INSERT INTO groups (name, description, default_penalty_amount, created_by)
    VALUES ('Gym Squad', '4 sessions a week, no excuses. Ledger settles every Friday.', 5, v_alex)
    RETURNING id INTO v_group;

    INSERT INTO group_members (group_id, user_id, current_balance, failure_count) VALUES
        (v_group, v_alex, 10, 0),
        (v_group, v_brenda, -10, 2);

    -- Goals
    INSERT INTO goals (group_id, name, emoji, description, goal_type, goal_mode, frequency_days, penalty_amount, created_by, category)
    VALUES (v_group, 'Morning Gym', '💪', 'Hit the gym before 9AM — 4x per week', 'frequency', 'positive', 1, 5, v_alex, 'fitness')
    RETURNING id INTO v_gym;

    INSERT INTO goals (group_id, name, emoji, description, goal_type, goal_mode, frequency_days, penalty_amount, created_by, category)
    VALUES (v_group, 'No Sugar', '🍬', 'Zero added sugar. Slip up, you pay.', 'frequency', 'negative', 1, 5, v_alex, 'health')
    RETURNING id INTO v_sugar;

    -- Alex: completed Morning Gym the last 5 days (streak 5)
    INSERT INTO goal_completions (goal_id, user_id, occurrence_count, completed_at) VALUES
        (v_gym, v_alex, 1, v_now - interval '5 days'),
        (v_gym, v_alex, 1, v_now - interval '4 days'),
        (v_gym, v_alex, 1, v_now - interval '3 days'),
        (v_gym, v_alex, 1, v_now - interval '2 days'),
        (v_gym, v_alex, 1, v_now - interval '1 day');

    -- Brenda: completed 3 of the last 5 days (streak 3)
    INSERT INTO goal_completions (goal_id, user_id, occurrence_count, completed_at) VALUES
        (v_gym, v_brenda, 1, v_now - interval '5 days'),
        (v_gym, v_brenda, 1, v_now - interval '3 days'),
        (v_gym, v_brenda, 1, v_now - interval '1 day');

    -- Brenda failed 2 days -> owes Alex 2 x €5 (pending)
    INSERT INTO goal_failures (goal_id, user_id, deadline_date, penalty_applied) VALUES
        (v_gym, v_brenda, (v_now - interval '4 days')::date, 5),
        (v_gym, v_brenda, (v_now - interval '2 days')::date, 5);

    INSERT INTO transactions (group_id, from_user_id, to_user_id, amount, description, status) VALUES
        (v_group, v_brenda, v_alex, 5, 'Missed goal: 💪 Morning Gym (due ' || (v_now - interval '4 days')::date || ')', 'pending'),
        (v_group, v_brenda, v_alex, 5, 'Missed goal: 💪 Morning Gym (due ' || (v_now - interval '2 days')::date || ')', 'pending');

    -- Streak field (trigger may not run on backdated inserts; set explicitly)
    UPDATE goals SET current_streak = 5 WHERE id = v_gym;
END $$;
