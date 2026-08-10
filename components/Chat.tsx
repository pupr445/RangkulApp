"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLabels } from "@/lib/labels/LabelProvider";

export interface ChatMessage {
  id: string;
  content: string;
  sender_name: string | null;
  sender_id: string | null;
  created_at: string;
}

export function Chat({
  organizationId,
  currentUserId,
  currentUserName,
  initialMessages,
}: {
  organizationId: string;
  currentUserId: string;
  currentUserName: string;
  initialMessages: ChatMessage[];
}) {
  const labels = useLabels();
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Berlangganan perubahan realtime pada tabel `messages` khusus
    // organisasi ini. Setiap ada INSERT baru (dari device manapun),
    // pesan langsung muncul di sini tanpa refresh.
    const channel = supabase
      .channel(`org-chat-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage & { organization_id: string };
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");

    const { error } = await supabase.from("messages").insert([
      {
        organization_id: organizationId,
        sender_id: currentUserId,
        sender_name: currentUserName,
        content,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    setSending(false);
    if (error) {
      // Realtime INSERT event akan menambahkan pesan ke UI untuk kita;
      // jika gagal, kembalikan draft supaya tidak hilang.
      setDraft(content);
    }
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-64px)]">
      <div className="px-6 md:px-8 pt-6 pb-4 border-b border-border">
        <h1 className="text-2xl font-bold mb-1">{labels.navChat}</h1>
        <p className="text-sm text-inkMuted">Chat langsung untuk seluruh anggota organisasi.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-inkMuted text-center mt-10">
            Belum ada pesan. Mulai diskusi pertama di {labels.teamLabel.toLowerCase()} ini.
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMine ? "text-white" : "bg-surfaceAlt text-ink"
                }`}
                style={isMine ? { backgroundColor: labels.accent } : undefined}
              >
                {!isMine && (
                  <div className="text-[11px] font-semibold mb-0.5 opacity-70">
                    {m.sender_name ?? "Anggota"}
                  </div>
                )}
                <div>{m.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="Tulis pesan…"
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
    </main>
  );
}
