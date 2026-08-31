"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ExternalLink, Trash2, FileWarning, FolderOpen } from "lucide-react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import { createDocument, deleteDocument, listDocuments } from "@/client/api/hr";
import { HR_DOC_LABELS } from "@/lib/hrOverview";
import { useTranslator } from "@/components/i18n/LocaleProvider";

function parseChecklist(json?: string | null): Record<string, boolean> {
  if (!json) return {};
  try { const p = JSON.parse(json); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}

export default function HrDocuments({ employees = [] }: { employees?: any[] }) {
  const t = useTranslator();
  const [selected, setSelected] = useState("");
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const employee = employees.find((e: any) => e.id === selected);

  const load = useCallback(() => {
    if (!selected) { setDocs([]); return; }
    setLoading(true);
    listDocuments({ userId: selected })
      .then((d: any) => setDocs(d?.documents || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const checklist = parseChecklist(employee?.hrRecord?.documentChecklist);
  const isMale = (employee?.hrRecord?.gender || "").toLowerCase().startsWith("m");
  const reqKeys = Object.keys(HR_DOC_LABELS).filter((k) => !(k === "militaryStatus" && !isMale));
  const missing = reqKeys.filter((k) => !checklist[k]);

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    setBusy(true);
    try {
      await createDocument({ userId: selected, name: fd.get("name"), fileUrl: fd.get("fileUrl") });
      notify("Document added");
      form.reset();
      load();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Failed to add document");
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (id: string) => {
    try { await deleteDocument(id); load(); }
    catch (err) { notify(err instanceof HttpError ? err.message : "Failed to delete"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <FolderOpen className="w-5 h-5 text-slate-500" />
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
          <option value="">{t("form.selectEmployee")}</option>
          {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.hrRecord?.employeeCode ? ` (${e.hrRecord.employeeCode})` : ""}</option>)}
        </select>
      </div>

      {!selected ? (
        <div className="bg-white border rounded-xl p-12 text-center text-slate-400 italic">Select an employee to open their digital file.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Required documents checklist */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><FileWarning className="w-4 h-4" /></span>
              <h3 className="font-bold text-slate-800">Required Documents</h3>
              {missing.length > 0 && <span className="ms-auto text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{missing.length} missing</span>}
            </div>
            <div className="p-4 grid grid-cols-1 gap-2">
              {reqKeys.map((k) => (
                <div key={k} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <span className="text-slate-600">{HR_DOC_LABELS[k]}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${checklist[k] ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{checklist[k] ? "Uploaded" : "Missing"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Files */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><FileText className="w-4 h-4" /></span>
              <h3 className="font-bold text-slate-800">Employee File</h3>
            </div>
            <div className="p-4 space-y-3">
              <form onSubmit={addDoc} className="grid grid-cols-12 gap-2">
                <input name="name" required placeholder="Document name (Contract, ID…)" className="col-span-5 border rounded-lg px-2 py-1.5 text-xs" />
                <input name="fileUrl" required type="url" placeholder="https://… (drive link)" className="col-span-5 border rounded-lg px-2 py-1.5 text-xs" />
                <button type="submit" disabled={busy} className="col-span-2 bg-slate-900 text-white rounded-lg text-xs font-bold disabled:opacity-50">{t("common.add")}</button>
              </form>
              {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
                <div className="space-y-1.5">
                  {docs.length === 0 && <p className="text-sm text-slate-400 italic">{t("empty.noFiles")}</p>}
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium text-slate-700">{d.name}</span>
                        <span className="block text-[10px] text-slate-400">{new Date(d.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600" title="Open"><ExternalLink className="w-4 h-4" /></a>
                        <button onClick={() => removeDoc(d.id)} className="text-red-500" title={t("common.delete")}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
