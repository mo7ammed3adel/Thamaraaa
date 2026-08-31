"use client";

import type { FormEvent } from "react";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type AccountManagerSetupModalProps = {
  setupModalProject: any;
  loadingAction: string | null;
  onClose: () => void;
  handleSaveSetup: (event: FormEvent<HTMLFormElement>) => void;
};

export default function AccountManagerSetupModal({
  setupModalProject,
  loadingAction,
  onClose,
  handleSaveSetup,
}: AccountManagerSetupModalProps) {
  const t = useTranslator();
  if (!setupModalProject) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{t("journey.setupProject")}</h2>
            <p className="text-sm text-slate-500">{setupModalProject.deal?.lead?.name}</p>
          </div>
          <button onClick={onClose} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm font-bold">{t("common.close")}</button>
        </div>

        <form onSubmit={handleSaveSetup} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="rounded-lg bg-slate-50 border p-3">
            <p className="text-xs font-bold text-slate-500 uppercase">{t("common.package")}</p>
            <p className="text-sm font-bold text-slate-900">{setupModalProject.package}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t("journey.niche")}</label>
            <input
              name="niche"
              defaultValue={setupModalProject.niche || setupModalProject.deal?.lead?.niche || ""}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="E-commerce, Real Estate, Clinic..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Technical Deadline</label>
              <input
                type="date"
                name="technicalDeadline"
                defaultValue={setupModalProject.technicalDeadline ? new Date(setupModalProject.technicalDeadline).toISOString().split("T")[0] : ""}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">{t("journey.finalDeadline")}</label>
              <input
                type="date"
                name="finalDeadline"
                defaultValue={setupModalProject.finalDeadline ? new Date(setupModalProject.finalDeadline).toISOString().split("T")[0] : ""}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t("journey.storeUrl")}</label>
            <input
              type="url"
              name="storeUrl"
              defaultValue={setupModalProject.storeUrl || setupModalProject.deal?.lead?.storeLink || ""}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="https://"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Google Drive Link</label>
            <input
              type="url"
              name="driveLink"
              defaultValue={setupModalProject.driveLink || ""}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="https://drive.google.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t("journey.amNotes")}</label>
            <textarea
              name="notes"
              defaultValue={setupModalProject.notes || ""}
              className="w-full border rounded-lg px-3 py-2 text-sm h-32 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Brief, client constraints, priority notes, access notes..."
            />
          </div>

          <div className="pt-4 border-t mt-6">
            <button
              type="submit"
              disabled={loadingAction === "setup"}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg shadow-indigo-200"
            >
              {loadingAction === "setup" ? "Saving..." : "Save Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
