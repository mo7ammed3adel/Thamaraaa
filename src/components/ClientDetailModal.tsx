"use client";

import { X } from "lucide-react";
import ClientJourney from "./ClientJourney";
import NotesPanel from "./NotesPanel";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface ClientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  currentUserRole: string;
}

export default function ClientDetailModal({ isOpen, onClose, project, currentUserRole }: ClientDetailModalProps) {
  const t = useTranslator();
  if (!isOpen || !project) return null;

  const lead = project.deal?.lead || {};
  const deal = project.deal || {};

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{lead.name || "Client Details"}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Package: <span className="font-semibold text-indigo-700">{project.package}</span> | 
              Status: <span className="font-semibold text-emerald-600">{project.projectStatus}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            
            {/* Left Column: Details & Details */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">{t("journey.clientInfo")}</h3>
                <div className="space-y-3 text-sm">
                  <div><span className="text-slate-500 block text-xs">{t("common.phone")}</span><span className="font-medium">{lead.phone || "N/A"}</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("modal.niche")}</span><span className="font-medium">{project.niche || lead.niche || "N/A"}</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("journey.hasStore")}</span><span className="font-medium">{lead.hasStore ? "Yes" : "No"}</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("sales.storeLink")}</span><span className="font-medium text-blue-600 hover:underline">{project.storeUrl || lead.storeLink || "N/A"}</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("modal.driveLink")}</span><span className="font-medium text-blue-600 hover:underline">{project.driveLink || "N/A"}</span></div>
                </div>
              </div>

              {/* Deal Info */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">{t("journey.dealInfo")}</h3>
                <div className="space-y-3 text-sm">
                  <div><span className="text-slate-500 block text-xs">{t("modal.totalAmount")}</span><span className="font-medium">{deal.totalAmount?.toLocaleString() || 0} SAR</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("deal.paymentMethod")}</span><span className="font-medium">{deal.paymentMethod || "N/A"}</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("telesales.salesAgent")}</span><span className="font-medium">{deal.salesAgent?.name || "N/A"}</span></div>
                  <div><span className="text-slate-500 block text-xs">{t("modal.contractDate")}</span><span className="font-medium">{deal.contractStart ? new Date(deal.contractStart).toLocaleDateString() : "N/A"}</span></div>
                </div>
              </div>
            </div>

            {/* Middle Column: Client Journey */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm overflow-auto max-h-[80vh]">
              <h3 className="font-bold text-slate-800 mb-4 sticky top-0 bg-white pb-2 border-b border-slate-100 z-10">{t("modal.lifecycleJourney")}</h3>
              <ClientJourney 
                leadName={lead.name}
                phone={lead.phone}
                callLogs={lead.callLogs}
                meetings={lead.meetings}
                deals={lead.deals}
                tasks={project.tasks}
                globalNotes={project.globalNotes}
                projectNotes={project.notes}
              />
            </div>

            {/* Right Column: Global Notes System */}
            <div className="h-full">
              <NotesPanel projectId={project.id} currentUserRole={currentUserRole} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
