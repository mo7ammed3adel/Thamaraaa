"use client";

import { useState, useEffect } from "react";
import { notify } from "@/components/toast";
import { MessageSquare, Send } from "lucide-react";
import { createNote, listNotes } from "@/client/api/notes";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface Note {
  id: string;
  projectId: string;
  userId: string;
  userRole: string;
  userName: string;
  content: string;
  category: string;
  createdAt: string;
}

interface NotesPanelProps {
  projectId: string;
  currentUserRole: string;
}

export default function NotesPanel({ projectId, currentUserRole }: NotesPanelProps) {
  const t = useTranslator();
  const [filterCategory, setFilterCategory] = useState("all");

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const determineCategory = (role: string) => {
    if (role.includes("sales")) return "sales";
    if (role.includes("account")) return "account_manager";
    if (role.includes("technical") || role.includes("seo") || role.includes("media") || role.includes("social")) return "technical";
    if (role.includes("design") || role.includes("ui")) return "design";
    return "general";
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const data = await listNotes({ projectId, category: filterCategory !== "all" ? filterCategory : undefined });
      setNotes(data.notes || []);
    } catch (e) {
      console.error("Failed to load notes", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [projectId, filterCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    try {
      const { note } = await createNote({
        projectId,
        content: newNote,
        category: determineCategory(currentUserRole)
      });
      setNotes([note, ...notes]);
      setNewNote("");
    } catch (e) {
      notify("Failed to add note");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case "sales": return "bg-purple-100 text-purple-800 border-purple-200";
      case "account_manager": return "bg-amber-100 text-amber-800 border-amber-200";
      case "technical": return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "design": return "bg-pink-100 text-pink-800 border-pink-200";
      default: return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="bg-white border text-sm border-slate-200 rounded-xl overflow-hidden flex flex-col h-[500px]">
      <div className="bg-slate-50 border-b border-slate-200 p-3 font-bold text-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-slate-500" />
          Global Project Notes
        </div>
        
        <div className="flex items-center gap-2 text-xs font-normal">
          <span className="text-slate-500">Filter:</span>
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">{t("filter.allDepartments")}</option>
            <option value="sales">{t("team.sales")}</option>
            <option value="account_manager">Account Management</option>
            <option value="technical">{t("team.technical")}</option>
            <option value="design">{t("team.design")}</option>
            <option value="general">{t("common.general")}</option>
          </select>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {loading ? (
          <div className="flex justify-center p-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>
        ) : notes.length === 0 ? (
          <div className="text-center text-slate-400 py-8 italic text-xs">No notes added to this project yet.</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className={`bg-white border rounded-lg p-3 shadow-sm`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold text-slate-700">{note.userName}</span>
                  <span className="text-slate-400 text-xs ms-2">({note.userRole.replace(/_/g, ' ')})</span>
                </div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getCategoryColor(note.category)}`}>
                  {note.category.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
              <div className="text-end text-xs text-slate-400 mt-2">
                {new Date(note.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a new note to the project history..."
            className="w-full border border-slate-200 rounded-lg ps-3 pe-10 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!newNote.trim() || submitting}
            className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span>Notes are visible to all assignees</span>
        </div>
      </div>
    </div>
  );
}
