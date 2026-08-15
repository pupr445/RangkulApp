-- Migration 020 — Task Engine (Fase 2 Master Roadmap)
-- Subtask/Checklist, Task Dependency, Task Template, Task Watcher.

-- ---------------------------------------------------------
-- CHECKLIST / SUBTASK
-- ---------------------------------------------------------
create table if not exists task_checklist_items (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists task_checklist_items_task_idx on task_checklist_items (task_id, position);

alter table task_checklist_items enable row level security;

-- Akses checklist mengikuti akses ke task induknya (organisasi + tim),
-- pakai fungsi can_access_team yang sudah ada supaya konsisten dengan
-- RLS tasks itu sendiri — bukan aturan baru yang terpisah.
create policy "task_checklist_select" on task_checklist_items
  for select using (
    is_org_member(organization_id)
    and exists (
      select 1 from tasks t
      where t.id = task_checklist_items.task_id
        and can_access_team(t.organization_id, t.team_id)
    )
  );

create policy "task_checklist_insert" on task_checklist_items
  for insert with check (
    is_org_member(organization_id)
    and exists (
      select 1 from tasks t
      where t.id = task_checklist_items.task_id
        and can_access_team(t.organization_id, t.team_id)
    )
  );

create policy "task_checklist_update" on task_checklist_items
  for update using (
    is_org_member(organization_id)
    and exists (
      select 1 from tasks t
      where t.id = task_checklist_items.task_id
        and can_access_team(t.organization_id, t.team_id)
    )
  );

create policy "task_checklist_delete" on task_checklist_items
  for delete using (
    is_org_member(organization_id)
    and exists (
      select 1 from tasks t
      where t.id = task_checklist_items.task_id
        and can_access_team(t.organization_id, t.team_id)
    )
  );

-- ---------------------------------------------------------
-- TASK DEPENDENCY ("diblokir oleh")
-- ---------------------------------------------------------
create table if not exists task_dependencies (
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index if not exists task_dependencies_depends_on_idx on task_dependencies (depends_on_task_id);

alter table task_dependencies enable row level security;

create policy "task_dependencies_select" on task_dependencies
  for select using (is_org_member(organization_id));

create policy "task_dependencies_insert" on task_dependencies
  for insert with check (
    is_org_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id and can_access_team(t.organization_id, t.team_id))
  );

create policy "task_dependencies_delete" on task_dependencies
  for delete using (
    is_org_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id and can_access_team(t.organization_id, t.team_id))
  );

-- ---------------------------------------------------------
-- TASK TEMPLATE (blueprint task yang bisa dipakai ulang cepat)
-- ---------------------------------------------------------
create table if not exists task_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  title text not null,
  tag text,
  checklist_items jsonb not null default '[]'::jsonb,
  custom_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table task_templates enable row level security;

create policy "task_templates_select" on task_templates
  for select using (is_org_member(organization_id));

create policy "task_templates_insert" on task_templates
  for insert with check (is_org_member(organization_id));

create policy "task_templates_delete" on task_templates
  for delete using (is_org_manager(organization_id) or created_by = auth.uid());

-- ---------------------------------------------------------
-- TASK WATCHER (ikut dapat notifikasi tanpa harus jadi assignee)
-- ---------------------------------------------------------
create table if not exists task_watchers (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table task_watchers enable row level security;

-- Setiap anggota organisasi yang bisa akses task-nya boleh lihat SIAPA
-- SAJA watcher-nya (transparan, bukan diam-diam), tapi hanya bisa
-- menambah/menghapus DIRINYA SENDIRI sebagai watcher.
create policy "task_watchers_select" on task_watchers
  for select using (
    is_org_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id and can_access_team(t.organization_id, t.team_id))
  );

create policy "task_watchers_insert" on task_watchers
  for insert with check (
    user_id = auth.uid()
    and is_org_member(organization_id)
    and exists (select 1 from tasks t where t.id = task_id and can_access_team(t.organization_id, t.team_id))
  );

create policy "task_watchers_delete" on task_watchers
  for delete using (user_id = auth.uid());
