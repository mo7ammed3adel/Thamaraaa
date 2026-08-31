"use client";

import { useMemo, useState } from "react";
import { Building2, UserCheck, Loader2, Search, Inbox } from "lucide-react";
import { notify } from "@/components/toast";
import { assignHeadAccountManager } from "@/client/api/projects";
import { HttpError } from "@/client/transport/http";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  package: string;
  createdAt: string;
  headAccountManagerId: string | null;
  headAccountManagerName: string | null;
  accountManagerName: string | null;
};

type Head = { id: string; name: string };

export default function ClientAssignClient({
  clients: initial,
  headAccountManagers,
}: {
  clients: Client[];
  headAccountManagers: Head[];
}) {
  const t = useTranslator();
  const [clients, setClients] = useState<Client[]>(initial);
  const [tab, setTab] = useState<"pending" | "assigned">("pending");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const pendingCount = clients.filter((c) => !c.headAccountManagerId).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesTab = tab === "pending" ? !c.headAccountManagerId : !!c.headAccountManagerId;
      if (!matchesTab) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.phone || "").includes(q);
    });
  }, [clients, tab, search]);

  const assign = async (client: Client, headId: string) => {
    if (!headId) return;
    setSavingId(client.id);
    try {
      await assignHeadAccountManager(client.id, { headAccountManagerId: headId });
      const head = headAccountManagers.find((h) => h.id === headId);
      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? { ...c, headAccountManagerId: headId, headAccountManagerName: head?.name || null }
            : c
        )
      );
      notify(`Assigned "${client.name}" to ${head?.name || "Head Account Manager"}.`);
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to assign client");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("pending")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
              tab === "pending" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Pending
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tab === "pending" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setTab("assigned")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              tab === "assigned" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Assigned
          </button>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client by name or phone…"
            className="w-full ps-10 pe-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="bg-slate-50 text-slate-400 p-4 rounded-full mb-3">
              <Inbox className="h-7 w-7" />
            </div>
            <p className="text-slate-500 text-sm">
              {tab === "pending" ? "No clients waiting to be assigned. 🎉" : "No assigned clients yet."}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-start text-xs font-bold uppercase tracking-wider text-slate-400">{t("common.client")}</th>
                <th className="px-5 py-3 text-start text-xs font-bold uppercase tracking-wider text-slate-400">{t("common.package")}</th>
                <th className="px-5 py-3 text-start text-xs font-bold uppercase tracking-wider text-slate-400">{t("sales.accountManager")}</th>
                <th className="px-5 py-3 text-start text-xs font-bold uppercase tracking-wider text-slate-400">
                  {tab === "pending" ? "Assign to Head AM" : "Head Account Manager"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                        {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{c.package}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{c.accountManagerName || "—"}</td>
                  <td className="px-5 py-3">
                    {tab === "assigned" ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        <UserCheck className="w-3.5 h-3.5" />
                        {c.headAccountManagerName}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={draft[c.id] || ""}
                          onChange={(e) => setDraft((p) => ({ ...p, [c.id]: e.target.value }))}
                          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Head AM…</option>
                          {headAccountManagers.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => assign(c, draft[c.id] || "")}
                          disabled={!draft[c.id] || savingId === c.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {savingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                          Assign
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
