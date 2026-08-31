"use client";

import { useState } from "react";
import { CROSS_TEAM_TASK_TYPES } from "@/lib/constants";
import { createTask } from "@/client/api/tasks";
import { useTranslator } from "@/components/i18n/LocaleProvider";

/**
 * Returns allowed cross-team task types based on the requesting user's role.
 * - SEO / Content SEO agents → graphic_design, ui_design, content_seo only
 * - Social Media / Media Buyer agents → graphic_design, motion_graphic, ui_design
 * - All others → all cross-team types
 */
function getAllowedTaskTypes(userRole: string): string[] {
  const seoRoles = ["agent_seo", "agent_content_seo", "team_leader_seo", "head_seo"];
  const mediaRoles = ["agent_social_media", "agent_media_buyer", "team_leader_social_media", "team_leader_media_buyer"];

  if (seoRoles.includes(userRole)) {
    return ["graphic_design", "ui_design", "content_seo"];
  }
  if (mediaRoles.includes(userRole)) {
    return ["graphic_design", "motion_graphic", "ui_design"];
  }
  return [...CROSS_TEAM_TASK_TYPES];
}

interface CrossTeamTaskFormProps {
  projectId: string;
  onClose: () => void;
  userRole?: string;
  /** When set, the form is locked to this single task type and the picker is hidden. */
  lockedTaskType?: string;
}

export default function CrossTeamTaskForm({ projectId, onClose, userRole = "", lockedTaskType }: CrossTeamTaskFormProps) {
  const t = useTranslator();
  const allowedTypes = lockedTaskType ? [lockedTaskType] : getAllowedTaskTypes(userRole);
  const [taskType, setTaskType] = useState<string>(allowedTypes[0]);
  const [brief, setBrief] = useState("");
  const [taskLink, setTaskLink] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createTask({ projectId, taskType, brief, taskLink: taskLink || undefined, priority });

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 bg-red-100 text-red-700 text-sm rounded">{error}</div>}

      {!lockedTaskType && (
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Task Category</label>
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500 font-medium bg-slate-50 relative appearance-none"
          >
            {allowedTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">{t("common.priority")}</label>
        <select 
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full border-2 border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500 font-medium bg-slate-50 appearance-none"
        >
          <option value="Low">{t("priority.low")}</option>
          <option value="Medium">{t("priority.medium")}</option>
          <option value="High">{t("priority.high")}</option>
          <option value="Urgent">{t("priority.urgent")}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Task Link (optional)</label>
        <input 
          type="url"
          value={taskLink}
          onChange={(e) => setTaskLink(e.target.value)}
          placeholder="https://example.com/reference-material"
          className="w-full border-2 border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500 font-medium bg-slate-50"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Task Brief</label>
        <textarea 
          required
          rows={4}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe what needs to be done..."
          className="w-full border-2 border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500 font-medium bg-slate-50"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button 
          type="button" 
          onClick={onClose}
          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={loading}
          className={`flex-1 py-2 text-white font-bold rounded-lg transition ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          {loading ? "Creating..." : "Request Task"}
        </button>
      </div>
    </form>
  );
}
