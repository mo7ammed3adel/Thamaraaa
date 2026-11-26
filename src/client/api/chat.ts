import { buildQueryString, deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export type ChatType = "dm" | "group" | "channel";
export type MemberRole = "owner" | "admin" | "member";

export type ConversationSummary = {
  id: string;
  type: ChatType;
  name: string | null;
  isPrivate: boolean;
  memberCount: number;
  otherUser: { id: string; name: string; role: string; active: boolean } | null;
  lastMessageAt: string;
  lastReadAt: string;
  online: boolean;
  unread: number;
  lastMessage: {
    senderName: string | null;
    mine: boolean;
    kind: string;
    body: string | null;
    stickerId: string | null;
    deleted: boolean;
    hasAttachments: boolean;
  } | null;
};

export type ConversationDetail = {
  id: string;
  type: ChatType;
  name: string | null;
  description: string | null;
  isPrivate: boolean;
  createdAt: string;
  myRole: MemberRole;
  canCreateChannel: boolean;
  pinnedCount: number;
  members: { userId: string; name: string; email: string; role: string; active: boolean; online: boolean; memberRole: MemberRole }[];
};

export type ChatAttachment = { id: string; originalName: string; mimeType: string; category: string; size: number };

export type ChatMessage = {
  id: string;
  conversationId: string;
  kind: "text" | "sticker" | "system";
  body: string | null;
  stickerId: string | null;
  sender: { id: string; name: string; role: string } | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  attachments: ChatAttachment[];
  reactions: { emoji: string; count: number; mine: boolean; names: string[] }[];
  /** Set on thread replies: the root message they belong to. */
  threadRootId: string | null;
  thread: { count: number; lastReplyAt: string; participants: { id: string; name: string }[] } | null;
  pinned: boolean;
};

export type SearchHit = {
  id: string;
  conversationId: string;
  threadRootId: string | null;
  conversationName: string | null;
  conversationType: ChatType;
  sender: { id: string; name: string } | null;
  body: string;
  createdAt: string;
};

export const getThread = (rootId: string) => getJson<{ root: ChatMessage; replies: ChatMessage[] }>(`/api/chat/messages/${rootId}/thread`);
export const togglePin = (id: string) => postJson<ChatMessage>(`/api/chat/messages/${id}/pin`);
export const listPins = (conversationId: string) => getJson<ChatMessage[]>(`/api/chat/conversations/${conversationId}/pins`);
export const searchMessages = (q: string) => getJson<SearchHit[]>(`/api/chat/search${buildQueryString({ q })}`);

export type ChatUser = { id: string; name: string; email: string; role: string };
export type PublicChannel = { id: string; name: string | null; description: string | null; memberCount: number; joined: boolean };

export const listConversations = () => getJson<ConversationSummary[]>("/api/chat/conversations");
export const getConversation = (id: string) => getJson<ConversationDetail>(`/api/chat/conversations/${id}`);
export const createConversation = (body: {
  type: ChatType;
  name?: string;
  description?: string;
  isPrivate?: boolean;
  memberIds: string[];
}) => postJson<{ id: string }>("/api/chat/conversations", body);
export const updateConversation = (id: string, body: { name?: string; description?: string }) =>
  patchJson<{ ok: true }>(`/api/chat/conversations/${id}`, body);

export const addMembers = (id: string, userIds: string[]) =>
  postJson<{ added: number }>(`/api/chat/conversations/${id}/members`, { userIds });
export const removeMember = (id: string, userId: string) =>
  deleteJson<{ ok: true }>(`/api/chat/conversations/${id}/members/${userId}`);
export const setMemberRole = (id: string, userId: string, role: "admin" | "member") =>
  patchJson<{ ok: true }>(`/api/chat/conversations/${id}/members/${userId}`, { role });
export const joinChannel = (id: string) => postJson<{ ok: true }>(`/api/chat/conversations/${id}/join`);
export const markRead = (id: string) => postJson<{ ok: true }>(`/api/chat/conversations/${id}/read`);

export const listMessages = (id: string, params: { before?: string } = {}) =>
  getJson<{ messages: ChatMessage[]; hasMore: boolean; othersReadAt: string[]; myLastReadAt: string }>(
    `/api/chat/conversations/${id}/messages${buildQueryString(params)}`
  );
export const sendTextMessage = (id: string, body: { body?: string; stickerId?: string; replyToId?: string }) =>
  postJson<ChatMessage>(`/api/chat/conversations/${id}/messages`, body);
export const editMessage = (id: string, body: string) => patchJson<ChatMessage>(`/api/chat/messages/${id}`, { body });
export const deleteMessage = (id: string) => deleteJson<{ ok: true }>(`/api/chat/messages/${id}`);
export const toggleReaction = (id: string, emoji: string) =>
  postJson<ChatMessage>(`/api/chat/messages/${id}/reactions`, { emoji });

export const searchChatUsers = (q: string) => getJson<ChatUser[]>(`/api/chat/users${buildQueryString({ q })}`);
export const browseChannels = () => getJson<PublicChannel[]>("/api/chat/channels");
export const getUnread = () => getJson<{ unread: number }>("/api/chat/unread");

export const attachmentUrl = (id: string, download = false) =>
  `/api/chat/attachments/${id}${download ? "?download=1" : ""}`;

export class ChatUploadError extends Error {
  constructor(message: string, public status: number, public payload: unknown) {
    super(message);
  }
}

/**
 * Sends a message with files. Uses XHR rather than fetch so the composer can
 * show real upload progress for large videos.
 */
export function sendFileMessage(
  id: string,
  input: { body?: string; replyToId?: string; files: File[] },
  onProgress?: (fraction: number) => void
): Promise<ChatMessage> {
  const form = new FormData();
  if (input.body) form.append("body", input.body);
  if (input.replyToId) form.append("replyToId", input.replyToId);
  for (const f of input.files) form.append("files", f, f.name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/chat/conversations/${id}/messages`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload as ChatMessage);
      else {
        const message = payload && typeof payload === "object" && "error" in payload ? String((payload as { error: unknown }).error) : `HTTP ${xhr.status}`;
        reject(new ChatUploadError(message, xhr.status, payload));
      }
    };
    xhr.onerror = () => reject(new ChatUploadError("Network error", 0, null));
    xhr.send(form);
  });
}
