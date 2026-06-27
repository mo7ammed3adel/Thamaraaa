"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ProjectLogsPanel from "@/components/ProjectLogsPanel";
import { buildClientJourneyTimeline } from "@/lib/clientJourneyTimeline";
import ClientFilesTab from "./ClientFilesTab";
import ClientNotesTab from "./ClientNotesTab";
import ClientTasksTab from "./ClientTasksTab";
import ClientTeamTab from "./ClientTeamTab";
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
        <ClientTeamTab
          teamGrid={teamGrid}
          project={project}
          teamMembers={teamMembers}
          canManageTeamSlot={canManageTeamSlot}
          handleTeamAssignment={handleTeamAssignment}
        />
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
        <ClientNotesTab
          warnings={project.warnings || []}
          notes={project.globalNotes || []}
          noteCategory={noteCategory}
          setNoteCategory={setNoteCategory}
          noteContent={noteContent}
          setNoteContent={setNoteContent}
          saving={saving}
          handleAddNote={handleAddNote}
        />
      )}

      {/* ═══ SECTION 8: Files ═══ */}
      {activeTab === "files" && (
        <ClientFilesTab
          project={project}
          canUploadProjectFiles={canUploadProjectFiles}
          fileType={fileType}
          setFileType={setFileType}
          fileUrl={fileUrl}
          setFileUrl={setFileUrl}
          uploadingFile={uploadingFile}
          handleUploadProjectFile={handleUploadProjectFile}
        />
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
