"use client";

import { useState } from "react";
import { CROSS_TEAM_TASK_TYPES } from "@/lib/constants";

export default function CrossTeamTaskForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [taskType, setTaskType] = useState<string>(CROSS_TEAM_TASK_TYPES[0]);
  const [brief, setBrief] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskType, brief, priority }),
      });

      if (!res.ok) {
        throw new Error("Failed to create task");
      }

      onClose(); // Automatically close overlay on success
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 bg-red-100 text-red-700 text-sm rounded">{error}</div>}

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Task Category</label>
        <select 
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="w-full border-2 border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500 font-medium bg-slate-50 relative appearance-none"
        >
          {CROSS_TEAM_TASK_TYPES.map(type => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">Priority</label>
        <select 
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full border-2 border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-500 font-medium bg-slate-50 appearance-none"
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
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
