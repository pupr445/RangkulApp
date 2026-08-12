import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { fetchMemberOptions } from "@/lib/data/members";
import { TEAM_CONVERSATION_KEY } from "@/lib/data/chat";
import { Chat, ChatMessage } from "@/components/Chat";

export const runtime = "edge";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const { supabase, user, org } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  const currentUserName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Pengguna";

  // Ambil pesan Diskusi Tim + semua DM yang melibatkan user ini (RLS di
  // migration 008 sudah memastikan hanya baris yang berhak dilihat yang
  // benar-benar dikembalikan).
  const { data } = await supabase
    .from("messages")
    .select("id, content, sender_name, sender_id, recipient_id, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true })
    .limit(300);

  const initialMessages = (data as ChatMessage[] | null) ?? [];

  const members = await fetchMemberOptions(supabase, org.id, { id: user.id, name: currentUserName });

  const params = await searchParams;
  const initialConversation = params.with?.trim() || TEAM_CONVERSATION_KEY;

  return (
    <Chat
      organizationId={org.id}
      currentUserId={user.id}
      currentUserName={currentUserName}
      initialMessages={initialMessages}
      members={members}
      initialConversation={initialConversation}
    />
  );
}
