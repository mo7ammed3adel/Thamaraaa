"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientDetailModal from "@/components/ClientDetailModal";
import LifecycleChangeModal from "@/components/LifecycleChangeModal";
import DistributeModal from "@/components/DistributeModal";
import ClientReassignModal from "@/components/ClientReassignModal";
import CreateWarningModal from "@/components/CreateWarningModal";
import { assignHeadAccountManager, distributeProject as distributeProjectRequest, updateProjectStatus } from "@/client/api/projects";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import HeadAccountManagerKpiGrid from "./HeadAccountManagerKpiGrid";
import HeadAccountManagerMasterList from "./HeadAccountManagerMasterList";
import HeadAccountManagerTasksPanel from "./HeadAccountManagerTasksPanel";
import HeadAccountManagerWorkload from "./HeadAccountManagerWorkload";
import { useHeadAccountManagerDerivedData } from "./useHeadAccountManagerDerivedData";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function HeadAccountManagerClient({ projects, accountManagers, headAccountManagers = [], currentUserRole, headTechnicals, headSeoUsers, kpis, userId }: any) {
  const t = useTranslator();
  const router = useRouter();
  const isSuperAdmin = currentUserRole === "super_admin";
  const [assigningHeadId, setAssigningHeadId] = useState<string | null>(null);
  const [filterAM, setFilterAM] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAssignHeadAm = async (projectId: string, headAccountManagerId: string) => {
    setAssigningHeadId(projectId);
    try {
      await assignHeadAccountManager(projectId, { headAccountManagerId: headAccountManagerId || null });
      notify(headAccountManagerId ? "Client assigned to Head Account Manager" : "Assignment cleared");
      router.refresh();
    } catch (e) {
      notify(e instanceof HttpError ? e.message : "Failed to assign");
    } finally {
      setAssigningHeadId(null);
    }
  };
  
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
      {/* ── Super Admin: distribute clients to a Head Account Manager ── */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Assign Clients to Head Account Manager</h2>
          <p className="text-xs text-slate-500 mb-4">A new client does not auto-drop on every Head AM — assign each one here.</p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-start">{t("common.client")}</th>
                  <th className="px-4 py-2 text-start">{t("common.package")}</th>
                  <th className="px-4 py-2 text-start">{t("role.headAccountManager")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {projects.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 italic">No clients yet.</td></tr>
                )}
                {projects.map((p: any) => (
                  <tr key={p.id} className={p.headAccountManagerId ? "" : "bg-amber-50/40"}>
                    <td className="px-4 py-2 font-semibold text-gray-900">{p.deal?.lead?.name || "Unknown"}</td>
                    <td className="px-4 py-2 text-gray-500">{p.package}</td>
                    <td className="px-4 py-2">
                      <select
                        value={p.headAccountManagerId || ""}
                        disabled={assigningHeadId === p.id}
                        onChange={(e) => handleAssignHeadAm(p.id, e.target.value)}
                        className="border rounded-lg px-2 py-1.5 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <option value="">— Unassigned —</option>
                        {headAccountManagers.map((h: any) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
          currentState={lifecycleProject.lifecycleState || "Active"}
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
