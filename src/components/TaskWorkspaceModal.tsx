"use client";

import { useMemo, useState } from "react";
import { X, Loader2, Plus, ExternalLink, Trash2, Flag, CheckCircle2 } from "lucide-react";
import { createNote } from "@/client/api/notes";
import { addProjectFile } from "@/client/api/projects";
import { updateTask } from "@/client/api/tasks";

/**
 * Maps an agent/leader role to the Note category it should write under,
 * matching the categories defined in the spec (section 4.7).
 */
const ROLE_NOTE_CATEGORY: Record<string, string> = {
  agent_seo: "seo",
  team_leader_seo: "seo",
  head_seo: "seo",
  agent_content_seo: "content_seo",
  agent_social_media: "social_media",
  team_leader_social_media: "social_media",
  agent_media_buyer: "media_buyer",
  team_leader_media_buyer: "media_buyer",
  agent_graphic_designer: "design",
  leader_graphic_designer: "design",
  agent_motion_graphic: "motion_graphic",
  leader_motion_graphic: "motion_graphic",
  agent_ui: "ui_design",
  leader_ui: "ui_design",
};

interface DeliverableLink {
  label: string;
  url: string;
}

interface TaskWorkspaceModalProps {
  task: any;
  projectId: string;
  clientName?: string;
  contextNotes?: any[];
  userRole: string;
  onClose: () => void;
  onSuccess: () => void;
  onFlag?: () => void;
}

function safeParseArray(raw: unknown): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * TaskWorkspaceModal — the execution workspace for an agent (or self-managed
 * leader) working a single task. It centralises every action the spec grants
 * an Operations agent: start/submit-for-review, progress %, checklist, upload
 * deliverable links, add a contextual note, and flag back to the team leader.
 *
 * Reused across every agent role (SEO, Content, Social, Media, Graphic,
 * Motion, UI) — the only role-specific bit is the note category.
 */
export default function TaskWorkspaceModal({
  task,
  projectId,
  clientName,
  contextNotes = [],
  userRole,
  onClose,
  onSuccess,
  onFlag,
}: TaskWorkspaceModalProps) {
  const [status, setStatus] = useState<string>(task.status || "pending");
  const [progress, setProgress] = useState<number>(Math.round(task.progressPct || 0));
  const [checklist, setChecklist] = useState<any[]>(() => safeParseArray(task.checklistItems));
  const [deliverables, setDeliverables] = useState<DeliverableLink[]>(() => safeParseArray(task.files));
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noteCategory = ROLE_NOTE_CATEGORY[userRole] || "general";
  const isOverdue = task.deadline && task.status !== "done" && new Date(task.deadline) < new Date();

  const checklistProgress = useMemo(() => {
    if (!checklist.length) return null;
    const done = checklist.filter((c) => c.completed).length;
    return Math.round((done / checklist.length) * 100);
  }, [checklist]);

  async function patchTask(payload: Record<string, unknown>, action: string) {
    setBusy(action);
    setError(null);
    try {
      await updateTask(task.id, payload);
      return true;
    } catch (e: any) {
      setError(e.message || "Network error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const handleStatus = async (next: string) => {
    const ok = await patchTask({ status: next }, `status-${next}`);
    if (ok) {
      setStatus(next);
      onSuccess();
    }
  };

  const handleSaveProgress = async () => {
    const ok = await patchTask({ progressPct: progress }, "progress");
    if (ok) onSuccess();
  };

  const handleToggleChecklist = async (index: number) => {
    const updated = checklist.map((c, i) => (i === index ? { ...c, completed: !c.completed } : c));
    setChecklist(updated);
    const done = updated.filter((c) => c.completed).length;
    const pct = updated.length ? Math.round((done / updated.length) * 100) : progress;
    setProgress(pct);
    await patchTask({ checklistItems: JSON.stringify(updated), progressPct: pct }, "checklist");
    onSuccess();
  };

  const handleAddDeliverable = async () => {
    if (!newUrl.trim()) {
      setError("Deliverable link is required");
      return;
    }
    const entry: DeliverableLink = { label: newLabel.trim() || "Deliverable", url: newUrl.trim() };
    const updated = [...deliverables, entry];

    setBusy("deliverable");
    setError(null);
    try {
      // Persist on the task so it stays attached to the work item…
      await updateTask(task.id, { files: JSON.stringify(updated) });
      // …and mirror it into the project Files tab so the Account Manager sees it.
      await addProjectFile(projectId, { fileUrl: entry.url, fileType: `${noteCategory} deliverable` }).catch(() => {});

      setDeliverables(updated);
      setNewLabel("");
      setNewUrl("");
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  const handleRemoveDeliverable = async (index: number) => {
    const updated = deliverables.filter((_, i) => i !== index);
    setDeliverables(updated);
    await patchTask({ files: JSON.stringify(updated) }, "deliverable-remove");
    onSuccess();
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setBusy("note");
    setError(null);
    try {
      await createNote({ projectId, content: note.trim(), category: noteCategory });
      setNote("");
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  const priorityColor =
    task.priority === "Urgent" || task.priority === "High"
      ? "bg-red-100 text-red-700 border-red-200"
      : task.priority === "Low"
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-5 flex items-start justify-between gap-4 z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg text-slate-900 uppercase">{(task.taskType || "task").replace(/_/g, " ")}</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColor}`}>{task.priority || "Medium"}</span>
              {isOverdue && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">OVERDUE</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {clientName || "Client"}
              {task.deadline && <span className="ms-2">· Due {new Date(task.deadline).toLocaleDateString()}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium">{error}</div>
          )}

          {/* Brief */}
          {task.brief && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Brief</h4>
              <p className="text-sm text-slate-700 bg-slate-50 border rounded-lg p-3 whitespace-pre-wrap">{task.brief}</p>
            </div>
          )}

          {/* Status workflow */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "pending", label: "Pending / On Hold" },
                { key: "in_progress", label: "Start / In Progress" },
                { key: "review", label: "Submit for Review" },
              ].map((s) => (
                <button
                  key={s.key}
                  disabled={!!busy}
                  onClick={() => handleStatus(s.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold border transition disabled:opacity-50 ${
                    status === s.key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {busy === `status-${s.key}` ? <Loader2 className="w-4 h-4 animate-spin" /> : s.label}
                </button>
              ))}
              {status === "done" && (
                <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" /> Done
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Submit for review — your team leader approves the final &quot;Done&quot;.</p>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progress</h4>
              <span className="text-sm font-black text-indigo-700">{progress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                disabled={busy === "progress"}
                onClick={handleSaveProgress}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy === "progress" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Progress
              </button>
              {checklistProgress !== null && (
                <span className="text-[11px] text-slate-400">Checklist completion: {checklistProgress}%</span>
              )}
            </div>
          </div>

          {/* Checklist */}
          {checklist.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Checklist</h4>
              <div className="space-y-1.5">
                {checklist.map((item, i) => (
                  <label key={item.id || i} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!item.completed}
                      onChange={() => handleToggleChecklist(i)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                    <span className={item.completed ? "line-through text-slate-400" : ""}>{item.title || item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Deliverables / Links</h4>
            {deliverables.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline truncate">
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{d.label}</span>
                    </a>
                    <button onClick={() => handleRemoveDeliverable(i)} className="text-slate-400 hover:text-red-600 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (e.g. Figma, Canva, Drive)"
                className="sm:w-40 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                disabled={busy === "deliverable"}
                onClick={handleAddDeliverable}
                className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {busy === "deliverable" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
              </button>
            </div>
          </div>

          {/* Context notes */}
          {contextNotes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Client Context Notes</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {contextNotes.slice(0, 6).map((n: any) => (
                  <div key={n.id} className="text-xs text-slate-600 bg-slate-50 border rounded-lg p-2">
                    <span className="font-bold text-slate-800">{n.userName || n.userRole}</span>
                    <span className="text-slate-400"> · {(n.category || "general").replace(/_/g, " ")}</span>
                    <p className="mt-0.5">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add note */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Add Note</h4>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Share an update or blocker with the team…"
              className="w-full border-2 border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-indigo-500"
            />
            <button
              disabled={busy === "note" || !note.trim()}
              onClick={handleAddNote}
              className="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy === "note" && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Post Note
            </button>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <a
              href={`/dashboard/clients/${projectId}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ExternalLink className="w-4 h-4" /> Client Full Journey
            </a>
            {onFlag && (
              <button
                onClick={onFlag}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-bold hover:bg-orange-100 transition"
              >
                <Flag className="w-4 h-4" /> Flag / Return
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
