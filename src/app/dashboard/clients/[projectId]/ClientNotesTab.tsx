import type { Dispatch, SetStateAction } from "react";
import ClientWarningsTab from "./ClientWarningsTab";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type ClientNote = {
  id: string;
  category: string;
  content: string;
  createdAt: string | Date;
  userName?: string | null;
  userRole?: string | null;
};

type ClientWarning = {
  id: string;
  severity?: string | null;
  subject?: string | null;
  message?: string | null;
  createdAt: string | Date;
  sender?: { name?: string | null } | null;
  senderRole?: string | null;
};

type ClientNotesTabProps = {
  warnings?: ClientWarning[];
  notes?: ClientNote[];
  noteCategory: string;
  setNoteCategory: Dispatch<SetStateAction<string>>;
  noteContent: string;
  setNoteContent: Dispatch<SetStateAction<string>>;
  saving: boolean;
  handleAddNote: () => void;
};

const categoryColors: Record<string, string> = {
  telesales: "bg-blue-50 border-blue-200 text-blue-700",
  sales: "bg-purple-50 border-purple-200 text-purple-700",
  account_manager: "bg-amber-50 border-amber-200 text-amber-700",
  technical: "bg-indigo-50 border-indigo-200 text-indigo-700",
  design: "bg-pink-50 border-pink-200 text-pink-700",
  general: "bg-slate-50 border-slate-200 text-slate-700",
};

export default function ClientNotesTab({
  warnings,
  notes = [],
  noteCategory,
  setNoteCategory,
  noteContent,
  setNoteContent,
  saving,
  handleAddNote,
}: ClientNotesTabProps) {
  const t = useTranslator();
  return (
    <div className="space-y-4">
      <ClientWarningsTab warnings={warnings || []} />

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">{t("journey.addNote")}</h2>
        <div className="flex gap-3">
          <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[120px]">
            <option value="general">{t("common.general")}</option>
            <option value="telesales">TeleSales</option>
            <option value="sales">{t("team.sales")}</option>
            <option value="account_manager">Account Mgr</option>
            <option value="technical">{t("team.technical")}</option>
            <option value="design">{t("team.design")}</option>
          </select>
          <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write a note visible to all departments..." className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none h-20" />
          <button onClick={handleAddNote} disabled={!noteContent.trim() || saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium self-end hover:bg-indigo-700 disabled:opacity-50 transition">
            {saving ? "..." : "Add"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">All Notes ({notes.length})</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const colors = categoryColors[note.category] || categoryColors.general;
              return (
                <div key={note.id} className={`${colors} border rounded-lg p-4`}>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{note.category.replace(/_/g, " ")}</span>
                      <span className="text-xs opacity-50">•</span>
                      <span className="text-xs font-medium">{note.userName}</span>
                      <span className="text-xs opacity-50 capitalize">({(note.userRole || "").replace(/_/g, " ")})</span>
                    </div>
                    <span className="text-xs opacity-50">{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{note.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
