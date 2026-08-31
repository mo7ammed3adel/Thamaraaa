"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ClientDetailModal from "@/components/ClientDetailModal";
import CreateWarningModal from "@/components/CreateWarningModal";
import LifecycleChangeModal from "@/components/LifecycleChangeModal";
import DistributeModal from "@/components/DistributeModal";
import ClientAccountModal from "@/components/ClientAccountModal";
import { setupProject } from "@/client/api/projects";
import { generateTasks } from "@/client/api/tasks";
import AccountManagerClientsTable from "./AccountManagerClientsTable";
import AccountManagerKpiGrid from "./AccountManagerKpiGrid";
import AccountManagerSetupModal from "./AccountManagerSetupModal";
import AccountManagerTaskMonitoringPanel from "./AccountManagerTaskMonitoringPanel";
import { useAccountManagerDerivedData } from "./useAccountManagerDerivedData";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function AccountManagerClient({ userId, projects, kpis, headTechnicalUsers, headSeoUsers, teamLeaders }: any) {
  const t = useTranslator();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Task Panel States
  const [taskFilterClient, setTaskFilterClient] = useState("");
  const [taskFilterStatus, setTaskFilterStatus] = useState("");
  const [taskFilterTeam, setTaskFilterTeam] = useState("");
  const [activeKpi, setActiveKpi] = useState("all");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [lifecycleFromDate, setLifecycleFromDate] = useState("");
  const [lifecycleToDate, setLifecycleToDate] = useState("");

  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningTarget, setWarningTarget] = useState<{ projectId: string, clientId?: string } | null>(null);
  
  // Expanded row state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Distribute & Lifecycle Modals
  const [technicalModalProject, setTechnicalModalProject] = useState<any>(null);
  const [distributeModalProject, setDistributeModalProject] = useState<any>(null);
  const [lifecycleModalProject, setLifecycleModalProject] = useState<any>(null);
  const [setupModalProject, setSetupModalProject] = useState<any>(null);
  const [clientAccountProject, setClientAccountProject] = useState<any>(null);

  const { filteredProjects, filteredTasks } = useAccountManagerDerivedData({
    projects,
    searchQuery,
    activeKpi,
    filterLifecycle,
    lifecycleFromDate,
    lifecycleToDate,
    taskFilterClient,
    taskFilterStatus,
    taskFilterTeam,
  });

  async function handleSaveSetup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!setupModalProject) return;

    setLoadingAction("setup");
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);

    try {
      await setupProject(setupModalProject.id, {
        niche: formData.get("niche"),
        storeUrl: formData.get("storeUrl"),
        driveLink: formData.get("driveLink"),
        technicalDeadline: formData.get("technicalDeadline")
          ? new Date(formData.get("technicalDeadline") as string).toISOString()
          : null,
        finalDeadline: formData.get("finalDeadline")
          ? new Date(formData.get("finalDeadline") as string).toISOString()
          : null,
        notes: formData.get("notes"),
        projectStatus: "setup",
      });

      setSetupModalProject(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save project setup.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePushToTeams(projectId: string, packageType: string) {
    setLoadingAction(`push-${projectId}`);
    setErrorMsg(null);

    const seoLeader = teamLeaders?.find((l: any) => l.role === "team_leader_seo") || teamLeaders?.find((l: any) => l.role === "head_seo");
    const socialLeader = teamLeaders?.find((l: any) => l.role === "team_leader_social_media");
    const mediaLeader = teamLeaders?.find((l: any) => l.role === "team_leader_media_buyer");

    try {
      await generateTasks({
        projectId,
        packageType,
        seoLeaderId: seoLeader?.id,
        socialLeaderId: socialLeader?.id,
        mediaLeaderId: mediaLeader?.id,
      });

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to push tasks to teams.");
    } finally {
      setLoadingAction(null);
    }
  }

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("am.dashboardTitle")}</h1>
        <p className="text-sm text-slate-500">{t("am.dashboardSubtitle")}</p>
      </div>

      {errorMsg && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 font-bold hover:text-red-800">{t("common.close")}</button>
        </div>
      )}

      {/* ── KPI Grid ── */}
      <AccountManagerKpiGrid kpis={kpis} activeKpi={activeKpi} setActiveKpi={setActiveKpi} />

      {/* ── My Clients List ── */}
      <AccountManagerClientsTable
        filteredProjects={filteredProjects}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterLifecycle={filterLifecycle}
        setFilterLifecycle={setFilterLifecycle}
        lifecycleFromDate={lifecycleFromDate}
        setLifecycleFromDate={setLifecycleFromDate}
        lifecycleToDate={lifecycleToDate}
        setLifecycleToDate={setLifecycleToDate}
        expandedRow={expandedRow}
        setExpandedRow={setExpandedRow}
        loadingAction={loadingAction}
        handlePushToTeams={handlePushToTeams}
        setSetupModalProject={setSetupModalProject}
        setSelectedClient={setSelectedClient}
        setWarningTarget={setWarningTarget}
        setWarningModalOpen={setWarningModalOpen}
        setTechnicalModalProject={setTechnicalModalProject}
        setDistributeModalProject={setDistributeModalProject}
        setClientAccountProject={setClientAccountProject}
        setLifecycleModalProject={setLifecycleModalProject}
      />

      <AccountManagerTaskMonitoringPanel
        projects={projects}
        filteredTasks={filteredTasks}
        taskFilterClient={taskFilterClient}
        setTaskFilterClient={setTaskFilterClient}
        taskFilterStatus={taskFilterStatus}
        setTaskFilterStatus={setTaskFilterStatus}
        taskFilterTeam={taskFilterTeam}
        setTaskFilterTeam={setTaskFilterTeam}
        openClientJourney={(projectId) => router.push(`/dashboard/clients/${projectId}`)}
      />

      <AccountManagerSetupModal
        setupModalProject={setupModalProject}
        loadingAction={loadingAction}
        onClose={() => setSetupModalProject(null)}
        handleSaveSetup={handleSaveSetup}
      />

      {selectedClient && (
        <ClientDetailModal
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          project={selectedClient}
          currentUserRole="account_manager"
        />
      )}

      {warningTarget && (
        <CreateWarningModal
          isOpen={warningModalOpen}
          onClose={() => { setWarningModalOpen(false); setWarningTarget(null); }}
          projectId={warningTarget.projectId}
          clientId={warningTarget.clientId}
        />
      )}

      {clientAccountProject && (
        <ClientAccountModal
          isOpen={!!clientAccountProject}
          onClose={() => setClientAccountProject(null)}
          leadId={clientAccountProject.deal?.leadId}
          clientName={clientAccountProject.deal?.lead?.name || "Client"}
        />
      )}

      {distributeModalProject && (
        <DistributeModal
          isOpen={!!distributeModalProject}
          onClose={() => setDistributeModalProject(null)}
          projectId={distributeModalProject.id}
          projectName={distributeModalProject.deal?.lead?.name || "Client"}
          availableUsers={headSeoUsers || []}
          actionLabel="Assign Head SEO"
          onDistributed={() => {
            setDistributeModalProject(null);
            router.refresh();
          }}
        />
      )}

      {technicalModalProject && (
        <DistributeModal
          isOpen={!!technicalModalProject}
          onClose={() => setTechnicalModalProject(null)}
          projectId={technicalModalProject.id}
          projectName={technicalModalProject.deal?.lead?.name || "Client"}
          availableUsers={headTechnicalUsers || []}
          actionLabel="Assign Head Technical"
          onDistributed={() => {
            setTechnicalModalProject(null);
            router.refresh();
          }}
        />
      )}

      {lifecycleModalProject && (
        <LifecycleChangeModal
          isOpen={!!lifecycleModalProject}
          onClose={() => setLifecycleModalProject(null)}
          projectId={lifecycleModalProject.id}
          projectName={lifecycleModalProject.deal?.lead?.name || "Client"}
          currentState={lifecycleModalProject.lifecycleState || "Active"}
          onChanged={() => { setLifecycleModalProject(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
