-- Migration 018 — Activity & Security Audit System
-- Memisahkan riwayat aktivitas operasional dari audit keamanan/sensitive actions.

alter table activity_logs
  add column if not exists team_id uuid references teams(id) on delete set null;

create index if not exists activity_logs_org_created_idx
  on activity_logs (organization_id, created_at desc);

create index if not exists activity_logs_org_team_idx
  on activity_logs (organization_id, team_id, created_at desc);

create index if not exists activity_logs_org_actor_idx
  on activity_logs (organization_id, actor_id, created_at desc);

create index if not exists activity_logs_org_target_idx
  on activity_logs (organization_id, target_type, created_at desc);

create table if not exists security_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null,
  target_type text,
  target_id uuid,
  target_label text,
  team_id uuid references teams(id) on delete set null,
  detail text,
  created_at timestamptz not null default now()
);

alter table security_audit_logs enable row level security;

drop policy if exists "security_audit_select_managers" on security_audit_logs;
create policy "security_audit_select_managers" on security_audit_logs
  for select using (is_org_manager(organization_id));

drop policy if exists "security_audit_insert_managers" on security_audit_logs;
create policy "security_audit_insert_managers" on security_audit_logs
  for insert with check (is_org_manager(organization_id));

create index if not exists security_audit_org_created_idx
  on security_audit_logs (organization_id, created_at desc);

create index if not exists security_audit_org_actor_idx
  on security_audit_logs (organization_id, actor_id, created_at desc);

create index if not exists security_audit_org_action_idx
  on security_audit_logs (organization_id, action, created_at desc);

create index if not exists security_audit_org_team_idx
  on security_audit_logs (organization_id, team_id, created_at desc);
