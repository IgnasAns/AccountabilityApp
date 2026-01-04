-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Create Tables (Order by dependency)

-- Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  name text not null,
  avatar_url text,
  payment_link text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groups Table
create table if not exists public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  default_penalty_amount numeric not null default 5.00,
  invite_code text unique default encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  created_by uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Group Members Table
create table if not exists public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) not null,
  user_id uuid references public.profiles(id) not null,
  current_balance numeric default 0 not null,
  failure_count integer default 0 not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(group_id, user_id)
);

-- Transactions Table
create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) not null,
  from_user_id uuid references public.profiles(id) not null,
  to_user_id uuid references public.profiles(id) not null,
  amount numeric not null,
  status text check (status in ('pending', 'paid')) default 'pending' not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  settled_at timestamp with time zone
);

-- 2. Enable RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.transactions enable row level security;

-- Helper function to avoid RLS recursion
create or replace function get_my_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from group_members where user_id = auth.uid();
$$;

-- Profiles Policies
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile." on public.profiles;
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update own profile." on public.profiles;
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Groups Policies
drop policy if exists "Groups are viewable by members." on public.groups;
create policy "Groups are viewable by members."
  on groups for select
  using (
    id in ( select get_my_group_ids() )
  );

drop policy if exists "Authenticated users can create groups." on public.groups;
create policy "Authenticated users can create groups."
  on groups for insert
  to authenticated
  with check (true);

-- Group Members Policies
drop policy if exists "Members can view other members in the same group." on public.group_members;
create policy "Members can view other members in the same group."
  on group_members for select
  using (
    group_id in ( select get_my_group_ids() )
  );

-- Transactions Policies
drop policy if exists "Users can view transactions involving them or their groups." on public.transactions;
create policy "Users can view transactions involving them or their groups."
  on transactions for select
  using (
    from_user_id = auth.uid() 
    or to_user_id = auth.uid()
    or group_id in ( select get_my_group_ids() )
  );

-- 4. RPC Functions

-- Function: join_group_by_code
create or replace function join_group_by_code(p_invite_code text)
returns json
language plpgsql
security definer
as $$
declare
  v_group_id uuid;
  v_user_id uuid;
  v_already_member boolean;
begin
  v_user_id := auth.uid();
  
  -- Find group
  select id into v_group_id from public.groups where invite_code = p_invite_code;
  
  if v_group_id is null then
    return json_build_object('success', false, 'error', 'Invalid invite code');
  end if;

  -- Check membership
  select exists(select 1 from public.group_members where group_id = v_group_id and user_id = v_user_id)
  into v_already_member;

  if v_already_member then
    return json_build_object('success', false, 'error', 'Already a member');
  end if;

  -- Add to group
  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id);

  return json_build_object('success', true, 'group_id', v_group_id);
end;
$$;

-- Function: log_failure
create or replace function log_failure(p_group_id uuid, p_description text)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_penalty numeric;
  v_member_count integer;
  v_member record;
  v_tx_count integer := 0;
begin
  v_user_id := auth.uid();
  
  -- Get penalty amount
  select default_penalty_amount into v_penalty from public.groups where id = p_group_id;
  
  -- Update failure count
  update public.group_members 
  set failure_count = failure_count + 1,
      current_balance = current_balance - v_penalty
  where group_id = p_group_id and user_id = v_user_id;

  -- Find other members to pay
  for v_member in select user_id from public.group_members where group_id = p_group_id and user_id != v_user_id loop
    insert into public.transactions (group_id, from_user_id, to_user_id, amount, description)
    values (p_group_id, v_user_id, v_member.user_id, v_penalty, p_description);
    
    -- Update recipient balance
    update public.group_members
    set current_balance = current_balance + v_penalty
    where group_id = p_group_id and user_id = v_member.user_id;
    
    v_tx_count := v_tx_count + 1;
  end loop;

  return json_build_object('success', true, 'transactions_created', v_tx_count, 'total_debt', v_penalty * v_tx_count);
end;
$$;

-- Function: get_net_balance
create or replace function get_net_balance()
returns numeric
language sql
security definer
as $$
  select coalesce(sum(current_balance), 0)
  from public.group_members
  where user_id = auth.uid();
$$;

-- Function: settle_debt
create or replace function settle_debt(p_transaction_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_tx record;
begin
  select * into v_tx from public.transactions where id = p_transaction_id;
  
  if v_tx.status = 'paid' then
     return json_build_object('success', false, 'error', 'Already paid');
  end if;

  -- Mark as paid
  update public.transactions
  set status = 'paid', settled_at = now()
  where id = p_transaction_id;

  -- Adjust balances (reverse the debt)
  -- Payer (from_user) gets balance increase (less negative)
  update public.group_members
  set current_balance = current_balance + v_tx.amount
  where group_id = v_tx.group_id and user_id = v_tx.from_user_id;

  -- Payee (to_user) gets balance decrease (less positive)
  update public.group_members
  set current_balance = current_balance - v_tx.amount
  where group_id = v_tx.group_id and user_id = v_tx.to_user_id;

  return json_build_object('success', true);
end;
$$;

-- 5. User Management Triggers
-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'name', null);
  return new;
end;
$$;

-- Trigger to automatically create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- DEV ONLY: Auto-confirm email to skip verification step
create or replace function public.auto_confirm_email()
returns trigger as $$
begin
  new.email_confirmed_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_confirm on auth.users;
create trigger on_auth_user_created_confirm
  before insert on auth.users
  for each row execute procedure public.auto_confirm_email();
