"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLabels, useCanManage } from "@/lib/labels/LabelProvider";
import { MemberOption } from "@/lib/data/members";
import { TeamOption } from "@/lib/data/teams";
import {
  TEAM_CONVERSATION_KEY,
  dmConversationKey,
  teamChannelKey,
  isTeamChannelKey,
  teamIdFromChannelKey,
  findMentions,
  splitMentionSegments,
} from "@/lib/data/chat";
import { notifyUser, notifyUsers } from "@/lib/data/notifications";

export interface ChatMessage {
  id: string;
  content: string;
  sender_name: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  team_id?: string | null;
  reply_to_id?: string | null;
  created_at: string;
}

interface PinRow {
  message_id: string;
  pinned_by: string | null;
}

export function Chat({
  organizationId,
  currentUserId,
  currentUserName,
  members,
  teams = [],
  initialMessages,
  initialConversation,
}: {
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  members: MemberOption[];
  teams?: TeamOption[];
  initialMessages: ChatMessage[];
  /** "team", "team:<id>", atau user_id anggota untuk langsung buka DM tertentu */
  initialConversation: string;
}) {
  const labels = useLabels();
  const canManage = useCanManage();
  const supabase = createClient();

  const otherMembers = useMemo(() => members.filter((m) => m.id !== currentUserId), [members, currentUserId]);
  const memberNames = useMemo(() => members.map((m) => m.name), [members]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const memberIdByName = useMemo(() => new Map(members.map((m) => [m.name, m.id])), [members]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const isValidInitial =
    initialConversation === TEAM_CONVERSATION_KEY ||
    memberById.has(initialConversation) ||
    (isTeamChannelKey(initialConversation) && teamById.has(teamIdFromChannelKey(initialConversation) ?? ""));

  const [activeConvo, setActiveConvo] = useState<string>(
    isValidInitial ? initialConversation : TEAM_CONVERSATION_KEY
  );
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const isOrgWide = activeConvo === TEAM_CONVERSATION_KEY;
  const activeTeamId = isTeamChannelKey(activeConvo) ? teamIdFromChannelKey(activeConvo) : null;
  const isTeamChannel = activeTeamId !== null;
  const isTeam = isOrgWide || isTeamChannel; // "bukan DM" — dipakai untuk styling pengirim, dst.
  const isDM = !isOrgWide && !isTeamChannel;
  const conversationKey = isOrgWide
    ? TEAM_CONVERSATION_KEY
    : isTeamChannel
    ? teamChannelKey(activeTeamId!)
    : dmConversationKey(currentUserId, activeConvo);

  const visibleMessages = useMemo(() => {
    if (isOrgWide) return allMessages.filter((m) => !m.recipient_id && !m.team_id);
    if (isTeamChannel) return allMessages.filter((m) => !m.recipient_id && m.team_id === activeTeamId);
    return allMessages.filter(
      (m) =>
        (m.sender_id === currentUserId && m.recipient_id === activeConvo) ||
        (m.sender_id === activeConvo && m.recipient_id === currentUserId)
    );
  }, [allMessages, isOrgWide, isTeamChannel, activeTeamId, activeConvo, currentUserId]);

  const messageById = useMemo(() => new Map(allMessages.map((m) => [m.id, m])), [allMessages]);
  const pinnedMessages = useMemo(
    () => visibleMessages.filter((m) => pinnedIds.has(m.id)),
    [visibleMessages, pinnedIds]
  );
  // Channel Diskusi Umum/Tim: hanya manager yang boleh pin. Chat privat:
  // kedua pihak boleh — cocok dengan aturan message_pins_insert di database.
  const canPin = isDM || canManage;

  function scrollToMessage(id: string) {
    messageRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Ambil semua pin yang boleh dilihat user ini (RLS yang membatasi
  // cakupannya) — cukup sekali saat komponen dimuat, karena
  // `pinnedMessages` sudah otomatis tersaring ulang per percakapan lewat
  // `visibleMessages`.
  useEffect(() => {
    let active = true;
    supabase
      .from("message_pins")
      .select("message_id")
      .then(({ data }: { data: { message_id: string }[] | null }) => {
        if (active) setPinnedIds(new Set((data ?? []).map((r) => r.message_id)));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function togglePin(message: ChatMessage) {
    if (pinnedIds.has(message.id)) {
      setPinnedIds((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
      await supabase.from("message_pins").delete().eq("message_id", message.id);
    } else {
      setPinnedIds((prev) => new Set(prev).add(message.id));
      const { error } = await supabase
        .from("message_pins")
        .insert([{ message_id: message.id, organization_id: organizationId, pinned_by: currentUserId }]);
      if (error) {
        setPinnedIds((prev) => {
          const next = new Set(prev);
          next.delete(message.id);
          return next;
        });
      }
    }
  }

  async function deleteMessage(id: string) {
    setAllMessages((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("messages").delete().eq("id", id);
  }

  // Realtime: dengarkan pesan baru di seluruh organisasi, saring di client
  // sesuai percakapan yang sedang dibuka.
  useEffect(() => {
    const channel = supabase
      .channel(`org-chat-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const row = payload.new as ChatMessage & { organization_id: string };
          setAllMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Tandai percakapan aktif sebagai "sudah dibaca", dan ambil status baca
  // lawan bicara (khusus DM) untuk indikator centang biru.
  useEffect(() => {
    supabase
      .from("message_reads")
      .upsert(
        [{ organization_id: organizationId, user_id: currentUserId, conversation_key: conversationKey, last_read_at: new Date().toISOString() }],
        { onConflict: "user_id,conversation_key" }
      )
      .then(() => {});

    if (isDM) {
      supabase
        .from("message_reads")
        .select("last_read_at")
        .eq("user_id", activeConvo)
        .eq("conversation_key", conversationKey)
        .maybeSingle()
        .then(({ data }: { data: { last_read_at: string } | null }) => {
          setOtherLastRead(data?.last_read_at ?? null);
        });
    } else {
      setOtherLastRead(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey, visibleMessages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    setMentionQuery(null);
    const replyToId = replyingTo?.id ?? null;
    setReplyingTo(null);

    const { error } = await supabase.from("messages").insert([
      {
        organization_id: organizationId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        recipient_id: isDM ? activeConvo : null,
        team_id: isTeamChannel ? activeTeamId : null,
        reply_to_id: replyToId,
        content,
      },
    ]);

    setSending(false);
    if (error) {
      setDraft(content);
      return;
    }

    if (isDM) {
      notifyUser(supabase, {
        organizationId,
        recipientId: activeConvo,
        actorId: currentUserId,
        actorName: currentUserName,
        type: "dm",
        content: `${currentUserName} mengirim pesan: "${content.slice(0, 60)}${content.length > 60 ? "…" : ""}"`,
        link: `/dashboard/chat?with=${currentUserId}`,
      });
    } else {
      const mentionedNames = findMentions(content, memberNames);
      const mentionedIds = mentionedNames
        .map((n) => memberIdByName.get(n))
        .filter((id): id is string => !!id && id !== currentUserId);
      if (mentionedIds.length > 0) {
        notifyUsers(supabase, mentionedIds, {
          organizationId,
          actorId: currentUserId,
          actorName: currentUserName,
          type: "mention",
          content: `${currentUserName} menyebut kamu: "${content.slice(0, 60)}${content.length > 60 ? "…" : ""}"`,
          link: isTeamChannel ? `/dashboard/chat?with=${teamChannelKey(activeTeamId!)}` : "/dashboard/chat",
        });
      }
    }
  }

  function handleInputChange(value: string) {
    setDraft(value);
    const at = value.lastIndexOf("@");
    if (at !== -1 && (at === 0 || value[at - 1] === " ")) {
      const query = value.slice(at + 1);
      if (!query.includes(" ")) {
        setMentionQuery(query);
        return;
      }
    }
    setMentionQuery(null);
  }

  function insertMention(name: string) {
    const at = draft.lastIndexOf("@");
    const next = draft.slice(0, at) + `@${name} `;
    setDraft(next);
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  const mentionSuggestions =
    mentionQuery !== null
      ? otherMembers.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
      : [];

  return (
    <main className="flex-1 flex min-w-0 h-[calc(100vh-64px)]">
      {/* Overlay gelap saat drawer percakapan terbuka di mobile */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar percakapan — drawer di mobile (toggle lewat tombol di header konten), selalu tampil mulai breakpoint sm */}
      <aside
        className={`w-[240px] sm:w-[220px] shrink-0 border-r border-border bg-surface overflow-y-auto fixed sm:static inset-y-0 left-0 z-50 sm:z-auto transition-transform sm:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3">
          <div className="flex items-center justify-between px-2 pt-1 pb-2 sm:block">
            <div className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold">Percakapan</div>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="sm:hidden text-inkMuted text-lg leading-none px-1"
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
          <button
            onClick={() => {
              setActiveConvo(TEAM_CONVERSATION_KEY);
              setMobileNavOpen(false);
            }}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-sm font-medium mb-1 transition ${
              isOrgWide ? "" : "text-inkMuted hover:bg-surfaceAlt"
            }`}
            style={isOrgWide ? { backgroundColor: labels.accentSoft, color: labels.accent } : undefined}
          >
            💬 Diskusi Umum
          </button>
          {teams.length > 0 && (
            <>
              <div className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold px-2 pt-3 pb-2">
                Chat per {labels.teamLabel}
              </div>
              {teams.map((t) => {
                const key = teamChannelKey(t.id);
                const active = activeConvo === key;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveConvo(key);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-sm font-medium mb-1 transition truncate ${
                      active ? "" : "text-inkMuted hover:bg-surfaceAlt"
                    }`}
                    style={active ? { backgroundColor: labels.accentSoft, color: labels.accent } : undefined}
                  >
                    # {t.name}
                  </button>
                );
              })}
            </>
          )}
          <div className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold px-2 pt-3 pb-2">
            Chat Privat
          </div>
          {otherMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setActiveConvo(m.id);
                setMobileNavOpen(false);
              }}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-sm font-medium mb-1 transition truncate ${
                activeConvo === m.id ? "" : "text-inkMuted hover:bg-surfaceAlt"
              }`}
              style={activeConvo === m.id ? { backgroundColor: labels.accentSoft, color: labels.accent } : undefined}
            >
              {m.name}
            </button>
          ))}
          {otherMembers.length === 0 && (
            <p className="text-xs text-inkMuted px-2.5">Belum ada anggota lain untuk diajak chat privat.</p>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 sm:px-6 md:px-8 pt-6 pb-4 border-b border-border">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="sm:hidden mb-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-inkMuted"
          >
            ☰ Ganti Percakapan
          </button>
          <h1 className="text-2xl font-bold mb-1">
            {isOrgWide
              ? "Diskusi Umum"
              : isTeamChannel
              ? teamById.get(activeTeamId!) ?? labels.teamLabel
              : memberById.get(activeConvo) ?? "Chat Privat"}
          </h1>
          <p className="text-sm text-inkMuted">
            {isOrgWide
              ? "Chat langsung untuk seluruh anggota organisasi."
              : isTeamChannel
              ? `Chat khusus anggota ${labels.teamLabel.toLowerCase()} ini.`
              : "Percakapan privat, hanya kalian berdua."}
          </p>
        </div>

        {pinnedMessages.length > 0 && (
          <div className="border-b border-border bg-surfaceAlt/60 px-6 md:px-8 py-2 overflow-x-auto">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-inkMuted font-semibold shrink-0">📌 Disematkan:</span>
              {pinnedMessages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => scrollToMessage(m.id)}
                  className="shrink-0 max-w-[220px] truncate px-2.5 py-1 rounded-full border border-border bg-surface hover:bg-surfaceAlt transition"
                  title={m.content}
                >
                  {m.content}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-3">
          {visibleMessages.length === 0 && (
            <p className="text-sm text-inkMuted text-center mt-10">Belum ada pesan. Mulai percakapan pertama.</p>
          )}
          {visibleMessages.map((m, idx) => {
            const isMine = m.sender_id === currentUserId;
            const isLastMine = isMine && idx === visibleMessages.length - 1;
            const wasRead = isLastMine && isDM && otherLastRead && new Date(otherLastRead) >= new Date(m.created_at);
            const repliedTo = m.reply_to_id ? messageById.get(m.reply_to_id) : null;
            const isPinned = pinnedIds.has(m.id);
            const canDelete = isMine || (!isTeam ? false : canManage);
            return (
              <div
                key={m.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(m.id, el);
                  else messageRefs.current.delete(m.id);
                }}
                className={`flex group ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[75%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm ${isMine ? "text-white" : "bg-surfaceAlt text-ink"} ${isPinned ? "ring-2 ring-offset-1" : ""}`}
                    style={{
                      backgroundColor: isMine ? labels.accent : undefined,
                      ...(isPinned ? { boxShadow: `0 0 0 2px ${labels.accent}` } : {}),
                    }}
                  >
                    {!isMine && isTeam && (
                      <div className="text-[11px] font-semibold mb-0.5 opacity-70">{m.sender_name ?? "Anggota"}</div>
                    )}
                    {repliedTo && (
                      <button
                        onClick={() => scrollToMessage(repliedTo.id)}
                        className={`block w-full text-left mb-1.5 pl-2 border-l-2 text-xs opacity-80 truncate ${isMine ? "border-white/50" : "border-ink/20"}`}
                      >
                        {repliedTo.sender_name ?? "Anggota"}: {repliedTo.content}
                      </button>
                    )}
                    <div>
                      {splitMentionSegments(m.content, memberNames).map((seg, i) =>
                        seg.isMention ? (
                          <span
                            key={i}
                            className="font-semibold"
                            style={{ color: isMine ? "#FFFFFF" : labels.accent }}
                          >
                            {seg.text}
                          </span>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        )
                      )}
                    </div>
                  </div>

                  <div className={`flex items-center gap-2.5 mt-1 px-1 opacity-0 group-hover:opacity-100 transition ${isMine ? "justify-end" : "justify-start"}`}>
                    <button onClick={() => setReplyingTo(m)} className="text-[11px] text-inkMuted hover:text-ink font-medium">
                      Balas
                    </button>
                    {canPin && (
                      <button onClick={() => togglePin(m)} className="text-[11px] text-inkMuted hover:text-ink font-medium">
                        {isPinned ? "Lepas pin" : "Pin"}
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => deleteMessage(m.id)} className="text-[11px] text-inkMuted hover:text-[#8A3E24] font-medium">
                        Hapus
                      </button>
                    )}
                  </div>

                  {isLastMine && !isTeam && (
                    <div className="text-[10px] text-inkMuted text-right mt-0.5 pr-1">
                      {wasRead ? "✓✓ Dibaca" : "✓ Terkirim"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-4 relative">
          {replyingTo && (
            <div className="flex items-center justify-between gap-2 mb-2 px-3 py-2 rounded-lg bg-surfaceAlt text-xs">
              <span className="truncate">
                Membalas <strong>{replyingTo.sender_name ?? "Anggota"}</strong>: {replyingTo.content}
              </span>
              <button onClick={() => setReplyingTo(null)} className="text-inkMuted hover:text-ink shrink-0 px-1">
                ✕
              </button>
            </div>
          )}
          {mentionSuggestions.length > 0 && (
            <div className="absolute bottom-full left-4 mb-1 bg-surface border border-border rounded-lg shadow-card overflow-hidden w-56">
              {mentionSuggestions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => insertMention(m.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surfaceAlt transition"
                >
                  @{m.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && mentionSuggestions.length === 0) sendMessage();
              }}
              placeholder={isTeam ? "Tulis pesan… (ketik @ untuk mention)" : "Tulis pesan privat…"}
              className="flex-1 border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-ink"
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              className="text-white rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition"
              style={{ backgroundColor: labels.accent }}
            >
              Kirim
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
