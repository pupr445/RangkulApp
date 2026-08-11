-- Migration 006 — Kontrol Akses Berjenjang (Role-Based Access Control)
-- Jalankan di Supabase SQL Editor setelah migration 005.
--
-- Sebelumnya, kolom `role` di organization_members sudah ada tapi TIDAK
-- membatasi apapun — semua anggota (owner/manager/member) punya hak akses
-- yang sama persis lewat kebijakan RLS `is_org_member`. Migration ini
-- memperketat sebagian kebijakan supaya:
--   - Owner & Manager: bisa kelola tim, custom field, undangan.
--   - Member biasa: hanya bisa lihat, buat tugas, dan ubah/hapus tugas
--     yang DITUGASKAN ke dirinya sendiri.

-- Helper: apakah user saat ini owner ATAU manager di organisasi tsb?
create or replace function is_org_manager(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from organizations where id = org_id and owner_id = auth.uid()
  )
  or exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid() and role = 'manager'
  );
$$;

-- TEAMS: semua anggota boleh lihat, hanya owner/manager boleh kelola
drop policy if exists "teams_all" on teams;
create policy "teams_select" on teams for select using (is_org_member(organization_id));
create policy "teams_insert" on teams for insert with check (is_org_manager(organization_id));
create policy "teams_update" on teams for update using (is_org_manager(organization_id));
create policy "teams_delete" on teams for delete using (is_org_manager(organization_id));

-- CUSTOM FIELDS: sama pola dengan teams
drop policy if exists "custom_fields_all" on custom_fields;
create policy "custom_fields_select" on custom_fields for select using (is_org_member(organization_id));
create policy "custom_fields_insert" on custom_fields for insert with check (is_org_manager(organization_id));
create policy "custom_fields_update" on custom_fields for update using (is_org_manager(organization_id));
create policy "custom_fields_delete" on custom_fields for delete using (is_org_manager(organization_id));

-- INVITATIONS: hanya owner/manager yang boleh membuat/mengubah/menghapus
-- undangan organisasi. Kebijakan `invitations_self_select` (dari migration
-- 003, untuk auto-join) TIDAK disentuh — tetap berlaku.
drop policy if exists "invitations_manage" on invitations;
create policy "invitations_select_org" on invitations for select using (is_org_manager(organization_id));
create policy "invitations_insert" on invitations for insert with check (is_org_manager(organization_id));
create policy "invitations_update_org" on invitations for update using (is_org_manager(organization_id));
create policy "invitations_delete" on invitations for delete using (is_org_manager(organization_id));

-- ORGANIZATION MEMBERS: menambahkan anggota secara manual (di luar alur
-- undangan) dibatasi ke owner/manager. Kebijakan self-join lewat undangan
-- (dari migration 003) TIDAK disentuh — tetap berlaku untuk user baru.
drop policy if exists "members_insert_owner" on organization_members;
create policy "members_insert_owner" on organization_members
  for insert with check (is_org_manager(organization_id));

-- TASKS: semua anggota boleh lihat & membuat tugas baru. Mengubah/menghapus
-- HANYA boleh oleh owner/manager, ATAU oleh anggota yang tugas itu
-- ditugaskan ke dirinya sendiri (assignee_id = dirinya).
drop policy if exists "tasks_all" on tasks;
create policy "tasks_select" on tasks for select using (is_org_member(organization_id));
create policy "tasks_insert" on tasks for insert with check (is_org_member(organization_id));
create policy "tasks_update" on tasks for update using (
  is_org_manager(organization_id) or assignee_id = auth.uid()
);
create policy "tasks_delete" on tasks for delete using (
  is_org_manager(organization_id) or assignee_id = auth.uid()
);
