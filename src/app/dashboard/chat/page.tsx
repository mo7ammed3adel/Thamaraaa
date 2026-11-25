import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canCreateChannel } from "@/lib/chat/constants";
import ChatClient from "@/components/chat/ChatClient";

export const dynamic = "force-dynamic";

/** Team chat — DMs, groups and channels for every employee. */
export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Impersonation is for seeing someone's dashboard, not reading their messages.
  if (session.user.impersonatedBy) redirect("/dashboard");

  return (
    <ChatClient
      me={{ id: session.user.id, name: session.user.name ?? "", canCreateChannel: canCreateChannel(session.user.role) }}
    />
  );
}
