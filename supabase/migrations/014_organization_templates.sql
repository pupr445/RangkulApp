-- Migration 014 — Template Manager per Organisasi
-- Admin/Manager dapat menyimpan preset workflow + tim + custom fields
-- melalui UI tanpa menyentuh SQL.

create table if not exists organization_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  workflow_stages jsonb not null default '[]'::jsonb,
  team_names jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table organization_templates enable row level security;

create policy "org_templates_all" on organization_templates
  for all using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

create index if not exists organization_templates_org_idx
  on organization_templates (organization_id, created_at desc);
