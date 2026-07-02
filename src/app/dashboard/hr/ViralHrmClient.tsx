"use client";

import { useCallback, useEffect, useState } from "react";
import { notify } from "@/components/toast";
import { HttpError } from "@/client/transport/http";
import {
  createViralHrmResource,
  deleteViralHrmResource,
  getViralHrm,
  updateViralHrmResource,
} from "@/client/api/hr";
import {
  Advances,
  Departments,
  DevicePasswords,
  Kpis,
  Overview,
  PayrollPeriods,
  PeopleOps,
  Profiles,
  Recruitment,
  Settings,
} from "./ViralHrmSections";
import {
  AttendanceOps,
  AuditTrail,
  CompensationCenter,
  RequestCenter,
  TalentPool,
  Workflows,
} from "./ViralHrmAdvancedSections";

const MODULES = [
  { id: "overview", label: "Overview" },
  { id: "employees", label: "Profiles" },
  { id: "departments", label: "Departments" },
  { id: "payroll", label: "Payroll Periods" },
  { id: "compensation", label: "Compensation" },
  { id: "advances", label: "Advances" },
  { id: "requests", label: "Request Center" },
  { id: "workflows", label: "Workflows" },
  { id: "attendance", label: "Attendance Ops" },
  { id: "recruitment", label: "Recruitment" },
  { id: "talent", label: "Talent Pool" },
  { id: "kpis", label: "KPI Templates" },
  { id: "peopleOps", label: "People Ops" },
  { id: "devicePasswords", label: "Device Passwords" },
  { id: "settings", label: "Settings" },
  { id: "audit", label: "Audit" },
];

type ViralHrmClientProps = {
  module?: string;
};

export default function ViralHrmClient({ module: controlledModule }: ViralHrmClientProps = {}) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [module, setModule] = useState(controlledModule || "overview");
  const activeModule = controlledModule || module;

  const load = useCallback(() => {
    setLoading(true);
    getViralHrm({ month })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const createResource = async (resource: string, body: Record<string, any>, form?: HTMLFormElement) => {
    setBusy(true);
    try {
      await createViralHrmResource({ resource, ...body });
      form?.reset();
      notify("Saved");
      load();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const updateResource = async (resource: string, body: Record<string, any>) => {
    setBusy(true);
    try {
      await updateViralHrmResource({ resource, ...body });
      notify("Updated");
      load();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const removeResource = async (resource: string, id: string) => {
    if (!confirm("Delete this HRM record?")) return;
    setBusy(true);
    try {
      await deleteViralHrmResource(resource, id);
      notify("Deleted");
      load();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const employees = data?.employees || [];
  const departments = data?.departments || [];
  const showNavigation = !controlledModule;

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap items-center gap-2 ${showNavigation ? "border-b border-gray-200" : "justify-end"}`}>
        {showNavigation && MODULES.map((item) => (
          <button
            key={item.id}
            onClick={() => setModule(item.id)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${activeModule === item.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}
          >
            {item.label}
          </button>
        ))}
        <div className={`${showNavigation ? "ml-auto pb-2" : ""} flex items-center gap-2`}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
          <button onClick={load} disabled={loading} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Refresh</button>
        </div>
      </div>

      {loading && <div className="bg-white border rounded-xl p-8 text-center text-gray-400">Loading HRM data...</div>}
      {!loading && !data && <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-700">Failed to load HRM data.</div>}

      {!loading && data && activeModule === "overview" && (
        <Overview data={data} />
      )}

      {!loading && data && activeModule === "employees" && (
        <Profiles employees={employees} />
      )}

      {!loading && data && activeModule === "departments" && (
        <Departments
          departments={departments}
          busy={busy}
          onCreate={createResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "payroll" && (
        <PayrollPeriods
          data={data}
          month={month}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
        />
      )}

      {!loading && data && activeModule === "advances" && (
        <Advances
          employees={employees}
          advances={data.salaryAdvances || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
        />
      )}

      {!loading && data && activeModule === "compensation" && (
        <CompensationCenter
          employees={employees}
          salaryChanges={data.salaryChanges || []}
          promotions={data.promotions || []}
          compensationItems={data.compensationItems || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
        />
      )}

      {!loading && data && activeModule === "requests" && (
        <RequestCenter
          employees={employees}
          requestTypes={data.requestTypes || []}
          requests={data.hrRequests || []}
          delegations={data.delegations || []}
          tags={data.requestTags || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "workflows" && (
        <Workflows
          workflows={data.workflows || []}
          requestTypes={data.requestTypes || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "attendance" && (
        <AttendanceOps
          employees={employees}
          shifts={data.shifts || []}
          shiftAssignments={data.shiftAssignments || []}
          holidays={data.holidays || []}
          attendanceAdjustments={data.attendanceAdjustments || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "recruitment" && (
        <Recruitment
          departments={departments}
          requests={data.recruitmentRequests || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "talent" && (
        <TalentPool
          departments={departments}
          candidates={data.candidates || []}
          processes={data.candidateProcesses || []}
          interviews={data.interviews || []}
          offers={data.offers || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "kpis" && (
        <Kpis
          departments={departments}
          templates={data.kpiTemplates || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "peopleOps" && (
        <PeopleOps
          employees={employees}
          data={data}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "devicePasswords" && (
        <DevicePasswords
          employees={employees}
          entries={data.devicePasswords || []}
          busy={busy}
          onCreate={createResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && activeModule === "settings" && (
        <Settings settings={data.settings || {}} busy={busy} onUpdate={updateResource} />
      )}

      {!loading && data && activeModule === "audit" && (
        <AuditTrail activityLogs={data.activityLogs || []} settingAudits={data.settingAudits || []} />
      )}
    </div>
  );
}

