"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HeadTechnicalClient({ projects, teamLeaders, userId }: any) {
  const router = useRouter();
  const [assignModal, setAssignModal] = useState<any>(null);

  const handleAssignToTeamLeader = async (projectId: string, leaderId: string, taskType: string) => {
    await fetch("/api/tasks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        packageType: taskType,
        socialLeaderId: taskType === "social_media" ? leaderId : undefined,
        mediaLeaderId: taskType === "media_buying" ? leaderId : undefined,
      }),
    });
    setAssignModal(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 text-center">
          <p className="text-sm text-indigo-600">Active Projects</p>
          <p className="text-3xl font-bold text-indigo-700">{projects.length}</p>
        </div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center">
          <p className="text-sm text-emerald-600">Tasks Assigned</p>
          <p className="text-3xl font-bold text-emerald-700">{projects.reduce((s: number, p: any) => s + (p.tasks?.length || 0), 0)}</p>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-center">
          <p className="text-sm text-amber-600">Team Leaders</p>
          <p className="text-3xl font-bold text-amber-700">{teamLeaders.length}</p>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-indigo-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Account Manager</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Package</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Teams Assigned</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {projects.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{p.accountManager?.name || "N/A"}</td>
                <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">{p.package}</span></td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.priority === "High" ? "bg-red-100 text-red-700" : p.priority === "Low" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>
                    {p.priority || "Medium"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{p.tasks?.length || 0} tasks</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold ${p.projectStatus === "in_progress" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {p.projectStatus.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setAssignModal(p)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition">
                    Assign Team
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Assign Team for: {assignModal.deal?.lead?.name}</h3>
            <p className="text-sm text-slate-500 mb-4">Select a team leader to assign this project to:</p>
            <div className="space-y-2">
              {teamLeaders.map((tl: any) => (
                <button
                  key={tl.id}
                  onClick={() => handleAssignToTeamLeader(assignModal.id, tl.id, tl.role.includes("social") ? "social_media" : "media_buying")}
                  className="w-full text-left p-3 bg-slate-50 hover:bg-indigo-50 border rounded-lg transition flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{tl.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{tl.role.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-indigo-600 text-xs font-medium">Assign →</span>
                </button>
              ))}
              {teamLeaders.length === 0 && <p className="text-sm text-slate-400 italic">No team leaders available</p>}
            </div>
            <button onClick={() => setAssignModal(null)} className="mt-4 w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Team Leaders Performance */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Team Leaders</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {teamLeaders.map((tl: any) => (
            <div key={tl.id} className="bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition">
              <p className="text-sm font-bold text-slate-800">{tl.name}</p>
              <p className="text-xs text-slate-500 capitalize">{tl.role.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
