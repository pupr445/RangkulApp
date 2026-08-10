-- Migration 003 — Undang Anggota Tim
-- Jalankan di Supabase SQL Editor setelah migration 002.

create table if not exists invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('manager','member')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table invitations enable row level security;

-- Anggota organisasi (siapa saja, untuk kesederhanaan MVP) boleh mengelola
-- undangan organisasinya. Untuk produksi, batasi ke role='owner'/'manager'.
create policy "invitations_manage" on invitations
  for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- Orang yang diundang (belum jadi anggota) tetap boleh melihat undangan
-- yang ditujukan ke emailnya sendiri — dipakai saat proses auto-join.
create policy "invitations_self_select" on invitations
  for select using (email = auth.jwt() ->> 'email');

-- Izinkan user BARU (belum anggota organisasi manapun) menambahkan dirinya
-- sendiri ke organization_members, HANYA JIKA ada undangan yang cocok
-- dengan emailnya untuk organisasi tsb. Tanpa ini, RLS organization_members
-- yang ada (is_org_member) akan memblokir user baru menambahkan dirinya
-- sendiri karena mereka belum jadi anggota — ayam-telur.
create policy "members_self_join_via_invite" on organization_members
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from invitations
      where invitations.organization_id = organization_members.organization_id
        and invitations.email = auth.jwt() ->> 'email'
    )
  );
