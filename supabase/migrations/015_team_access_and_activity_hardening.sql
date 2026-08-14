-- Migration 015 — Team-aware Task Access + Audit Hardening
-- Membuat keanggotaan tim berlaku konsisten pada tugas, bukan hanya chat.
-- Owner/Manager organisasi tetap memiliki akses penuh untuk oversight.

create or replace function can_access_team(org_id uuid, t_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    is_org_manager(org_id)
    or t_id is null
    or exists (
      select 1
      from team_members tm
      where tm.organization_id = org_id
        and tm.team_id = t_id
        and tm.user_id = auth.uid()
    );
$$;

create or replace function can_assign_user_to_team(org_id uuid, t_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    target_user_id is null
    or t_id is null
    or is_org_manager(org_id)
    or exists (
      select 1
      from team_members tm
      where tm.organization_id = org_id
        and tm.team_id = t_id
        and tm.user_id = target_user_id
    );
$$;

-- Semua anggota organisasi tetap dapat melihat task umum (team_id NULL).
-- Task yang terikat tim hanya terlihat oleh anggota tim terkait atau manager.
drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks
  for select using (
    is_org_member(organization_id)
    and can_access_team(organization_id, team_id)
  );

-- Pembuatan task harus berasal dari user yang punya akses ke timnya,
-- dan assignee (jika ada) harus anggota tim tersebut kecuali manager.
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks
  for insert with check (
    is_org_member(organization_id)
    and can_access_team(organization_id, team_id)
    and can_assign_user_to_team(organization_id, team_id, assignee_id)
  );

-- Update tetap mengikuti RBAC lama, ditambah validasi akses ke tim BARU.
drop policy if exists "tasks_update" on tasks;
create policy "tasks_update" on tasks
  for update using (
    is_org_manager(organization_id)
    or (assignee_id = auth.uid() and can_access_team(organization_id, team_id))
  )
  with check (
    is_org_manager(organization_id)
    or (
      is_org_member(organization_id)
      and can_access_team(organization_id, team_id)
      and can_assign_user_to_team(organization_id, team_id, assignee_id)
    )
  );

-- Delete tetap manager atau assignee sendiri, dan assignee harus masih punya akses tim.
drop policy if exists "tasks_delete" on tasks;
create policy "tasks_delete" on tasks
  for delete using (
    is_org_manager(organization_id)
    or (assignee_id = auth.uid() and can_access_team(organization_id, team_id))
  );

-- Index untuk mempercepat pemeriksaan membership pada workload/task.
create index if not exists team_members_org_team_user_idx
  on team_members (organization_id, team_id, user_id);
