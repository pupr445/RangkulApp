import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/data/org";
import { Chat, ChatMessage } from "@/components/Chat";

export const runtime = "edge";

export default async function ChatPage() {
  const { supabase, user, org } = await getCurrentOrg();

  if (!user || !org) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("messages")
    .select("id, content, sender_name, sender_id, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: true })
    .limit(50);

  const initialMessages = (data as ChatMessage[] | null) ?? [];

  const currentUserName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "Pengguna";

  return (
    <Chat
      organizationId={org.id}
      currentUserId={user.id}
      currentUserName={currentUserName}
      initialMessages={initialMessages}
    />
  );
}
