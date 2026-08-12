"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/lib/labels/LabelProvider";
import { MemberOption } from "@/lib/data/members";
import {
  TEAM_CONVERSATION_KEY,
  dmConversationKey,
  findMentions,
  splitMentionSegments,
} from "@/lib/data/chat";

export interface ChatMessage {
  id: string;
  content: string;
  sender_name: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  created_at: string;
}

export function Chat({
  organizationId,
  currentUserId,
  currentUserName,
  members,
  initialMessages,
  initialConversation,
}: {
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  members: MemberOption[];
  initialMessages: ChatMessage[];
  /** "team" atau user_id anggota untuk langsung buka DM tertentu */
  initialConversation: string;
}) {
  const labels = useLabels();
  const supabase = createClient();

  const otherMembers = useMemo(() => members.filter((m) => m.id !== currentUserId), [members, currentUserId]);
  const memberNames = useMemo(() => members.map((m) => m.name), [members]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const [activeConvo, setActiveConvo] = useState<string>(
    initialConversation === TEAM_CONVERSATION_KEY || memberById.has(initialConversation)
      ? initialConversation
      : TEAM_CONVERSATION_KEY
  );
  const [allMessages, setAllMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isTeam = activeConvo === TEAM_CONVERSATION_KEY;
  const conversationKey = isTeam ? TEAM_CONVERSATION_KEY : dmConversationKey(currentUserId, activeConvo);

  const visibleMessages = useMemo(() => {
    if (isTeam) return allMessages.filter((m) => !m.recipient_id);
    return allMessages.filter(
      (m) =>
        (m.sender_id === currentUserId && m.recipient_id === activeConvo) ||
        (m.sender_id === activeConvo && m.recipient_id === currentUserId)
    );
  }, [allMessages, isTeam, activeConvo, currentUserId]);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    client
      .from("message_reads")
      .upsert(
        [{ organization_id: organizationId, user_id: currentUserId, conversation_key: conversationKey, last_read_at: new Date().toISOString() }],
        { onConflict: "user_id,conversation_key" }
      )
      .then(() => {});

    if (!isTeam) {
      client
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const { error } = await client.from("messages").insert([
      {
        organization_id: organizationId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        recipient_id: isTeam ? null : activeConvo,
        content,
      },
    ]);

    setSending(false);
    if (error) setDraft(content);
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
      {/* Sidebar percakapan */}
      <aside className="w-[220px] shrink-0 border-r border-border bg-surface overflow-y-auto hidden sm:block">
        <div className="p-3">
          <div className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold px-2 pt-1 pb-2">
            Percakapan
          </div>
          <button
            onClick={() => setActiveConvo(TEAM_CONVERSATION_KEY)}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-sm font-medium mb-1 transition ${
              isTeam ? "" : "text-inkMuted hover:bg-surfaceAlt"
            }`}
            style={isTeam ? { backgroundColor: labels.accentSoft, color: labels.accent } : undefined}
          >
            💬 {labels.navChat}
          </button>
          <div className="text-[11px] uppercase tracking-wide text-inkMuted font-semibold px-2 pt-3 pb-2">
            Chat Privat
          </div>
          {otherMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveConvo(m.id)}
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
        <div className="px-6 md:px-8 pt-6 pb-4 border-b border-border">
          <h1 className="text-2xl font-bold mb-1">
            {isTeam ? labels.navChat : memberById.get(activeConvo) ?? "Chat Privat"}
          </h1>
          <p className="text-sm text-inkMuted">
            {isTeam ? "Chat langsung untuk seluruh anggota organisasi." : "Percakapan privat, hanya kalian berdua."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-3">
          {visibleMessages.length === 0 && (
            <p className="text-sm text-inkMuted text-center mt-10">Belum ada pesan. Mulai percakapan pertama.</p>
          )}
          {visibleMessages.map((m, idx) => {
            const isMine = m.sender_id === currentUserId;
            const isLastMine = isMine && idx === visibleMessages.length - 1;
            const wasRead = isLastMine && !isTeam && otherLastRead && new Date(otherLastRead) >= new Date(m.created_at);
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm ${isMine ? "text-white" : "bg-surfaceAlt text-ink"}`}
                    style={isMine ? { backgroundColor: labels.accent } : undefined}
                  >
                    {!isMine && isTeam && (
                      <div className="text-[11px] font-semibold mb-0.5 opacity-70">{m.sender_name ?? "Anggota"}</div>
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
                  {isLastMine && !isTeam && (
                    <div className="text-[10px] text-inkMuted text-right mt-1 pr-1">
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
