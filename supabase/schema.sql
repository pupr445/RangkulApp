-- =========================================================
-- RANGKUL — Skema Database Awal (Supabase / PostgreSQL)
-- =========================================================
-- Jalankan file ini di Supabase SQL Editor, atau via:
--   npx supabase db push
--
-- Prinsip desain:
-- 1. Multi-tenant: setiap baris data operasional terikat ke satu
--    organization_id, diisolasi lewat Row Level Security (RLS).
-- 2. Multi-sektor: organizations.sector_type menentukan label default
--    (lihat lib/labels/sectors.ts) — TIDAK butuh tabel terpisah untuk
--    tiap sektor. label_overrides menyimpan kustomisasi manual per org.
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sector_type text not null default 'lainnya'
    check (sector_type in ('sekolah','klinik','bisnis','masjid','komunitas','lainnya')),
  -- Override manual label per organisasi. Contoh isi:
  -- { "managerRole": "Kepala Divisi", "taskLabel": "Aksi" }
  label_overrides jsonb default '{}'::jsonb,
  owner_id uuid references auth.users(id) on delete set null,
  plan text not null default 'komunitas'
    check (plan in ('komunitas','starter','growth','pro','scale','enterprise')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ORGANIZATION MEMBERS (role-based access control)
-- ---------------------------------------------------------
create table if not exists organization_members (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- role generik di level sistem; label tampilan (Guru/Dokter/Manager/dst.)
  -- diselesaikan di frontend lewat lib/labels/sectors.ts berdasarkan role ini
  role text not null default 'member' check (role in ('owner','manager','member')),
  full_name text,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ---------------------------------------------------------
-- SECTOR TEMPLATES (struktur default yang di-clone saat org baru dibuat)
-- ---------------------------------------------------------
create table if not exists sector_templates (
  id uuid primary key default uuid_generate_v4(),
  sector_type text not null,
  template_name text not null,
  -- struktur default tim/proyek/kolom kanban dalam bentuk JSON
  default_structure jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TEAMS  (disebut "Kelas" / "Poli" / "Tim" / "Kepengurusan" tergantung sektor)
-- ---------------------------------------------------------
create table if not exists teams (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PROJECTS  (disebut "Mata Pelajaran" / "Program Layanan" / "Proyek" dst.)
-- ---------------------------------------------------------
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TASKS  (disebut "Tugas/PR" / "Jadwal" / "Tugas" / "Kegiatan" dst.)
-- ---------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  tag text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- CUSTOM FIELDS  (field tambahan spesifik sektor, mis. nilai/rekam medis)
-- ---------------------------------------------------------
create table if not exists custom_fields (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity text not null check (entity in ('task','project','member')),
  field_key text not null,
  field_label text not null,
  field_type text not null default 'text' check (field_type in ('text','number','date','select')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- MESSAGES  (chat per tim/proyek)
-- ---------------------------------------------------------
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- ACTIVITY LOG (untuk laporan kinerja)
-- ---------------------------------------------------------
create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table teams enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table custom_fields enable row level security;
alter table messages enable row level security;
alter table activity_logs enable row level security;

-- Helper: apakah user saat ini anggota organisasi tsb?
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  )
  or exists (
    select 1 from organizations
    where id = org_id and owner_id = auth.uid()
  );
$$;

-- organizations: owner bisa CRUD, anggota bisa SELECT
create policy "org_select_member" on organizations
  for select using (is_org_member(id));
create policy "org_insert_owner" on organizations
  for insert with check (owner_id = auth.uid());
create policy "org_update_owner" on organizations
  for update using (owner_id = auth.uid());

-- Pola yang sama diterapkan ke seluruh tabel operasional:
-- anggota organisasi terkait boleh SELECT/INSERT/UPDATE,
-- data organisasi lain tidak akan pernah terlihat.
create policy "members_select" on organization_members
  for select using (is_org_member(organization_id));
create policy "members_insert_owner" on organization_members
  for insert with check (is_org_member(organization_id));

create policy "teams_all" on teams
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "projects_all" on projects
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "tasks_all" on tasks
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "custom_fields_all" on custom_fields
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "messages_all" on messages
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

create policy "activity_logs_select" on activity_logs
  for select using (is_org_member(organization_id));
create policy "activity_logs_insert" on activity_logs
  for insert with check (is_org_member(organization_id));

-- sector_templates bersifat publik/readonly (dikelola tim internal, bukan per-tenant)
alter table sector_templates enable row level security;
create policy "sector_templates_read_all" on sector_templates
  for select using (true);
