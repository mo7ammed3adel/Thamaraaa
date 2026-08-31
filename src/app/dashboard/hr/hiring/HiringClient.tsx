"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, GripVertical } from "lucide-react";
import { createApplicant, updateApplicant } from "@/client/api/hr";
import { useTranslator } from "@/components/i18n/LocaleProvider";

const STAGES = ["New", "HR_Interview", "Department_Interview", "Offer", "Hired", "Rejected"];

export default function HiringClient({ initialApplicants }: { initialApplicants: any[] }) {
  const t = useTranslator();
  const router = useRouter();
  const [applicants, setApplicants] = useState(initialApplicants);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newApp, setNewApp] = useState({ name: "", email: "", phone: "", roleApplied: "", notes: "" });

  const handleAddApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data }: any = await createApplicant(newApp);
    setApplicants([data, ...applicants]);
    setShowAddModal(false);
    setNewApp({ name: "", email: "", phone: "", roleApplied: "", notes: "" });
    router.refresh();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    // Optimistic UI update
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));

    await updateApplicant(id, { status: newStatus });
    router.refresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-6">
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4 me-2" />
          Add Applicant
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageApps = applicants.filter(a => a.status === stage);
          return (
            <div key={stage} className="flex-shrink-0 w-80 bg-gray-50 rounded-xl border border-gray-200 flex flex-col h-[calc(100vh-280px)]">
              <div className="p-3 border-b bg-gray-100 rounded-t-xl font-semibold text-gray-700 flex justify-between items-center">
                <span>{stage.replace("_", " ")}</span>
                <span className="bg-white text-xs px-2 py-0.5 rounded-full border">{stageApps.length}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {stageApps.map(app => (
                  <div key={app.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 group">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900 text-sm">{app.name}</h4>
                      <div className="dropdown relative">
                        <select 
                          className="opacity-0 group-hover:opacity-100 absolute right-0 w-6 cursor-pointer"
                          title={t("common.changeStatus")}
                          value={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value)}
                        >
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition" />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 font-medium">{app.roleApplied}</p>
                    <p className="text-xs text-gray-500 mt-1">{app.phone}</p>
                    {app.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-2 italic">"{app.notes}"</p>}
                  </div>
                ))}
                {stageApps.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-4 italic border-2 border-dashed rounded-lg">{t("hr.noApplicants")}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{t("hr.newApplicant")}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleAddApplicant} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.fullNameRequired")}</label>
                <input required type="text" className="w-full border rounded p-2" value={newApp.name} onChange={e => setNewApp({...newApp, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.emailRequired")}</label>
                  <input required type="email" className="w-full border rounded p-2" value={newApp.email} onChange={e => setNewApp({...newApp, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.phoneRequired")}</label>
                  <input required type="tel" className="w-full border rounded p-2" value={newApp.phone} onChange={e => setNewApp({...newApp, phone: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("hr.roleAppliedFor")}</label>
                <input required type="text" className="w-full border rounded p-2 placeholder-gray-400" placeholder={t("form.jobTitleExample")} value={newApp.roleApplied} onChange={e => setNewApp({...newApp, roleApplied: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("hr.initialNotes")}</label>
                <textarea rows={2} className="w-full border rounded p-2" value={newApp.notes} onChange={e => setNewApp({...newApp, notes: e.target.value})} />
              </div>
              <div className="flex justify-end pt-4">
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">{t("hr.saveApplicant")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
