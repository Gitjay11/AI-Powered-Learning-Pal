
-- Roles enum + table
create type public.app_role as enum ('student', 'teacher');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users view own roles" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  selected_track_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "View own profile" on public.profiles
for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "Update own profile" on public.profiles
for update to authenticated using (id = auth.uid());
create policy "Insert own profile" on public.profiles
for insert to authenticated with check (id = auth.uid());

-- Tracks
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  category text not null,
  created_at timestamptz not null default now()
);
alter table public.tracks enable row level security;
create policy "Tracks readable" on public.tracks for select to authenticated using (true);

-- Lessons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid references public.tracks(id) on delete cascade not null,
  order_index int not null,
  title text not null,
  content text not null,
  concept_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (track_id, order_index)
);
alter table public.lessons enable row level security;
create policy "Lessons readable" on public.lessons for select to authenticated using (true);

-- Student progress
create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade not null,
  status text not null default 'in_progress', -- in_progress | completed | struggling
  score int not null default 0,
  attempts int not null default 0,
  last_attempted_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
alter table public.student_progress enable row level security;
create policy "Student own progress" on public.student_progress
for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "Student insert own progress" on public.student_progress
for insert to authenticated with check (student_id = auth.uid());
create policy "Student update own progress" on public.student_progress
for update to authenticated using (student_id = auth.uid());

-- Chat messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete cascade,
  role text not null, -- user | assistant
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "Chat student or teacher select" on public.chat_messages
for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "Chat student insert" on public.chat_messages
for insert to authenticated with check (student_id = auth.uid());

-- Flags
create table public.flags (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade not null,
  lesson_id uuid references public.lessons(id) on delete set null,
  concept text not null,
  reason text not null,
  severity text not null default 'medium',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.flags enable row level security;
create policy "Flags select" on public.flags
for select to authenticated using (student_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "Flags insert by student" on public.flags
for insert to authenticated with check (student_id = auth.uid());
create policy "Flags update by teacher" on public.flags
for update to authenticated using (public.has_role(auth.uid(), 'teacher'));

-- Teacher notes
create table public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users(id) on delete cascade not null,
  student_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.teacher_notes enable row level security;
create policy "Notes select by owner or student" on public.teacher_notes
for select to authenticated using (teacher_id = auth.uid() or student_id = auth.uid() or public.has_role(auth.uid(), 'teacher'));
create policy "Notes insert by teacher" on public.teacher_notes
for insert to authenticated with check (public.has_role(auth.uid(), 'teacher') and teacher_id = auth.uid());

-- Trigger: create profile + student role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
