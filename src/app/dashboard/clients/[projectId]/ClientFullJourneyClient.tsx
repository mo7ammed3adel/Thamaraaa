"use client";

import { useState } from "react";
import { buildClientJourneyTeamGrid } from "@/lib/clientJourneyTeamGrid";
import { buildClientJourneyTimeline } from "@/lib/clientJourneyTimeline";
import ClientDealTab from "./ClientDealTab";
import ClientFilesTab from "./ClientFilesTab";
import ClientInfoTab from "./ClientInfoTab";
import ClientLogsTab from "./ClientLogsTab";
import ClientNotesTab from "./ClientNotesTab";
import ClientProgressTab from "./ClientProgressTab";
import ClientTasksTab from "./ClientTasksTab";
import ClientTeamTab from "./ClientTeamTab";
import ClientTimelineTab from "./ClientTimelineTab";
import { useClientJourneyActions } from "./useClientJourneyActions";
import { useTranslator } from "@/components/i18n/LocaleProvider";

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
  const t = useTranslator();
  const [activeTab, setActiveTab] = useState(initialTab);
  const deal = project.deal;
  const lead = deal?.lead;
  const {
    noteContent,
    setNoteContent,
    noteCategory,
    setNoteCategory,
    saving,
    fileUrl,
    setFileUrl,
    fileType,
    setFileType,
    uploadingFile,
    newTaskType,
    setNewTaskType,
    newTaskBrief,
    setNewTaskBrief,
    newTaskPriority,
    setNewTaskPriority,
    newTaskDeadline,
    setNewTaskDeadline,
    newTaskLink,
    setNewTaskLink,
    creatingTask,
    taskFilterTeam,
    setTaskFilterTeam,
    taskFilterStatus,
    setTaskFilterStatus,
    taskFilterCreator,
    setTaskFilterCreator,
    handleCreateTask,
    handleAddNote,
    handleUploadProjectFile,
    handleCreateWarning,
    handleAssignUser,
    handleUpdateStatus,
    handleUpdateProgress,
    handleTeamAssignment,
    goBack,
  } = useClientJourneyActions({ project, lead });

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

  const timeline = buildClientJourneyTimeline(project);
  const teamGrid = buildClientJourneyTeamGrid(project);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={goBack} className="text-sm text-indigo-600 hover:underline mb-1">← Back</button>
          <h1 className="text-2xl font-bold text-slate-800">{t("journey.fullTitle")}</h1>
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
      {activeTab === "client" && <ClientInfoTab lead={lead} project={project} />}


      {/* ═══ SECTION 3: Deal Info ═══ */}
      {activeTab === "deal" && <ClientDealTab deal={deal} />}

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
      {activeTab === "progress" && <ClientProgressTab project={project} />}


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
      {activeTab === "logs" && <ClientLogsTab logs={project.logs || []} />}
    </div>
  );
}
