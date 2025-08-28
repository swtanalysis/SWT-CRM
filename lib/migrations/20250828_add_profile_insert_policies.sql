-- Add insert policies for profiles and user_activity so bootstrap + logging work
create policy if not exists "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);
create policy if not exists "activity_self_insert" on public.user_activity for insert with check (auth.uid() = user_id);
