"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WarningResolveButton from "@/components/WarningResolveButton";

const ALL_TEAM_ROLES = [
  "account_manager", "head_account_manager", "chief_sales",
  "head_technical", "head_seo", "team_leader_seo", "agent_seo", "agent_content_seo",
  "team_leader_social_media", "agent_social_media",
  "team_leader_media_buyer", "agent_media_buyer",
  "leader_graphic_designer", "agent_graphic_designer",
  "leader_motion_graphic", "agent_motion_graphic",
  "leader_ui", "agent_ui",
];

export default function WarningsCenterClient({ warnings, leads, userRole, userId }: any) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(ALL_TEAM_ROLES);
  const [sending, setSending] = useState(false);

  const handleCreate = async () => {
    if (!message.trim()) return;
    setSending(true);
    await fetch("/api/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        clientId: selectedClient || null,
        recipientRoles: selectedRoles,
      }),
    });
    setMessage("");
    setSelectedClient("");
    setSending(false);
    setShowCreate(false);
    router.refresh();
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  return (
    <div className="space-y-6">
      {/* Create Warning Button */}
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 shadow-lg shadow-red-200 transition">
          + New Warning
        </button>
      </div>

      {/* Create Warning Form */}
      {showCreate && (
        <div className="bg-red-50 rounded-2xl border-2 border-red-200 p-6">
          <h3 className="text-lg font-bold text-red-800 mb-4">Create Warning</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-red-700 block mb-1">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full border border-red-200 rounded-xl px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-300" placeholder="Describe the warning..." />
            </div>
            <div>
              <label className="text-sm font-medium text-red-700 block mb-1">Related Client (optional)</label>
              <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm">
                <option value="">No specific client</option>
                {leads.map((l: any) => <option key={l.id} value={l.id}>{l.name} - {l.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-red-700 block mb-2">Send to Roles</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedRoles(ALL_TEAM_ROLES)} className="text-xs px-2 py-1 bg-red-200 text-red-800 rounded-full font-medium">Select All</button>
                <button onClick={() => setSelectedRoles([])} className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded-full font-medium">Clear</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {ALL_TEAM_ROLES.map((role) => (
                  <button key={role} onClick={() => toggleRole(role)} className={`px-2 py-1 text-xs rounded-full font-medium transition ${selectedRoles.includes(role) ? "bg-red-600 text-white" : "bg-white border text-slate-500 hover:bg-slate-50"}`}>
                    {role.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50">Cancel</button>
              <button onClick={handleCreate} disabled={sending || !message.trim() || selectedRoles.length === 0} className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {sending ? "Sending..." : "🚨 Send Warning"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warnings List */}
      <div className="space-y-3">
        {warnings.map((w: any) => (
          <div key={w.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🚨</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 leading-relaxed">{w.message}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                  <span>From: <strong className="text-slate-700">{w.senderName}</strong> ({w.senderRole.replace(/_/g, " ")})</span>
                  <span>{new Date(w.createdAt).toLocaleString()}</span>
                </div>
                {/* Recipients */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.recipientList.slice(0, 5).map((r: string) => (
                    <span key={r} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">{r.replace(/_/g, " ")}</span>
                  ))}
                  {w.recipientList.length > 5 && <span className="text-xs text-slate-400">+{w.recipientList.length - 5} more</span>}
                </div>
                {/* Acknowledgments */}
                <div className="mt-3 pt-2 border-t">
                  <p className="text-xs font-medium text-slate-600 mb-1">Acknowledged by ({w.ackList.length}):</p>
                  {w.ackList.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {w.ackList.map((a: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">
                          ✓ {a.userName} ({a.role.replace(/_/g, " ")})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-red-400 italic">No acknowledgments yet</p>
                  )}
                </div>
              </div>
              {/* Resolve Action */}
              <div className="mt-3 pt-2 border-t flex items-center justify-between">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${w.status === "Resolved" ? "bg-green-100 text-green-700" : w.status === "Active" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                  {w.status}
                </span>
                <WarningResolveButton
                  warningId={w.id}
                  senderUserId={w.senderUserId}
                  currentUserId={userId}
                  currentStatus={w.status}
                  onSuccess={() => router.refresh()}
                />
              </div>
            </div>
          </div>
        ))}
        {warnings.length === 0 && <p className="text-sm text-slate-400 italic text-center py-8">No warnings yet.</p>}
      </div>
    </div>
  );
}
