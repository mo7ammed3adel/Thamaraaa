"use client";

import { useState } from "react";
import { createSelfTask } from "@/client/api/tasks";
import { useTranslator } from "@/components/i18n/LocaleProvider";

/**
 * Maps agent roles to their corresponding department task type.
 * Used when creating self-assigned tasks to set the correct taskType.
 */
function getTaskTypeForRole(role: string): string {
  const roleTaskTypeMap: Record<string, string> = {
    agent_media_buyer: "media_buyer",
    team_leader_media_buyer: "media_buyer",
    agent_social_media: "social_media",
    team_leader_social_media: "social_media",
    agent_seo: "seo",
    agent_content_seo: "content_seo",
    team_leader_seo: "seo",
    head_seo: "seo",
    agent_graphic_designer: "graphic_design",
    leader_graphic_designer: "graphic_design",
    agent_motion_graphic: "motion_graphic",
    leader_motion_graphic: "motion_graphic",
    agent_ui: "ui_design",
    leader_ui: "ui_design",
  };
  return roleTaskTypeMap[role] || "general";
}

interface SelfTaskFormProps {
  /** The project ID to create the task under */
  projectId: string;
  /** The current user's role */
  userRole: string;
  /** Callback to close the modal and optionally refresh data */
  onClose: () => void;
}

/**
 * SelfTaskForm — Allows agents to create tasks for themselves
 * within a specific project. The task is auto-assigned to the
 * creating agent (agentId = leaderId = current user).
 */
export default function SelfTaskForm({ projectId, userRole, onClose }: SelfTaskFormProps) {
  const t = useTranslator();
  const [brief, setBrief] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submits the self-task creation request to the API.
   * Validates required fields before sending.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim()) {
      setError("Brief is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createSelfTask({
        projectId,
        brief: brief.trim(),
        priority,
        deadline: deadline || undefined,
        taskType: getTaskTypeForRole(userRole),
      });

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg font-medium">
          {error}
        </div>
      )}

      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-medium flex items-center gap-2">
        <span className="text-base">🔓</span>
        <span>Self-managed task — no team leader approval needed. Start it whenever you&apos;re ready.</span>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">{t("task.description")}</label>
        <textarea
          required
          rows={4}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={t("task.selfDescribe")}
          className="w-full border-2 border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-500 font-medium bg-slate-50 text-sm transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">{t("common.priority")}</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-medium bg-slate-50 text-sm appearance-none transition"
          >
            <option value="Low">{t("priority.low")}</option>
            <option value="Medium">{t("priority.medium")}</option>
            <option value="High">{t("priority.high")}</option>
            <option value="Urgent">{t("priority.urgent")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">{t("task.deadlineOptional")}</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-medium bg-slate-50 text-sm transition"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className={`flex-1 py-2.5 text-white font-bold rounded-lg transition text-sm ${
            loading ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {loading ? "Creating..." : "Create My Task"}
        </button>
      </div>
    </form>
  );
}
