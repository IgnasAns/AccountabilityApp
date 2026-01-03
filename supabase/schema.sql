-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  payment_link text,
  updated_at timestamp with time zone,
  constraint username_length check (char_length(name) >= 3)
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- GROUPS
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  default_penalty_amount numeric not null default 1.00,
  invite_code text unique not null,
  created_by uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.groups enable row level security;

create policy "Groups are viewable by members"
  on groups for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Anyone can create a group"
  on groups for insert
  with check ( auth.uid() = created_by );

-- GROUP MEMBERS
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) not null,
  user_id uuid references public.profiles(id) not null,
  current_balance numeric default 0 not null,
  failure_count integer default 0 not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Members can view other members in their group"
  on group_members for select
  using (
    exists (
      select 1 from public.group_members as my_membership
      where my_membership.group_id = group_members.group_id
      and my_membership.user_id = auth.uid()
    )
  );

create policy "Users can join groups"
  on group_members for insert
  with check ( auth.uid() = user_id );

-- TRANSACTIONS (Debts)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) not null,
  from_user_id uuid references public.profiles(id) not null,
  to_user_id uuid references public.profiles(id) not null,
  amount numeric not null,
  description text,
  status text default 'pending' check (status in ('pending', 'paid', 'settled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.transactions enable row level security;

create policy "Members can view transactions in their group"
  on transactions for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = transactions.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Members can create transactions (logging failure)"
  on transactions for insert
  with check (
    auth.uid() = from_user_id 
    and exists (
      select 1 from public.group_members
      where group_members.group_id = transactions.group_id
      and group_members.user_id = auth.uid()
    )
  );

create policy "Users can update transactions they are involved in"
  on transactions for update
  using (
    auth.uid() = from_user_id or auth.uid() = to_user_id
  );

-- FUNCTIONS

-- Function to handle new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to handle joining a group via code
create or replace function public.join_group_by_code(p_invite_code text)
returns json as $$
declare
  target_group_id uuid;
  group_data record;
begin
  -- Find group
  select id, name, default_penalty_amount into group_data
  from public.groups
  where invite_code = p_invite_code;

  if group_data.id is null then
    raise exception 'Invalid invite code';
  end if;

  target_group_id := group_data.id;

  -- Check if already member
  if exists (
    select 1 from public.group_members
    where group_id = target_group_id
    and user_id = auth.uid()
  ) then
    raise exception 'You are already a member of this group';
  end if;

  -- Insert member
  insert into public.group_members (group_id, user_id)
  values (target_group_id, auth.uid());

  return json_build_object(
    'group_id', target_group_id,
    'group_name', group_data.name
  );
end;
$$ language plpgsql security definer;

-- Function to log a failure and distribute debt
create or replace function public.log_failure(p_group_id uuid, p_description text)
returns json as $$
declare
  v_penalty_amount numeric;
  v_member record;
  v_transaction_count integer := 0;
  v_total_debt numeric := 0;
begin
  -- Get penalty amount
  select default_penalty_amount into v_penalty_amount
  from public.groups
  where id = p_group_id;

  -- Update failure count and balance for the failing user
  update public.group_members
  set failure_count = failure_count + 1,
      current_balance = current_balance - (v_penalty_amount * (select count(*) - 1 from public.group_members where group_id = p_group_id))
  where group_id = p_group_id and user_id = auth.uid();

  -- Loop through other members to create debts
  for v_member in 
    select user_id from public.group_members 
    where group_id = p_group_id and user_id != auth.uid()
  loop
    -- Create transaction (debt)
    insert into public.transactions (group_id, from_user_id, to_user_id, amount, description)
    values (p_group_id, auth.uid(), v_member.user_id, v_penalty_amount, p_description);
    
    -- Update other member's balance (they gain credit)
    update public.group_members
    set current_balance = current_balance + v_penalty_amount
    where group_id = p_group_id and user_id = v_member.user_id;

    v_transaction_count := v_transaction_count + 1;
    v_total_debt := v_total_debt + v_penalty_amount;
  end loop;

  return json_build_object(
    'transactions_created', v_transaction_count,
    'total_debt', v_total_debt
  );
end;
$$ language plpgsql security definer;

-- Function to get net balance across all groups
create or replace function public.get_net_balance()
returns numeric as $$
declare
  v_balance numeric;
begin
  select coalesce(sum(current_balance), 0) into v_balance
  from public.group_members
  where user_id = auth.uid();
  
  return v_balance;
end;
$$ language plpgsql security definer;

-- Function to settle a debt
create or replace function public.settle_debt(p_transaction_id uuid)
returns boolean as $$
declare
  v_transaction record;
begin
  -- Get transaction
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id;

  if v_transaction Is null then
    raise exception 'Transaction not found';
  end if;

  -- Verify user is involved and it's not already settled
  if (v_transaction.from_user_id != auth.uid() and v_transaction.to_user_id != auth.uid()) then
     raise exception 'Not authorized';
  end if;

  if v_transaction.status = 'settled' then
     raise exception 'Already settled';
  end if;

  -- Mark as settled
  update public.transactions
  set status = 'settled'
  where id = p_transaction_id;

  -- Update balances
  -- The debtor (from_user) PAYS back, so their balance INCREASES (becomes less negative)
  -- The creditor (to_user) RECEIVES payment, so their balance DECREASES (becomes less positive) -> Wait, balance is "what I am owed - what I owe"
  -- If I have balance -5, I owe 5. If I pay 5, balance becomes 0. So +5. Correct.
  -- If I have balance +5, I am owed 5. If I get paid 5, balance becomes 0. So -5. Correct.

  update public.group_members
  set current_balance = current_balance + v_transaction.amount
  where group_id = v_transaction.group_id and user_id = v_transaction.from_user_id;

  update public.group_members
  set current_balance = current_balance - v_transaction.amount
  where group_id = v_transaction.group_id and user_id = v_transaction.to_user_id;

  return true;
end;
$$ language plpgsql security definer;
