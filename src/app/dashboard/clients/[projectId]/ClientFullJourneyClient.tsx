"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectLogsPanel from "@/components/ProjectLogsPanel";

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

  const [newTaskType, setNewTaskType] = useState("seo");
  const [newTaskBrief, setNewTaskBrief] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

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
      })
    });
    setNewTaskBrief("");
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

  // ── Assignment Handler ──
  async function handleAssignUser(taskId: string, field: "leaderId" | "agentId", newValue: string) {
    if (!taskId || !newValue) return;
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: newValue }),
    });
    router.refresh();
  }

  // ── Team Assignment Handler (Bulk update & TeamAssignment records) ──
  async function handleTeamAssignment(department: string, roleType: "leader" | "agent", newUserId: string) {
    if (!department || !newUserId) return;
    await fetch(`/api/projects/${project.id}/team-assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department, assignedRoleType: roleType, newUserId }),
    });
    router.refresh();
  }

  const safeUserRole = userRole || "";
  const isAdmin = ["super_admin", "head_account_manager", "head_technical", "head_seo"].includes(safeUserRole);

  // ── Build Timeline Entries ──
  function buildTimeline() {
    const entries: any[] = [];

    // Lead created
    if (lead) {
      entries.push({
        stage: "lead", color: "bg-slate-500", label: "Lead Created",
        date: lead.createdAt, agent: lead.createdBy?.name || "System",
        role: "TeleSales", detail: `Source: ${lead.source || "N/A"} | Classification: ${lead.classification}`,
      });
    }

    // Call logs
    lead?.callLogs?.forEach((c: any) => {
      entries.push({
        stage: "telesales", color: "bg-blue-500", label: "Call Log",
        date: c.createdAt, agent: c.agent?.name || "Agent",
        role: "TeleSales", detail: `Status: ${c.callStatus} | ${c.notes}`,
      });
    });

    // Meetings
    lead?.meetings?.forEach((m: any) => {
      entries.push({
        stage: "sales", color: "bg-purple-500", label: `Meeting (${m.status})`,
        date: m.meetingDate, agent: m.salesAgent?.name || m.teleAgent?.name || "Agent",
        role: "Sales", detail: m.salesNotes || m.summary || "No notes",
      });
    });

    // Deal closing
    if (deal) {
      entries.push({
        stage: "deal", color: "bg-emerald-500", label: "Deal Closed",
        date: deal.createdAt, agent: deal.salesAgent?.name || "Sales",
        role: "Sales", detail: `Package: ${deal.package} | Total: ${deal.totalAmount?.toLocaleString()} EGP | Method: ${deal.paymentMethod}`,
      });
    }

    // First payment
    if (deal?.firstAmount) {
      entries.push({
        stage: "payment", color: "bg-green-600", label: "First Payment",
        date: deal.createdAt, agent: "System", role: "Finance",
        detail: `Amount: ${deal.firstAmount.toLocaleString()} EGP`,
      });
    }

    // Installments
    deal?.installments?.forEach((inst: any, i: number) => {
      entries.push({
        stage: "payment", color: inst.isPaid ? "bg-green-500" : "bg-orange-500",
        label: `Installment ${i + 1} ${inst.isPaid ? "(Paid)" : "(Pending)"}`,
        date: inst.dueDate, agent: "System", role: "Finance",
        detail: `Amount: ${inst.amount?.toLocaleString()} EGP | Due: ${new Date(inst.dueDate).toLocaleDateString()}`,
      });
    });

    // Project created
    entries.push({
      stage: "accounts", color: "bg-amber-500", label: "Project Created",
      date: project.createdAt, agent: project.accountManager?.name || "AM",
      role: "Account Manager", detail: `Package: ${project.package} | Niche: ${project.niche || "N/A"} | Status: ${project.projectStatus}`,
    });

    // Account Manager notes
    if (project.notes) {
      entries.push({
        stage: "accounts", color: "bg-amber-400", label: "AM Notes",
        date: project.createdAt, agent: project.accountManager?.name || "AM",
        role: "Account Manager", detail: project.notes,
      });
    }

    // Tasks
    project.tasks?.forEach((t: any) => {
      entries.push({
        stage: "technical", color: "bg-indigo-500", label: `Task: ${t.taskType.replace(/_/g, " ")}`,
        date: t.createdAt, agent: t.leader?.name || "Leader",
        role: t.taskType, detail: `Status: ${t.status} | Agent: ${t.agent?.name || "Unassigned"} | Progress: ${t.progressPct}%`,
      });
      if (t.completedAt) {
        entries.push({
          stage: "delivery", color: "bg-teal-500", label: `Completed: ${t.taskType.replace(/_/g, " ")}`,
          date: t.completedAt, agent: t.agent?.name || t.leader?.name || "Team",
          role: t.taskType, detail: `Duration: ${Math.ceil((new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000)} days`,
        });
      }
    });

    // Global notes
    project.globalNotes?.forEach((n: any) => {
      entries.push({
        stage: "note", color: "bg-yellow-500", label: `Note (${n.category})`,
        date: n.createdAt, agent: n.userName,
        role: n.userRole.replace(/_/g, " "), detail: n.content,
      });
    });

    entries.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries;
  }

  // ── Build Team Assignment Grid ──
  function buildTeamGrid() {
    const departments = [
      { name: "SEO", types: ["seo", "content_seo"] },
      { name: "Social Media", types: ["social_media"] },
      { name: "Media Buyer", types: ["media_buyer"] },
      { name: "Graphic Design", types: ["graphic_design"] },
      { name: "Motion Graphics", types: ["motion_graphic"] },
      { name: "UI/UX Design", types: ["ui_design"] },
    ];
    return departments.map((dept) => {
      const tasks = project.tasks?.filter((t: any) => dept.types.includes(t.taskType)) || [];
      const leader = tasks[0]?.leader;
      const agent = tasks[0]?.agent;
      const statuses = tasks.map((t: any) => t.status);
      const overallStatus = statuses.includes("in_progress") ? "in_progress" : statuses.includes("pending") ? "pending" : statuses.includes("done") ? "done" : "N/A";
      return { 
        department: dept.name, 
        leader: leader?.name, 
        agent: agent?.name, 
        status: overallStatus, 
        taskCount: tasks.length,
        taskId: tasks[0]?.id,
        leaderId: leader?.id,
      };
    });
  }

  const timeline = buildTimeline();
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
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Client Journey Timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No journey data yet.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-3">
                {timeline.map((entry: any, i: number) => (
                  <div key={i} className="relative pl-10">
                    <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ${entry.color} ring-2 ring-white shadow`} />
                    <div className="bg-slate-50 border rounded-lg p-3 hover:shadow-sm transition">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 uppercase">{entry.label}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs font-medium text-slate-600">{entry.agent}</span>
                          <span className="text-xs text-slate-400 capitalize">({entry.role})</span>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{entry.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
                { label: "Total Amount", value: `${deal?.totalAmount?.toLocaleString()} EGP`, cls: "bg-emerald-50 text-emerald-800" },
                { label: "First Payment", value: `${deal?.firstAmount?.toLocaleString() || 0} EGP`, cls: "bg-blue-50 text-blue-800" },
                { label: "Remaining", value: `${((deal?.totalAmount || 0) - (deal?.firstAmount || 0)).toLocaleString()} EGP`, cls: "bg-amber-50 text-amber-800" },
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
                      <span className="text-sm font-medium text-slate-700">{inst.amount?.toLocaleString()} EGP</span>
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
                  const isLeader = row.leaderId === userId;
                  const canAssignLeader = isAdmin;
                  const canAssignAgent = isAdmin || isLeader;

                  // ── Department-specific role mapping ──
                  const deptRoleMap: Record<string, { leaders: string[]; agents: string[] }> = {
                    "SEO": {
                      leaders: ["team_leader_seo", "head_seo"],
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
                            onChange={(e) => handleTeamAssignment(row.department, "leader", e.target.value)}
                            className="bg-slate-50 border rounded text-xs px-2 py-1 max-w-[150px]"
                            defaultValue=""
                          >
                            <option value="" disabled>{row.leader || "Assign Leader..."}</option>
                            {leaders.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        ) : (
                          row.leader || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {canAssignAgent ? (
                          <select 
                            onChange={(e) => handleTeamAssignment(row.department, "agent", e.target.value)}
                            className="bg-slate-50 border rounded text-xs px-2 py-1 max-w-[150px]"
                            defaultValue=""
                          >
                            <option value="" disabled>{row.agent || "Assign Agent..."}</option>
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-3">Assign New Task</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="seo">SEO</option>
                <option value="content_seo">Content SEO</option>
                <option value="social_media">Social Media</option>
                <option value="media_buyer">Media Buyer</option>
                <option value="graphic_design">Graphic Design</option>
                <option value="motion_graphic">Motion Graphic</option>
                <option value="ui_design">UI/UX Design</option>
                <option value="technical">Technical (Web)</option>
              </select>
              <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
              </select>
              <input type="date" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white" />
            </div>
            <div className="flex gap-3">
              <textarea value={newTaskBrief} onChange={(e) => setNewTaskBrief(e.target.value)} placeholder="Task details and instructions..." className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none h-20" />
              <button onClick={handleCreateTask} disabled={!newTaskBrief.trim() || creatingTask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium self-end hover:bg-indigo-700 disabled:opacity-50 transition">
                {creatingTask ? "Sending..." : "Create Task"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Tasks & Tracking</h2>
            {project.tasks?.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-4">No tasks created yet.</p>
          ) : (
            <div className="space-y-3">
              {project.tasks.map((t: any) => {
                const isTaskLeader = t.leaderId === userId;
                const taskCanAssignLeader = isAdmin;
                const taskCanAssignAgent = isAdmin || isTaskLeader;

                // ── Task-type to department role mapping ──
                const taskTypeRoleMap: Record<string, { leaders: string[]; agents: string[] }> = {
                  "SEO": { leaders: ["team_leader_seo", "head_seo"], agents: ["agent_seo", "agent_content_seo"] },
                  "seo": { leaders: ["team_leader_seo", "head_seo"], agents: ["agent_seo", "agent_content_seo"] },
                  "content_seo": { leaders: ["team_leader_seo", "head_seo"], agents: ["agent_seo", "agent_content_seo"] },
                  "Social_Media": { leaders: ["team_leader_social_media"], agents: ["agent_social_media"] },
                  "social_media": { leaders: ["team_leader_social_media"], agents: ["agent_social_media"] },
                  "Media_Buyer": { leaders: ["team_leader_media_buyer"], agents: ["agent_media_buyer"] },
                  "media_buyer": { leaders: ["team_leader_media_buyer"], agents: ["agent_media_buyer"] },
                  "media_buying": { leaders: ["team_leader_media_buyer"], agents: ["agent_media_buyer"] },
                  "graphic_design": { leaders: ["leader_graphic_designer"], agents: ["agent_graphic_designer"] },
                  "motion_graphic": { leaders: ["leader_motion_graphic"], agents: ["agent_motion_graphic"] },
                  "ui_design": { leaders: ["leader_ui"], agents: ["agent_ui"] },
                  "technical": { leaders: ["head_technical"], agents: ["agent_technical"] },
                };
                const ttRoles = taskTypeRoleMap[t.taskType] || { leaders: [], agents: [] };
                const taskLeaders = teamMembers?.filter((u: any) => ttRoles.leaders.includes(u.role)) || [];
                const taskAgents = teamMembers?.filter((u: any) => ttRoles.agents.includes(u.role)) || [];

                return (
                 <div key={t.id} className="border rounded-lg p-4 hover:shadow-sm transition">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 capitalize">{t.taskType.replace(/_/g, " ")}</span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${t.status === "done" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : t.status === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{t.status}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${t.priority === "High" ? "bg-red-100 text-red-700" : t.priority === "Low" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-600"}`}>{t.priority}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Created: {new Date(t.createdAt).toLocaleDateString()} {t.completedAt && `• Completed: ${new Date(t.completedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex gap-6 mt-2 text-xs text-slate-500 flex-wrap items-center">
                    <span className="flex items-center gap-2">
                      Assigned By: 
                      {taskCanAssignLeader ? (
                        <select 
                          onChange={(e) => handleAssignUser(t.id, "leaderId", e.target.value)}
                          className="bg-slate-50 border rounded px-1 py-0.5 max-w-[120px]"
                          defaultValue=""
                        >
                          <option value="" disabled>{t.leader?.name || "Unassigned"}</option>
                          {taskLeaders.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      ) : (
                        <strong>{t.leader?.name || "—"}</strong>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      Assigned To: 
                      {taskCanAssignAgent ? (
                        <select 
                          onChange={(e) => handleAssignUser(t.id, "agentId", e.target.value)}
                          className="bg-slate-50 border rounded px-1 py-0.5 max-w-[120px]"
                          defaultValue=""
                        >
                          <option value="" disabled>{t.agent?.name || "Unassigned"}</option>
                          {taskAgents.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      ) : (
                        <strong>{t.agent?.name || "Unassigned"}</strong>
                      )}
                    </span>
                    {t.brief && <span>Brief: {t.brief}</span>}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${t.progressPct}%` }} />
                  </div>
                  {t.subTasks?.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-indigo-200 space-y-1">
                      {t.subTasks.map((st: any) => (
                        <div key={st.id} className="flex items-center justify-between text-xs text-slate-500 py-1">
                          <span>↳ {st.taskType.replace(/_/g, " ")}: <strong>{st.status}</strong> ({st.progressPct}%)</span>
                          <span>{st.agent?.name || "Unassigned"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                 </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
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
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Project Files</h2>
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
