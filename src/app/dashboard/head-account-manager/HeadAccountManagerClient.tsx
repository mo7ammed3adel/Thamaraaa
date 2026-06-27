"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientDetailModal from "@/components/ClientDetailModal";
import LifecycleChangeModal from "@/components/LifecycleChangeModal";
import DistributeModal from "@/components/DistributeModal";
import ClientReassignModal from "@/components/ClientReassignModal";
import CreateWarningModal from "@/components/CreateWarningModal";
import { distributeProject as distributeProjectRequest, updateProjectStatus } from "@/client/api/projects";
import HeadAccountManagerKpiGrid from "./HeadAccountManagerKpiGrid";
import HeadAccountManagerMasterList from "./HeadAccountManagerMasterList";
import HeadAccountManagerTasksPanel from "./HeadAccountManagerTasksPanel";
import HeadAccountManagerWorkload from "./HeadAccountManagerWorkload";
import { useHeadAccountManagerDerivedData } from "./useHeadAccountManagerDerivedData";

export default function HeadAccountManagerClient({ projects, accountManagers, headTechnicals, headSeoUsers, kpis, userId }: any) {
  const router = useRouter();
  const [filterAM, setFilterAM] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWarning, setFilterWarning] = useState("all");
  const [filterDelay, setFilterDelay] = useState("all");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [activeKpi, setActiveKpi] = useState("all");
  
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [lifecycleProject, setLifecycleProject] = useState<any>(null);
  const [distributeProject, setDistributeProject] = useState<any>(null);
  const [distributeSeoProject, setDistributeSeoProject] = useState<any>(null);
  const [reassignProject, setReassignProject] = useState<any>(null);
  const [warningProject, setWarningProject] = useState<any>(null);
  const [taskFilter, setTaskFilter] = useState("all");

  const { allTasks, filteredProjects } = useHeadAccountManagerDerivedData({
    projects,
    filterAM,
    searchQuery,
    filterStatus,
    filterWarning,
    filterDelay,
    activeKpi,
    filterLifecycle,
  });

  const handleAssignAM = async (projectId: string, amId: string) => {
    if (amId) {
      await distributeProjectRequest({ projectId, targetUserId: amId });
    } else {
      await updateProjectStatus(projectId, {
        accountManagerId: null,
        details: "Account Manager unassigned by Head Account Manager",
      });
    }
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* ── KPI Grid ── */}
      <HeadAccountManagerKpiGrid kpis={kpis} activeKpi={activeKpi} setActiveKpi={setActiveKpi} />

      {/* ── Account Managers Workload ── */}
      <HeadAccountManagerWorkload
        accountManagers={accountManagers}
        kpis={kpis}
        filterAM={filterAM}
        setFilterAM={setFilterAM}
      />

      {/* ── Global Projects ── */}
      <HeadAccountManagerMasterList
        filteredProjects={filteredProjects}
        accountManagers={accountManagers}
        filterAM={filterAM}
        setFilterAM={setFilterAM}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterWarning={filterWarning}
        setFilterWarning={setFilterWarning}
        filterDelay={filterDelay}
        setFilterDelay={setFilterDelay}
        filterLifecycle={filterLifecycle}
        setFilterLifecycle={setFilterLifecycle}
        handleAssignAM={handleAssignAM}
        setLifecycleProject={setLifecycleProject}
        setSelectedClient={setSelectedClient}
        setDistributeProject={setDistributeProject}
        setDistributeSeoProject={setDistributeSeoProject}
        setWarningProject={setWarningProject}
        setReassignProject={setReassignProject}
        openClientJourney={(projectId) => router.push(`/dashboard/clients/${projectId}`)}
      />

      {/* ── Global Tasks Execution ── */}
      <HeadAccountManagerTasksPanel
        allTasks={allTasks}
        projects={projects}
        taskFilter={taskFilter}
        setTaskFilter={setTaskFilter}
      />
      {selectedClient && (
        <ClientDetailModal 
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          project={selectedClient}
          currentUserRole="head_account_manager"
        />
      )}

      {lifecycleProject && (
        <LifecycleChangeModal
          isOpen={!!lifecycleProject}
          onClose={() => setLifecycleProject(null)}
          projectId={lifecycleProject.id}
          currentState={lifecycleProject.lifecycleState || "Onboarding"}
          projectName={lifecycleProject.deal?.lead?.name || "Unknown Client"}
          onChanged={() => { setLifecycleProject(null); router.refresh(); }}
        />
      )}

      {distributeProject && (
        <DistributeModal
          isOpen={!!distributeProject}
          onClose={() => setDistributeProject(null)}
          projectId={distributeProject.id}
          projectName={distributeProject.deal?.lead?.name || "Unknown Client"}
          availableUsers={headTechnicals}
          actionLabel="Assign Head Technical"
          onDistributed={() => { setDistributeProject(null); router.refresh(); }}
        />
      )}

      {reassignProject && (
        <ClientReassignModal
          isOpen={!!reassignProject}
          onClose={() => setReassignProject(null)}
          projectId={reassignProject.id}
          clientName={reassignProject.deal?.lead?.name || "Unknown Client"}
          currentAccountManagerId={reassignProject.accountManagerId}
          onSuccess={() => { setReassignProject(null); router.refresh(); }}
        />
      )}

      {distributeSeoProject && (
        <DistributeModal
          isOpen={!!distributeSeoProject}
          onClose={() => setDistributeSeoProject(null)}
          projectId={distributeSeoProject.id}
          projectName={distributeSeoProject.deal?.lead?.name || "Unknown Client"}
          availableUsers={headSeoUsers || []}
          actionLabel="Assign Head SEO"
          onDistributed={() => { setDistributeSeoProject(null); router.refresh(); }}
        />
      )}

      {warningProject && (
        <CreateWarningModal
          isOpen={!!warningProject}
          onClose={() => setWarningProject(null)}
          projectId={warningProject.id}
          clientId={warningProject.deal?.leadId}
        />
      )}
    </div>
  );
}
