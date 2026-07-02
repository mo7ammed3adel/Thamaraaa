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


export default function ViralHrmClient() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [module, setModule] = useState("overview");

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200">
        {MODULES.map((item) => (
          <button
            key={item.id}
            onClick={() => setModule(item.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${module === item.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}
          >
            {item.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white" />
          <button onClick={load} disabled={loading} className="px-3 py-2 text-sm font-bold bg-slate-800 text-white rounded-lg disabled:opacity-50">Refresh</button>
        </div>
      </div>

      {loading && <div className="bg-white border rounded-xl p-8 text-center text-gray-400">Loading HRM data...</div>}
      {!loading && !data && <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center text-red-700">Failed to load HRM data.</div>}

      {!loading && data && module === "overview" && (
        <Overview data={data} />
      )}

      {!loading && data && module === "employees" && (
        <Profiles employees={employees} />
      )}

      {!loading && data && module === "departments" && (
        <Departments
          departments={departments}
          busy={busy}
          onCreate={createResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && module === "payroll" && (
        <PayrollPeriods
          data={data}
          month={month}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
        />
      )}

      {!loading && data && module === "advances" && (
        <Advances
          employees={employees}
          advances={data.salaryAdvances || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
        />
      )}

      {!loading && data && module === "compensation" && (
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

      {!loading && data && module === "requests" && (
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

      {!loading && data && module === "workflows" && (
        <Workflows
          workflows={data.workflows || []}
          requestTypes={data.requestTypes || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && module === "attendance" && (
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

      {!loading && data && module === "recruitment" && (
        <Recruitment
          departments={departments}
          requests={data.recruitmentRequests || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && module === "talent" && (
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

      {!loading && data && module === "kpis" && (
        <Kpis
          departments={departments}
          templates={data.kpiTemplates || []}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && module === "peopleOps" && (
        <PeopleOps
          employees={employees}
          data={data}
          busy={busy}
          onCreate={createResource}
          onUpdate={updateResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && module === "devicePasswords" && (
        <DevicePasswords
          employees={employees}
          entries={data.devicePasswords || []}
          busy={busy}
          onCreate={createResource}
          onDelete={removeResource}
        />
      )}

      {!loading && data && module === "settings" && (
        <Settings settings={data.settings || {}} busy={busy} onUpdate={updateResource} />
      )}

      {!loading && data && module === "audit" && (
        <AuditTrail activityLogs={data.activityLogs || []} settingAudits={data.settingAudits || []} />
      )}
    </div>
  );
}

