"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import { createCompany, deleteCompany, updateCompany } from "@/client/api/companies";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function CompaniesClient({ initialCompanies }: { initialCompanies: any[] }) {
  const t = useTranslator();
  const router = useRouter();
  const [companies, setCompanies] = useState(initialCompanies);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => router.refresh();

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res: any = await createCompany({ name });
      setCompanies((prev) => [...prev, { ...res.company, _count: { users: 0, leads: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      refresh();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to add company");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await updateCompany(id, { name });
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      refresh();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to rename company");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, name: string) => {
    setBusy(true);
    try {
      await deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      notify(`Deleted "${name}"`);
      refresh();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to delete company");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <form onSubmit={add} className="flex gap-2 bg-white rounded-xl border p-4 shadow-sm">
        <div className="relative flex-1">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New company name…"
            className="w-full ps-9 pe-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button type="submit" disabled={busy || !newName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-start">{t("common.company")}</th>
              <th className="px-6 py-3 text-center">Users</th>
              <th className="px-6 py-3 text-center">{t("team.leads")}</th>
              <th className="px-6 py-3 text-end">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {companies.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No companies yet.</td></tr>
            )}
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 font-semibold text-gray-900">
                  {editingId === c.id ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="border rounded px-2 py-1 text-sm w-full max-w-xs"
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)}
                    />
                  ) : (
                    <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" /> {c.name}</span>
                  )}
                </td>
                <td className="px-6 py-3 text-center text-gray-600">{c._count?.users ?? 0}</td>
                <td className="px-6 py-3 text-center text-gray-600">{c._count?.leads ?? 0}</td>
                <td className="px-6 py-3 text-end space-x-1 whitespace-nowrap">
                  {editingId === c.id ? (
                    <>
                      <button onClick={() => saveEdit(c.id)} disabled={busy} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md" title={t("common.save")}><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md" title={t("common.cancel")}><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md" title="Rename"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remove(c.id, c.name)} disabled={busy} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title={t("common.delete")}><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">A company can only be deleted when no users or leads are linked to it.</p>
    </div>
  );
}
