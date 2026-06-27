"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ProjectLogsPanel from "@/components/ProjectLogsPanel";
import { buildClientJourneyTimeline } from "@/lib/clientJourneyTimeline";
import ClientTasksTab from "./ClientTasksTab";
import ClientTimelineTab from "./ClientTimelineTab";

const TABS = [
  { key: "timeline", label: "📋 Timeline", icon: "📋" },
  { key: "client", label: "👤 Client Info", icon: "👤" },
  { key: "deal", label: "💰 Deal Info", icon: "💰" },
  { key: "team", label: "👥 Team Assignment", icon: "👥" },
  { key: "tasks", label: "✅ Tasks", icon: "✅" },
  { key: "progress", label: "📊 Progress", icon: "📊" },
  { key: "notes", label: "📝 Notes", icon: "📝" },
  { key: "files", label: "📁 Files", icon: "📁" },
  { key: "logs", label: "⚙️ System Logs", icon: "⚙️" },
];

/**
 * Client Full Journey — the central truth page.
 * Shows everything about a client across all departments in one place.
 */
export default function ClientFullJourneyClient({ project, userRole, userId, userName, teamMembers = [], initialTab = "timeline" }: any) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("other");
  const [uploadingFile, setUploadingFile] = useState(false);

  const [newTaskType, setNewTaskType] = useState("seo");
  const [newTaskBrief, setNewTaskBrief] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskLink, setNewTaskLink] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  // ── Task Filters ──
  const [taskFilterTeam, setTaskFilterTeam] = useState("all");
  const [taskFilterStatus, setTaskFilterStatus] = useState("all");
  const [taskFilterCreator, setTaskFilterCreator] = useState("all");

  const deal = project.deal;
  const lead = deal?.lead;

  // ── Task handler ──
  async function handleCreateTask() {
    if (!newTaskBrief) return alert("Please enter task details");
    setCreatingTask(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        taskType: newTaskType,
        brief: newTaskBrief,
        priority: newTaskPriority,
        deadline: newTaskDeadline || undefined,
        taskLink: newTaskLink.trim() || undefined,
      })
    });
    setNewTaskBrief("");
    setNewTaskLink("");
    setCreatingTask(false);
    router.refresh();
  }

  // ── Note handler ──
  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, content: noteContent, category: noteCategory }),
    });
    setNoteContent("");
    setSaving(false);
    router.refresh();
  }

  // ── Project file handler ──
  async function handleUploadProjectFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fileUrl.trim()) return;

    setUploadingFile(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: fileUrl.trim(), fileType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Failed to upload project file");
        return;
      }

      setFileUrl("");
      setFileType("other");
      router.refresh();
    } catch (err) {
      alert("Network error — could not reach server.");
    } finally {
      setUploadingFile(false);
    }
  }

  // ── Warning handler ──
  async function handleCreateWarning() {
    const message = prompt("Warning message for all teams:");
    if (!message) return;
    await fetch("/api/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `⚠️ ${lead?.name}: ${message}`,
        clientId: lead?.id,
        projectId: project.id,
        recipientRoles: [
          "account_manager", "head_account_manager", "head_technical", "head_seo",
          "team_leader_seo", "team_leader_social_media", "team_leader_media_buyer",
          "agent_seo", "agent_social_media", "agent_media_buyer",
          "leader_graphic_designer", "agent_graphic_designer",
          "leader_motion_graphic", "agent_motion_graphic", "leader_ui", "agent_ui",
        ],
      }),
    });
    router.refresh();
  }

  // ── Task-level Assignment Handler ──
  async function handleAssignUser(taskId: string, field: "leaderId" | "agentId", newValue: string) {
    if (!taskId || !newValue) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Assignment failed: ${data.error || "Unknown error"}`);
        return;
      }
      router.refresh();
    } catch (err) {
      alert("Network error — could not reach server.");
    }
  }

  // ── Task Status Update Handler ──
  async function handleUpdateStatus(taskId: string, status: string) {
    try {
      const payload: any = { status };
      if (status === "done") payload.completedAt = new Date().toISOString();
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update status");
        return;
      }
      router.refresh();
    } catch (err) {
      alert("Network error — could not reach server.");
    }
  }

  // ── Task Progress Update Handler ──
  async function handleUpdateProgress(taskId: string, progressPct: number) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPct }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update progress");
        return;
      }
      router.refresh();
    } catch (err) {
      alert("Network error — could not reach server.");
    }
  }

  // ── Team Assignment Handler (Bulk update & TeamAssignment records) ──
  async function handleTeamAssignment(department: string, roleType: "leader" | "agent", newUserId: string) {
    if (!department || !newUserId) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/team-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, assignedRoleType: roleType, newUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Assignment failed: ${data.error || "Unknown error"}`);
        return;
      }
      router.refresh();
    } catch (err) {
      alert("Network error — could not reach server.");
    }
  }

  const safeUserRole = userRole || "";
  const isAdmin = ["super_admin", "head_account_manager"].includes(safeUserRole);
  const canUploadProjectFiles = ["super_admin", "head_account_manager", "account_manager", "head_technical", "head_seo"].includes(safeUserRole);

  function canManageTeamSlot(department: string, roleType: "leader" | "agent") {
    if (isAdmin) return true;
    if (safeUserRole === "head_technical") {
      return roleType === "leader" && ["Social Media", "Media Buyer"].includes(department);
    }
    if (safeUserRole === "head_seo") {
      return roleType === "leader" && department === "SEO";
    }
    return false;
  }

  // ── Build Team Assignment Grid ──
  function buildTeamGrid() {
    const departments = [
      { name: "SEO", types: ["SEO", "seo", "content_seo"], deptCodes: ["seo", "content_seo"], leaderRoles: ["team_leader_seo"], agentRoles: ["agent_seo", "agent_content_seo"] },
      { name: "Social Media", types: ["Social_Media", "social_media"], deptCodes: ["social_media"], leaderRoles: ["team_leader_social_media"], agentRoles: ["agent_social_media"] },
      { name: "Media Buyer", types: ["Media_Buyer", "media_buyer", "media_buying"], deptCodes: ["media_buyer"], leaderRoles: ["team_leader_media_buyer"], agentRoles: ["agent_media_buyer"] },
      { name: "Graphic Design", types: ["graphic_design"], deptCodes: ["graphic_design"], leaderRoles: ["leader_graphic_designer"], agentRoles: ["agent_graphic_designer"] },
      { name: "Motion Graphics", types: ["motion_graphic"], deptCodes: ["motion_graphic"], leaderRoles: ["leader_motion_graphic"], agentRoles: ["agent_motion_graphic"] },
      { name: "UI/UX Design", types: ["ui_design"], deptCodes: ["ui_design"], leaderRoles: ["leader_ui"], agentRoles: ["agent_ui"] },
    ];

    const assignments = project.teamAssignments || [];

    return departments.map((dept) => {
      const tasks = project.tasks?.filter((t: any) => dept.types.includes(t.taskType)) || [];

      // Get leader/agent from tasks first
      let leaderName = tasks[0]?.leader?.name || null;
      let leaderId = tasks[0]?.leader?.id || null;
      let agentName = tasks[0]?.agent?.name || null;
      let agentId = tasks[0]?.agent?.id || null;

      // Fallback: read from teamAssignments if tasks don't have leader/agent
      const deptAssignments = assignments.filter((a: any) => dept.deptCodes.includes(a.department));
      for (const a of deptAssignments) {
        if (!leaderName && dept.leaderRoles.includes(a.user?.role)) {
          leaderName = a.user.name;
          leaderId = a.user.id;
        }
        if (!agentName && dept.agentRoles.includes(a.user?.role)) {
          agentName = a.user.name;
          agentId = a.user.id;
        }
      }

      const statuses = tasks.map((t: any) => t.status);
      const overallStatus = statuses.includes("in_progress") ? "in_progress" : statuses.includes("pending") ? "pending" : statuses.includes("done") ? "done" : "N/A";

      return { 
        department: dept.name, 
        leader: leaderName, 
        agent: agentName, 
        status: overallStatus, 
        taskCount: tasks.length,
        taskId: tasks[0]?.id,
        leaderId,
        agentId,
      };
    });
  }

  const timeline = buildClientJourneyTimeline(project);
  const teamGrid = buildTeamGrid();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-indigo-600 hover:underline mb-1">← Back</button>
          <h1 className="text-2xl font-bold text-slate-800">Client Full Journey</h1>
          <p className="text-sm text-slate-500">{lead?.name} • {lead?.phone} • {project.package}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCreateWarning} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm transition">
            🚨 Create Warning
          </button>
          <span className={`px-3 py-2 rounded-lg text-sm font-bold ${project.projectStatus === "completed" ? "bg-emerald-100 text-emerald-700" : project.projectStatus === "in_progress" ? "bg-amber-100 text-amber-700" : project.projectStatus === "delayed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
            {project.projectStatus.replace(/_/g, " ").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${activeTab === tab.key ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ SECTION 1: Timeline ═══ */}
      {activeTab === "timeline" && (
        <ClientTimelineTab timeline={timeline} />
      )}

      {/* ═══ SECTION 2: Client Info ═══ */}
      {activeTab === "client" && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Client Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Full Name", value: lead?.name },
              { label: "Phone", value: lead?.phone },
              { label: "Source", value: lead?.source || "N/A" },
              { label: "Store Link", value: lead?.storeLink || project.storeUrl || "N/A" },
              { label: "Classification", value: lead?.classification, badge: true },
              { label: "Niche", value: lead?.niche || project.niche || "N/A" },
              { label: "Nationality", value: lead?.nationality || "N/A" },
              { label: "Customer Type", value: lead?.customerType || "N/A" },
              { label: "Lead Status", value: lead?.status },
            ].map((item) => (
              <div key={item.label} className="border-b border-slate-100 pb-3">
                <p className="text-xs font-medium text-slate-400 uppercase mb-1">{item.label}</p>
                {item.badge ? (
                  <span className={`px-2 py-0.5 rounded text-sm font-bold ${item.value === "Hot" ? "bg-red-100 text-red-700" : item.value === "Warm" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{item.value}</span>
                ) : (
                  <p className="text-sm font-semibold text-slate-800">{item.value || "—"}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SECTION 3: Deal Info ═══ */}
      {activeTab === "deal" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Deal Information</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: "Package", value: deal?.package, cls: "bg-purple-50 text-purple-800" },
                { label: "Total Amount", value: `${deal?.totalAmount?.toLocaleString()} SAR`, cls: "bg-emerald-50 text-emerald-800" },
                { label: "First Payment", value: `${deal?.firstAmount?.toLocaleString() || 0} SAR`, cls: "bg-blue-50 text-blue-800" },
                { label: "Remaining", value: `${((deal?.totalAmount || 0) - (deal?.firstAmount || 0)).toLocaleString()} SAR`, cls: "bg-amber-50 text-amber-800" },
              ].map((kpi) => (
                <div key={kpi.label} className={`${kpi.cls} rounded-xl p-4 text-center border`}>
                  <p className="text-xs font-medium opacity-70">{kpi.label}</p>
                  <p className="text-xl font-bold mt-1">{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {[
                { label: "Payment Method", value: deal?.paymentMethod },
                { label: "Contract Start", value: deal?.contractStart ? new Date(deal.contractStart).toLocaleDateString() : "N/A" },
                { label: "Contract End", value: deal?.contractEnd ? new Date(deal.contractEnd).toLocaleDateString() : "N/A" },
                { label: "Sales Agent", value: deal?.salesAgent?.name || "N/A" },
              ].map((item) => (
                <div key={item.label} className="border-b pb-2">
                  <p className="text-xs text-slate-400 uppercase">{item.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Installments */}
          {deal?.installments?.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="text-md font-bold text-slate-800 mb-3">Installments</h3>
              <div className="space-y-2">
                {deal.installments.map((inst: any, i: number) => (
                  <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg border ${inst.isPaid ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${inst.isPaid ? "bg-emerald-500" : "bg-orange-500"}`}>{i + 1}</span>
                      <span className="text-sm font-medium text-slate-700">{inst.amount?.toLocaleString()} SAR</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">Due: {new Date(inst.dueDate).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${inst.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{inst.isPaid ? "Paid" : "Pending"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ SECTION 4: Team Assignment ═══ */}
      {activeTab === "team" && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Team Assignment</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Leader</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Agent</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Tasks</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teamGrid.map((row) => {
                  const canAssignLeader = canManageTeamSlot(row.department, "leader");
                  const canAssignAgent = canManageTeamSlot(row.department, "agent");

                  // ── Department-specific role mapping ──
                  const deptRoleMap: Record<string, { leaders: string[]; agents: string[] }> = {
                    "SEO": {
                      leaders: ["team_leader_seo"],
                      agents: ["agent_seo", "agent_content_seo"],
                    },
                    "Social Media": {
                      leaders: ["team_leader_social_media"],
                      agents: ["agent_social_media"],
                    },
                    "Media Buyer": {
                      leaders: ["team_leader_media_buyer"],
                      agents: ["agent_media_buyer"],
                    },
                    "Graphic Design": {
                      leaders: ["leader_graphic_designer"],
                      agents: ["agent_graphic_designer"],
                    },
                    "Motion Graphics": {
                      leaders: ["leader_motion_graphic"],
                      agents: ["agent_motion_graphic"],
                    },
                    "UI/UX Design": {
                      leaders: ["leader_ui"],
                      agents: ["agent_ui"],
                    },
                  };

                  const deptRoles = deptRoleMap[row.department] || { leaders: [], agents: [] };
                  const leaders = teamMembers?.filter((u: any) => deptRoles.leaders.includes(u.role)) || [];
                  const agents = teamMembers?.filter((u: any) => deptRoles.agents.includes(u.role)) || [];

                  return (
                    <tr key={row.department} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-sm font-bold text-slate-800">{row.department}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {canAssignLeader ? (
                          <select 
                            key={`leader-${row.department}-${row.leaderId || "none"}`}
                            onChange={(e) => handleTeamAssignment(row.department, "leader", e.target.value)}
                            className="bg-slate-50 border rounded text-xs px-2 py-1 max-w-[150px]"
                            defaultValue={row.leaderId || ""}
                          >
                            <option value="" disabled>Assign Leader...</option>
                            {leaders.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        ) : (
                          row.leader || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {canAssignAgent ? (
                          <select 
                            key={`agent-${row.department}-${row.agentId || "none"}`}
                            onChange={(e) => handleTeamAssignment(row.department, "agent", e.target.value)}
                            className="bg-slate-50 border rounded text-xs px-2 py-1 max-w-[150px]"
                            defaultValue={row.agentId || ""}
                          >
                            <option value="" disabled>Assign Agent...</option>
                            {agents.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        ) : (
                          row.agent || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-center font-medium">{row.taskCount}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${row.status === "done" ? "bg-emerald-100 text-emerald-700" : row.status === "in_progress" ? "bg-amber-100 text-amber-700" : row.status === "pending" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                          {row.status === "N/A" ? "No Tasks" : row.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-slate-500">
            <span>Account Manager: <strong className="text-slate-800">{project.accountManager?.name || "N/A"}</strong></span>
            <span>•</span>
            <span>Assigned: {project.assignedAt ? new Date(project.assignedAt).toLocaleDateString() : "N/A"}</span>
          </div>
        </div>
      )}

      {/* ═══ SECTION 5: Tasks ═══ */}
      {activeTab === "tasks" && (
        <ClientTasksTab
          project={project}
          teamMembers={teamMembers}
          userId={userId}
          isAdmin={isAdmin}
          newTaskType={newTaskType}
          setNewTaskType={setNewTaskType}
          newTaskBrief={newTaskBrief}
          setNewTaskBrief={setNewTaskBrief}
          newTaskPriority={newTaskPriority}
          setNewTaskPriority={setNewTaskPriority}
          newTaskDeadline={newTaskDeadline}
          setNewTaskDeadline={setNewTaskDeadline}
          newTaskLink={newTaskLink}
          setNewTaskLink={setNewTaskLink}
          creatingTask={creatingTask}
          handleCreateTask={handleCreateTask}
          taskFilterTeam={taskFilterTeam}
          setTaskFilterTeam={setTaskFilterTeam}
          taskFilterStatus={taskFilterStatus}
          setTaskFilterStatus={setTaskFilterStatus}
          taskFilterCreator={taskFilterCreator}
          setTaskFilterCreator={setTaskFilterCreator}
          handleAssignUser={handleAssignUser}
          handleUpdateStatus={handleUpdateStatus}
          handleUpdateProgress={handleUpdateProgress}
        />
      )}

      {/* ═══ SECTION 6: Progress ═══ */}
      {activeTab === "progress" && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Progress Tracking</h2>
          <div className="space-y-6">
            {[
              { label: "SEO Progress", value: project.seoProgress, color: "bg-blue-500" },
              { label: "Social Media Progress", value: project.socialMediaProgress, color: "bg-purple-500" },
              { label: "Media Buyer Progress", value: project.mediaBuyerProgress, color: "bg-amber-500" },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">{bar.label}</span>
                  <span className="text-sm font-bold text-slate-800">{bar.value}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div className={`${bar.color} h-4 rounded-full transition-all duration-500 flex items-center justify-center`} style={{ width: `${bar.value}%` }}>
                    {bar.value > 15 && <span className="text-xs text-white font-bold">{bar.value}%</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
            <div className="text-center"><p className="text-xs text-slate-400">Deadline</p><p className="text-sm font-bold text-slate-700">{project.finalDeadline ? new Date(project.finalDeadline).toLocaleDateString() : "Not Set"}</p></div>
            <div className="text-center"><p className="text-xs text-slate-400">Total Tasks</p><p className="text-sm font-bold text-slate-700">{project.tasks?.length || 0}</p></div>
            <div className="text-center"><p className="text-xs text-slate-400">Completed</p><p className="text-sm font-bold text-emerald-700">{project.tasks?.filter((t: any) => t.status === "done").length || 0}</p></div>
          </div>
        </div>
      )}

      {/* ═══ SECTION 7: Notes ═══ */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          {project.warnings?.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Active Warnings ({project.warnings.length})</h2>
              <div className="space-y-3">
                {project.warnings.map((warning: any) => (
                  <div key={warning.id} className="border border-orange-200 bg-orange-50 text-orange-800 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase">{warning.severity}</span>
                        <span className="text-xs opacity-60">•</span>
                        <span className="text-sm font-bold">{warning.subject}</span>
                      </div>
                      <span className="text-xs opacity-60">{new Date(warning.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{warning.message}</p>
                    <p className="text-xs opacity-70 mt-2">From: {warning.sender?.name || warning.senderRole}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Note */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Add Note</h2>
            <div className="flex gap-3">
              <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[120px]">
                <option value="general">General</option>
                <option value="telesales">TeleSales</option>
                <option value="sales">Sales</option>
                <option value="account_manager">Account Mgr</option>
                <option value="technical">Technical</option>
                <option value="design">Design</option>
              </select>
              <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write a note visible to all departments..." className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none h-20" />
              <button onClick={handleAddNote} disabled={!noteContent.trim() || saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium self-end hover:bg-indigo-700 disabled:opacity-50 transition">
                {saving ? "..." : "Add"}
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">All Notes ({project.globalNotes?.length || 0})</h2>
            {project.globalNotes?.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {project.globalNotes.map((note: any) => {
                  const catColors: Record<string, string> = {
                    telesales: "bg-blue-50 border-blue-200 text-blue-700",
                    sales: "bg-purple-50 border-purple-200 text-purple-700",
                    account_manager: "bg-amber-50 border-amber-200 text-amber-700",
                    technical: "bg-indigo-50 border-indigo-200 text-indigo-700",
                    design: "bg-pink-50 border-pink-200 text-pink-700",
                    general: "bg-slate-50 border-slate-200 text-slate-700",
                  };
                  const colors = catColors[note.category] || catColors.general;
                  return (
                    <div key={note.id} className={`${colors} border rounded-lg p-4`}>
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase">{note.category.replace(/_/g, " ")}</span>
                          <span className="text-xs opacity-50">•</span>
                          <span className="text-xs font-medium">{note.userName}</span>
                          <span className="text-xs opacity-50 capitalize">({note.userRole.replace(/_/g, " ")})</span>
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
      )}

      {/* ═══ SECTION 8: Files ═══ */}
      {activeTab === "files" && (
        <div className="space-y-4">
          {/* ── Task-Linked Files (Auto-synced from Tasks) ── */}
          {(() => {
            const taskLinks = (project.tasks || []).filter((t: any) => t.taskLink);
            if (taskLinks.length > 0) return (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-slate-800">📎 Task Links</h2>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">{taskLinks.length}</span>
                  <span className="text-xs text-slate-400 ml-auto">Auto-synced from Tasks</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Link</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sent By</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sent Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deadline</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {taskLinks.map((t: any) => {
                        // Detect link type for icon
                        const url = (t.taskLink || "").toLowerCase();
                        let icon = "🔗";
                        let label = "Link";
                        if (url.includes("drive.google")) { icon = "📁"; label = "Google Drive"; }
                        else if (url.includes("docs.google.com/spreadsheets") || url.includes("sheets.google")) { icon = "📊"; label = "Google Sheet"; }
                        else if (url.includes("docs.google.com/document")) { icon = "📝"; label = "Google Doc"; }
                        else if (url.includes("docs.google.com/presentation")) { icon = "📽️"; label = "Google Slides"; }
                        else if (url.includes("figma.com")) { icon = "🎨"; label = "Figma"; }
                        else if (url.includes("canva.com")) { icon = "🖼️"; label = "Canva"; }
                        else if (url.includes("notion.")) { icon = "📓"; label = "Notion"; }
                        else if (url.includes("trello.")) { icon = "📋"; label = "Trello"; }

                        const isOverdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== "done";

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 capitalize">
                                {icon} {t.taskType.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <a href={t.taskLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition max-w-[200px] truncate">
                                {label} ↗
                              </a>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-700">{t.leader?.name || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-slate-500 capitalize">{(t.requesterRole || t.leader?.role || "—").replace(/_/g, " ")}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">{new Date(t.createdAt).toLocaleDateString("en-GB")}</td>
                            <td className="px-4 py-3">
                              {t.deadline ? (
                                <span className={`text-xs font-semibold ${isOverdue ? "text-red-600" : "text-slate-600"}`}>
                                  {new Date(t.deadline).toLocaleDateString("en-GB")}
                                  {isOverdue && " ⚠️"}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${t.status === "done" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : t.status === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                                {t.status.replace(/_/g, " ")}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
            return null;
          })()}

          {/* ── Uploaded Project Files ── */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Project Files</h2>
            {canUploadProjectFiles && (
              <form onSubmit={handleUploadProjectFile} className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 mb-5 p-4 bg-slate-50 border rounded-xl">
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="contract">Contract</option>
                  <option value="screenshot">Screenshot</option>
                  <option value="report">Report</option>
                  <option value="brief">Brief</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="submit"
                  disabled={uploadingFile || !fileUrl.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploadingFile ? "Adding..." : "Add File"}
                </button>
              </form>
            )}
            {project.files?.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4">No files uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {project.files.map((f: any) => (
                  <a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border rounded-lg p-4 hover:bg-slate-50 hover:shadow-sm transition">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg ${f.fileType === "contract" ? "bg-red-500" : f.fileType === "screenshot" ? "bg-blue-500" : "bg-slate-500"}`}>
                      {f.fileType === "contract" ? "📄" : f.fileType === "screenshot" ? "📸" : "📎"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 capitalize">{f.fileType}</p>
                      <p className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString()}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {/* Drive/Store Links */}
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
              {project.driveLink && (
                <a href={project.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">📁 Google Drive Folder</a>
              )}
              {project.storeUrl && (
                <a href={project.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">🛒 Store Link</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECTION 9: System Logs ═══ */}
      {activeTab === "logs" && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Project Operational Logs</h2>
          <ProjectLogsPanel logs={project.logs || []} />
        </div>
      )}
    </div>
  );
}
