"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface CreateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
  projectId?: string;
  defaultRecipientRole?: string;
}

export default function CreateWarningModal({ isOpen, onClose, clientId, projectId, defaultRecipientRole }: CreateWarningModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [recipientRoles, setRecipientRoles] = useState<string[]>(defaultRecipientRole ? [defaultRecipientRole] : []);
  const [loading, setLoading] = useState(false);

  const availableRoles = [
    "chief_sales", "head_account_manager", "account_manager", "head_technical",
    "team_leader_seo", "team_leader_media_buyer", "team_leader_social_media",
    "leader_graphic_designer", "leader_motion_graphic", "leader_ui"
  ];

  const handleRoleToggle = (role: string) => {
    setRecipientRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message || recipientRoles.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/warnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          severity,
          recipientRoles,
          clientId,
          projectId
        })
      });

      if (res.ok) {
        onClose();
        setSubject("");
        setMessage("");
        setSeverity("Medium");
        setRecipientRoles(defaultRecipientRole ? [defaultRecipientRole] : []);
      } else {
        alert("Failed to send warning");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending warning");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
          <h2 className="text-lg font-bold text-red-800">Send System Warning</h2>
          <button onClick={onClose} className="p-1 hover:bg-red-100 rounded-full text-red-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="E.g., Client Missing Documentation"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            >
              <option value="Low">Low - FYI</option>
              <option value="Medium">Medium - Needs Attention</option>
              <option value="High">High - Urgent</option>
              <option value="Critical">Critical - Blocking Delivery</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Notify Roles</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-100 rounded-lg bg-slate-50">
              {availableRoles.map(role => (
                <label key={role} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recipientRoles.includes(role)}
                    onChange={() => handleRoleToggle(role)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  {role.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
            {recipientRoles.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one role to notify</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Message Details</label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 h-24 resize-none"
              placeholder="Describe the issue in detail..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || recipientRoles.length === 0 || !subject || !message}
              className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending..." : "Send Warning"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
