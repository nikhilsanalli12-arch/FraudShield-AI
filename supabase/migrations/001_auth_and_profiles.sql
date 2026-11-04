-- ==============================================================================
-- FraudShield AI — Migration 001: Authentication, Profiles & Role Security
-- ==============================================================================

-- 1. Create Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null check (role in ('personal', 'analyst', 'admin')) default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for lookup performance
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- 3. RLS Policies: Minimum Required Access
-- Rule: Users can view only their own profile
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Rule: Users can update only their own profile (trigger ensures role cannot be altered)
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: No public INSERT or DELETE policy exists.
-- Inserts occur exclusively via trusted trigger on auth.users.
-- Deletes cascade from auth.users.

-- 4. Secure Profile Creation Trigger (Self-Escalation Defense)
-- Security Rule: Ignore any role supplied in registration metadata.
-- All public sign-ups strictly receive the 'personal' role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'personal', -- Hardcoded default: Cannot be overridden by client metadata
    now(),
    now()
  );
  return new;
end;
$$;

-- Drop trigger if exists then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Anti-Role-Tampering Trigger
-- Security Rule: Prevent non-service-role callers from modifying the 'role' column.
create or replace function public.prevent_profile_role_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If role is being changed
  if (new.role is distinct from old.role) then
    -- Check if caller is authenticated user (frontend client)
    if (auth.uid() is not null) and (coalesce(auth.jwt()->>'role', '') <> 'service_role') then
      raise exception 'Security Error: You do not have permission to modify your role.';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_prevent_profile_role_update on public.profiles;
create trigger trigger_prevent_profile_role_update
  before update on public.profiles
  for each row execute function public.prevent_profile_role_update();

-- Restrict function execution permissions
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.prevent_profile_role_update() from public;
