-- Migration 023 — Chat Engine lanjutan (Fase 7 Master Roadmap)
-- Thread/Reply, Pin Message, Message Permission (delete).
-- Mention & Read Receipt sudah ada sejak migration 008/011, tidak diulang di sini.

-- ---------------------------------------------------------
-- THREAD / REPLY
-- ---------------------------------------------------------
alter table messages
  add column if not exists reply_to_id uuid references messages(id) on delete set null;

create index if not exists messages_reply_to_idx on messages (reply_to_id);

-- ---------------------------------------------------------
-- PIN MESSAGE
-- ---------------------------------------------------------
-- Sengaja dibuat sebagai TABEL TERPISAH (bukan kolom is_pinned di
-- messages) supaya izin "siapa boleh pin" bisa diatur lewat RLS insert/
-- delete pada tabel ini, tanpa perlu membuka izin UPDATE pada konten
-- pesan itu sendiri (yang seharusnya tetap tidak bisa diedit siapa pun).
create table if not exists message_pins (
  message_id uuid primary key references messages(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  pinned_by uuid references auth.users(id) on delete set null,
  pinned_at timestamptz not null default now()
);

alter table message_pins enable row level security;

create policy "message_pins_select" on message_pins
  for select using (
    is_org_member(organization_id)
    and exists (
      select 1 from messages m
      where m.id = message_pins.message_id
        and (
          (m.recipient_id is not null and (m.sender_id = auth.uid() or m.recipient_id = auth.uid()))
          or (m.recipient_id is null and m.team_id is null)
          or (m.recipient_id is null and m.team_id is not null and (is_team_member(m.team_id) or is_org_manager(m.organization_id)))
        )
    )
  );

-- Channel Diskusi Umum/Tim: hanya Owner/Manager yang boleh pin (supaya
-- tidak jadi ajang saling pin sembarangan di ruang bersama). Chat privat:
-- kedua pihak DM boleh pin pesan masing-masing untuk dirinya.
create policy "message_pins_insert" on message_pins
  for insert with check (
    pinned_by = auth.uid()
    and exists (
      select 1 from messages m
      where m.id = message_pins.message_id
        and (
          (m.recipient_id is null and is_org_manager(m.organization_id))
          or (m.recipient_id is not null and (m.sender_id = auth.uid() or m.recipient_id = auth.uid()))
        )
    )
  );

create policy "message_pins_delete" on message_pins
  for delete using (
    pinned_by = auth.uid()
    or exists (
      select 1 from messages m
      where m.id = message_pins.message_id and m.recipient_id is null and is_org_manager(m.organization_id)
    )
  );

-- ---------------------------------------------------------
-- MESSAGE PERMISSION (hapus pesan)
-- ---------------------------------------------------------
-- Sengaja TIDAK ada policy UPDATE — pesan tidak bisa diedit siapa pun,
-- termasuk pengirimnya sendiri (konsisten dengan tidak adanya fitur edit
-- di UI). Yang ditambahkan hanya izin HAPUS:
--   - Pengirim boleh hapus pesannya sendiri, di channel maupun DM.
--   - Owner/Manager boleh hapus pesan siapa pun di Diskusi Umum/Tim untuk
--     moderasi — TAPI TIDAK BOLEH menghapus pesan DM orang lain (itu
--     percakapan privat, manager tidak berhak ikut campur di situ).
create policy "messages_delete" on messages
  for delete using (
    sender_id = auth.uid()
    or (recipient_id is null and is_org_manager(organization_id))
  );
