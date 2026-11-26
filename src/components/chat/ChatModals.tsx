"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Hash, Lock, LogOut, Search, Shield, UserPlus, UserX, X } from "lucide-react";
import {
  addMembers,
  browseChannels,
  createConversation,
  joinChannel,
  removeConversationAvatar,
  removeMember,
  searchChatUsers,
  setConversationAvatar,
  setMemberRole,
  updateConversation,
  type ChatType,
  type ChatUser,
  type ConversationDetail,
  type PublicChannel,
} from "@/client/api/chat";
import { Avatar, ConversationAvatar, ConversationIcon } from "./ChatBits";
import { PhotoPicker } from "./PhotoPicker";
import { ClientLinkSection } from "./ClientLinkSection";
import { useChatT } from "./useChatT";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** Searchable employee list. Single-select for DMs, multi-select otherwise. */
function UserPicker({
  multiple,
  selected,
  onChange,
  exclude = [],
}: {
  multiple: boolean;
  selected: ChatUser[];
  onChange: (users: ChatUser[]) => void;
  exclude?: string[];
}) {
  const { t } = useChatT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ChatUser[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => {
      searchChatUsers(q).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  const ids = new Set(selected.map((u) => u.id));
  const visible = results.filter((u) => !exclude.includes(u.id));

  function toggle(u: ChatUser) {
    if (!multiple) return onChange([u]);
    onChange(ids.has(u.id) ? selected.filter((x) => x.id !== u.id) : [...selected, u]);
  }

  return (
    <div>
      {multiple && selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span key={u.id} className="flex items-center gap-1 rounded-full bg-emerald-50 py-1 pe-1 ps-2.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              {u.name}
              <button type="button" onClick={() => toggle(u)} className="rounded-full p-0.5 hover:bg-emerald-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPeople")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-3 ps-9 text-sm outline-none focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
        />
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-100">
        {visible.length === 0 && <p className="p-4 text-center text-sm text-slate-400">{t("noResults")}</p>}
        {visible.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => toggle(u)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-slate-50 ${ids.has(u.id) ? "bg-emerald-50/60" : ""}`}
          >
            <Avatar name={u.name} seed={u.id} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
              <p className="truncate text-xs text-slate-500">
                {u.email} · <span className="capitalize">{u.role.replace(/_/g, " ")}</span>
              </p>
            </div>
            {ids.has(u.id) && <Check className="h-4 w-4 text-emerald-600" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NewConversationModal({
  type,
  onClose,
  onCreated,
  onError,
}: {
  type: ChatType;
  onClose: () => void;
  onCreated: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useChatT();
  const [selected, setSelected] = useState<ChatUser[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const title = type === "dm" ? t("newMessage") : type === "group" ? t("newGroup") : t("newChannel");
  const ready = type === "dm" ? selected.length === 1 : type === "group" ? name.trim() && selected.length > 0 : name.trim();

  async function create() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const { id } = await createConversation({
        type,
        name: type === "dm" ? undefined : name,
        description: type === "channel" ? description : undefined,
        isPrivate: type === "channel" ? isPrivate : undefined,
        memberIds: selected.map((u) => u.id),
      });
      onCreated(id);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      {type !== "dm" && (
        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{t("name")}</label>
            <div className="relative">
              {type === "channel" && <Hash className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className={`w-full rounded-xl border border-slate-200 py-2.5 pe-3 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 ${type === "channel" ? "ps-9" : "ps-3"}`}
              />
            </div>
          </div>
          {type === "channel" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">{t("description")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[false, true].map((p) => (
                  <button
                    key={String(p)}
                    type="button"
                    onClick={() => setIsPrivate(p)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-xs font-medium transition ${
                      isPrivate === p ? "border-emerald-400 bg-emerald-50 text-emerald-800 ring-4 ring-emerald-100" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                    {p ? t("privateChannel") : t("publicChannel")}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <UserPicker multiple={type !== "dm"} selected={selected} onChange={setSelected} />
      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          {t("cancel")}
        </button>
        <button
          onClick={create}
          disabled={!ready || busy}
          className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          {type === "dm" ? t("start") : t("create")}
        </button>
      </div>
    </Modal>
  );
}

export function BrowseChannelsModal({ onClose, onOpen, onError }: { onClose: () => void; onOpen: (id: string) => void; onError: (m: string) => void }) {
  const { t } = useChatT();
  const [channels, setChannels] = useState<PublicChannel[] | null>(null);

  useEffect(() => {
    browseChannels().then(setChannels).catch(() => setChannels([]));
  }, []);

  async function open(c: PublicChannel) {
    try {
      if (!c.joined) await joinChannel(c.id);
      onOpen(c.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("failed"));
    }
  }

  return (
    <Modal title={t("browseChannels")} onClose={onClose}>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {channels?.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{t("noChannels")}</p>}
        {channels?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-emerald-300">
              <Hash className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
              <p className="truncate text-xs text-slate-500">
                {c.memberCount} {t("members")}
                {c.description ? ` · ${c.description}` : ""}
              </p>
            </div>
            <button
              onClick={() => open(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${c.joined ? "bg-slate-100 text-slate-600" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
            >
              {c.joined ? t("open") : t("join")}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function InfoPanel({
  detail,
  meId,
  onClose,
  onChanged,
  onLeft,
  onError,
  onOpenUser,
  onOpenJourney,
}: {
  detail: ConversationDetail;
  meId: string;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
  onError: (m: string) => void;
  onOpenUser?: (user: { id: string; name: string; role?: string | null; online?: boolean }, anchor: DOMRect) => void;
  onOpenJourney?: () => void;
}) {
  const { t } = useChatT();
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<ChatUser[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(detail.name || "");
  const [description, setDescription] = useState(detail.description || "");

  const manager = detail.myRole === "owner" || detail.myRole === "admin";
  // Client groups are curated like channels: only owners/admins add people.
  const canAdd = (detail.type === "group" && !detail.isClientGroup) || ((detail.type === "channel" || detail.isClientGroup) && manager);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : t("failed"));
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-s border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
        <span className="font-bold text-slate-800">{t("info")}</span>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-5 flex flex-col items-center text-center">
          {(() => {
            const picture = detail.avatarV ? (
              <ConversationAvatar id={detail.id} type={detail.type} isPrivate={detail.isPrivate} avatarV={detail.avatarV} size={64} />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-emerald-300 shadow-lg">
                <ConversationIcon type={detail.type} isPrivate={detail.isPrivate} className="h-7 w-7" />
              </div>
            );
            // Owners and admins can set the group/channel photo.
            return (
              <div className="mb-3">
                {manager && detail.type !== "dm" ? (
                  <PhotoPicker
                    hasPhoto={Boolean(detail.avatarV)}
                    labels={{ change: t("changePhoto"), remove: t("removePhoto"), tooLarge: t("photoTooLarge") }}
                    onPick={(file) => run(() => setConversationAvatar(detail.id, file))}
                    onRemove={() => run(() => removeConversationAvatar(detail.id))}
                    onError={onError}
                  >
                    {picture}
                  </PhotoPicker>
                ) : (
                  picture
                )}
              </div>
            );
          })()}
          {renaming ? (
            <div className="w-full space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder={t("description")} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-300" />
              <div className="flex justify-center gap-2">
                <button onClick={() => setRenaming(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">{t("cancel")}</button>
                <button
                  onClick={() => run(async () => { await updateConversation(detail.id, { name, description }); setRenaming(false); })}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {t("save")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-900">{detail.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{detail.description || t("noDescription")}</p>
              {manager && detail.type !== "dm" && (
                <button onClick={() => setRenaming(true)} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">
                  {t("rename")}
                </button>
              )}
            </>
          )}
        </div>

        <ClientLinkSection detail={detail} canManage={manager} onOpenJourney={() => onOpenJourney?.()} onChanged={onChanged} onError={onError} />

        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {detail.members.length} {t("members")}
          </span>
          {canAdd && !adding && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              <UserPlus className="h-3.5 w-3.5" />
              {t("addMembers")}
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <UserPicker multiple selected={toAdd} onChange={setToAdd} exclude={detail.members.map((m) => m.userId)} />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => { setAdding(false); setToAdd([]); }} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-white">{t("cancel")}</button>
              <button
                disabled={toAdd.length === 0}
                onClick={() => run(async () => { await addMembers(detail.id, toAdd.map((u) => u.id)); setAdding(false); setToAdd([]); })}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300"
              >
                {t("addMembers")}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {detail.members.map((m) => {
            const canRemove = detail.type !== "dm" && !m.managed && m.userId !== meId && manager && m.memberRole !== "owner" && !(m.memberRole === "admin" && detail.myRole !== "owner");
            return (
              <div key={m.userId} className="group/m flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <button
                  type="button"
                  disabled={m.userId === meId || !onOpenUser || !m.active}
                  onClick={(e) => onOpenUser?.({ id: m.userId, name: m.name, role: m.role, online: m.online }, e.currentTarget.getBoundingClientRect())}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-start enabled:cursor-pointer"
                  data-testid="member-row"
                >
                <Avatar name={m.name} seed={m.userId} size={32} online={m.online} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-medium text-slate-800">
                    {m.name}
                    {m.userId === meId && <span className="text-xs text-slate-400">({t("you")})</span>}
                    {m.memberRole === "owner" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                    {m.memberRole === "admin" && <Shield className="h-3.5 w-3.5 text-sky-500" />}
                  </p>
                  <p className="truncate text-xs capitalize text-slate-500">
                    {m.active ? m.role.replace(/_/g, " ") : t("inactive")}
                  </p>
                </div>
                </button>
                <div className="hidden gap-1 group-hover/m:flex">
                  {detail.myRole === "owner" && m.userId !== meId && m.memberRole !== "owner" && detail.type !== "dm" && (
                    <button
                      title={m.memberRole === "admin" ? t("removeAdmin") : t("makeAdmin")}
                      onClick={() => run(() => setMemberRole(detail.id, m.userId, m.memberRole === "admin" ? "member" : "admin"))}
                      className="rounded p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                  )}
                  {canRemove && (
                    <button title={t("remove")} onClick={() => run(() => removeMember(detail.id, m.userId))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <UserX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {detail.isClientGroup && (
        <p className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500">{t("managedByProject")}</p>
      )}
      {detail.type !== "dm" && !detail.members.find((m) => m.userId === meId)?.managed && (
        <div className="border-t border-slate-200 p-3">
          <button
            onClick={async () => {
              if (!window.confirm(t("confirmLeave"))) return;
              try {
                await removeMember(detail.id, meId);
                onLeft();
              } catch (e) {
                onError(e instanceof Error ? e.message : t("failed"));
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" />
            {t("leave")}
          </button>
        </div>
      )}
    </aside>
  );
}
