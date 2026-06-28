"use client";

import { useState, useEffect } from "react";
import { notify } from "@/components/toast";
import { X, Plus, Trash2 } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import { createTask } from "@/client/api/tasks";

interface TaskAssignmentFormProps {
  projectId: string;
  projectNiche?: string;
  onSuccess: () => void;
}

export default function TaskAssignmentForm({ projectId, projectNiche, onSuccess }: TaskAssignmentFormProps) {
  const [taskType, setTaskType] = useState("social_media");
  const [priority, setPriority] = useState("Medium");
  const [brief, setBrief] = useState("");
  const [deadline, setDeadline] = useState("");
  const [checklist, setChecklist] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);

  const taskTypes = [
    { id: "social_media", label: "Social Media Campaign" },
    { id: "media_buyer", label: "Media Buyer / Ads" },
    { id: "seo", label: "SEO Optimization" },
    { id: "content_seo", label: "SEO Content Writing" },
    { id: "graphic_design", label: "Graphic Design" },
    { id: "motion_graphic", label: "Motion Graphic" },
    { id: "ui_design", label: "UI/UX Design" },
    { id: "technical", label: "Technical Setup / Store" }
  ];

  const handleAddChecklist = () => setChecklist([...checklist, ""]);
  const handleRemoveChecklist = (i: number) => setChecklist(checklist.filter((_, index) => index !== i));
  const handleUpdateChecklist = (i: number, val: string) => {
    const newArr = [...checklist];
    newArr[i] = val;
    setChecklist(newArr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Filter out empty checklist items and format as JSON
    const validChecklist = checklist.filter(item => item.trim() !== "");
    const checklistItems = JSON.stringify(validChecklist.map(item => ({ text: item, completed: false })));

    try {
      await createTask({
        projectId,
        taskType,
        priority,
        brief,
        deadline: deadline || null,
        checklistItems
      });

      setTaskType("social_media");
      setBrief("");
      setPriority("Medium");
      setDeadline("");
      setChecklist([""]);
      onSuccess();
    } catch (err) {
      if (err instanceof HttpError) {
        notify(`Failed: ${err.message || "Unknown error"}`);
        return;
      }
      notify("Error creating task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Assign New Task</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Task Department / Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              {taskTypes.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Deadline (Optional)</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Creative Brief / Description</label>
          <textarea
            required
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none focus:border-indigo-500"
            placeholder="Provide context, references, or instructions..."
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex justify-between items-center">
            <span>Checklist Deliverables</span>
            <button 
              type="button" 
              onClick={handleAddChecklist}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium bg-indigo-50 px-2 py-1 rounded"
            >
              <Plus size={14} /> Add Item
            </button>
          </label>
          
          <div className="space-y-2">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleUpdateChecklist(index, e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                  placeholder={`Deliverable ${index + 1}`}
                  required={index === 0} // First item is required, others optional
                />
                {checklist.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveChecklist(index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={loading || !brief}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Assigning..." : "Assign Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
