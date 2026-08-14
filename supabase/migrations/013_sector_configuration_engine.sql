-- Migration 013 — Sector Configuration Engine
-- Memperkuat workflow sektor, custom field builder, dan preset template organisasi.

alter table organizations
  add column if not exists workflow_stages jsonb not null default '[]'::jsonb;

alter table custom_fields
  add column if not exists sort_order integer not null default 0,
  add column if not exists number_min numeric,
  add column if not exists number_max numeric,
  add column if not exists date_min date,
  add column if not exists date_max date;

-- Status task sekarang tidak lagi dibatasi todo/doing/done. Nilainya adalah key
-- dari workflow stage yang aktif pada organisasi. Data lama tetap valid karena
-- todo/doing/done masih dipakai sebagai fallback.
alter table tasks drop constraint if exists tasks_status_check;

-- Pastikan urutan field deterministik.
create index if not exists custom_fields_org_entity_order_idx
  on custom_fields (organization_id, entity, sort_order, created_at);

-- Preset workflow default untuk template sektor global.
-- Struktur default_structure pada seed.sql akan menjadi sumber clone onboarding.
