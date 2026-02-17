-- Run this in the Supabase SQL Editor

-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  is_pro boolean default false,
  is_trial boolean default false,
  trial_start timestamp with time zone
);

-- Create a table for blueprints
create table blueprints (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  blueprint jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;
alter table blueprints enable row level security;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Users can view own blueprints" on blueprints for select using (auth.uid() = user_id);
create policy "Users can insert own blueprints" on blueprints for insert with check (auth.uid() = user_id);
create policy "Users can delete own blueprints" on blueprints for delete using (auth.uid() = user_id);

-- Optional: Function to handle new user signup automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
