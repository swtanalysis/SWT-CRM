-- profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  middle_name text,
  last_name text,
  display_name text,
  phone text,
  avatar_url text,
  role text default 'agent' check (role in ('admin','agent','viewer')),
  timezone text default 'UTC',
  locale text default 'en-US',
  currency text default 'USD',
  date_format text default 'YYYY-MM-DD',
  theme text default 'system',
  default_view text default 'Dashboard',
  signature text,
  bio text,
  prefs jsonb default '{}'::jsonb,
  notification_prefs jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_metrics_daily (
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  bookings_count int default 0,
  revenue_sum numeric default 0,
  policies_count int default 0,
  avg_booking_value numeric default 0,
  tasks_completed int default 0,
  response_time_avg_ms int default 0,
  primary key (user_id, date)
);

create table if not exists public.user_activity (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb,
  created_at timestamptz default now()
);

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  hashed_key text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

-- RLS enable
alter table public.profiles enable row level security;
alter table public.user_metrics_daily enable row level security;
alter table public.user_activity enable row level security;
alter table public.user_api_keys enable row level security;

-- Basic policies (tighten later)
create policy "profiles_self_or_admin" on public.profiles for select using (auth.uid() = id or exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.role='admin'));
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "metrics_self_or_admin" on public.user_metrics_daily for select using (auth.uid() = user_id or exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.role='admin'));
create policy "activity_self_or_admin" on public.user_activity for select using (auth.uid() = user_id or exists (select 1 from public.profiles p2 where p2.id = auth.uid() and p2.role='admin'));
create policy "api_keys_owner" on public.user_api_keys for select using (auth.uid() = user_id);
create policy "api_keys_insert" on public.user_api_keys for insert with check (auth.uid() = user_id);
create policy "api_keys_update" on public.user_api_keys for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "api_keys_delete" on public.user_api_keys for delete using (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.touch_updated_at();
