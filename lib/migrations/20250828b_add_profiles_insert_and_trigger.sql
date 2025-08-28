-- Add missing insert policy for profiles and automatic bootstrap trigger
-- Safe to run multiple times (IF NOT EXISTS guards where possible)

-- Insert policy (allows a user to insert their own profile row)
create policy if not exists "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);

-- Activity insert policy already added separately, ensure present
create policy if not exists "activity_self_insert" on public.user_activity for insert with check (auth.uid() = user_id);

-- Automatic profile creation trigger (server-side) so UI no longer needs to insert directly
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Only insert if profile row absent
  insert into public.profiles (id, display_name, first_name, timezone, locale, currency, theme)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'display_name', new.email),
          split_part(coalesce(new.raw_user_meta_data->>'first_name', new.email), '@', 1),
          'UTC', 'en-US', 'USD', 'system')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger on auth.users (fires after signup)
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
