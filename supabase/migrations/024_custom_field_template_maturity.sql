-- Migration 024 — Custom Field & Template Maturity (Fase 9 & 10 Roadmap)

-- ---------------------------------------------------------
-- CUSTOM FIELD: Conditional Field + Field Permission
-- ---------------------------------------------------------
-- Conditional: field ini hanya tampil/wajib kalau field LAIN (field_key
-- yang direferensikan) bernilai tertentu. NULL berarti selalu tampil
-- (perilaku lama, tidak ada perubahan untuk field yang sudah ada).
alter table custom_fields
  add column if not exists depends_on_field_key text,
  add column if not exists depends_on_value text;

-- Field Permission: siapa saja yang boleh MELIHAT dan MENGISI field ini.
-- Disimpan sebagai array role ('owner','manager','member'). Default
-- SEMUA role — jadi field yang sudah ada sebelumnya tetap terlihat oleh
-- semua orang seperti sebelumnya (tidak ada yang tiba-tiba hilang).
alter table custom_fields
  add column if not exists visible_to jsonb not null default '["owner","manager","member"]'::jsonb,
  add column if not exists editable_by jsonb not null default '["owner","manager","member"]'::jsonb;

-- ---------------------------------------------------------
-- TEMPLATE: Versioning
-- ---------------------------------------------------------
-- Nama template boleh dipakai berkali-kali (mis. "Klinik Gigi" v1, v2,
-- v3) — histori lama tetap tersimpan, bukan ditimpa. UI menampilkan versi
-- TERTINGGI per nama secara default, dengan opsi lihat riwayat.
alter table organization_templates
  add column if not exists version integer not null default 1;

create index if not exists organization_templates_name_version_idx
  on organization_templates (organization_id, name, version desc);

-- ---------------------------------------------------------
-- TEMPLATE: Permission (perbaikan celah RLS)
-- ---------------------------------------------------------
-- Sebelumnya "org_templates_all" mengizinkan SEMUA anggota organisasi
-- (termasuk member biasa) untuk membuat/mengedit/menghapus template —
-- padahal template mengubah struktur workflow & field ORG-WIDE begitu
-- diterapkan. Diperketat: semua anggota tetap boleh MELIHAT daftar
-- template (supaya tahu apa yang tersedia), tapi hanya Owner/Manager
-- yang boleh membuat, mengubah, atau menghapusnya.
drop policy if exists "org_templates_all" on organization_templates;

create policy "org_templates_select" on organization_templates
  for select using (is_org_member(organization_id));

create policy "org_templates_insert" on organization_templates
  for insert with check (is_org_manager(organization_id));

create policy "org_templates_update" on organization_templates
  for update using (is_org_manager(organization_id));

create policy "org_templates_delete" on organization_templates
  for delete using (is_org_manager(organization_id));
