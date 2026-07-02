import { useState } from "react";
import {
  DataPanel,
  EmployeeSelect,
  Field,
  PrimaryButton,
  Select,
  SimpleTable,
  TextArea,
  TwoColumn,
  formatDate,
  formValues,
  money,
  parseJson,
  statusBadge,
} from "./ViralHrmSections";

export function Workflows({ workflows, requestTypes, busy, onCreate, onUpdate, onDelete }: any) {
  return (
    <TwoColumn>
      <DataPanel title="Workflow Builder">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("workflow", workflowValues(e.currentTarget), e.currentTarget); }}>
          <Field name="name" label="Workflow name" required />
          <Field name="moduleName" label="Module" defaultValue="requests" />
          <Select name="requestTypeKey" label="Request type" options={[["", "Any"], ...requestTypes.map((type: any) => [type.key, type.name])]} />
          <Select name="rejectionRule" label="Rejection rule" options={["end_workflow", "return_previous_step", "return_to_employee", "send_to_hr", "escalate"].map((value) => [value, value.replace(/_/g, " ")])} />
          <TextArea name="stepsJson" label="Steps JSON" />
          <p className="text-[11px] text-gray-400">Example: [{"{"}"stepNumber":1,"name":"Direct Manager","approverType":"direct_manager"{"}"}]. Empty creates the workflow shell.</p>
          <PrimaryButton disabled={busy}>Create Workflow</PrimaryButton>
        </form>
      </DataPanel>
      <DataPanel title="Configured Workflows">
        <SimpleTable
          columns={["Workflow", "Module", "Steps", "Status", "Actions"]}
          rows={workflows.map((workflow: any) => [
            workflow.name,
            workflow.moduleName,
            (workflow.steps || []).map((step: any) => `${step.stepNumber}. ${step.name}`).join(" -> ") || "-",
            statusBadge(workflow.active ? "active" : "inactive"),
            <div key={workflow.id} className="flex gap-2">
              <button onClick={() => onUpdate("workflow", { id: workflow.id, active: !workflow.active })} className="text-xs font-bold text-blue-700">{workflow.active ? "Deactivate" : "Activate"}</button>
              <button onClick={() => onDelete("workflow", workflow.id)} className="text-xs font-bold text-red-600">Delete</button>
            </div>,
          ])}
        />
      </DataPanel>
    </TwoColumn>
  );
}

export function RequestCenter({ employees, requestTypes, requests, delegations, tags, busy, onCreate, onUpdate, onDelete }: any) {
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const selectedCount = selectedRequestIds.length;
  const allVisibleSelected = requests.length > 0 && requests.every((request: any) => selectedRequestIds.includes(request.id));

  const toggleRequest = (id: string) => {
    setSelectedRequestIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllVisible = () => {
    setSelectedRequestIds(allVisibleSelected ? [] : requests.map((request: any) => request.id));
  };

  const bulkUpdate = async (status: string) => {
    if (selectedCount === 0) return;
    await onUpdate("hrRequestBulk", { ids: selectedRequestIds, status, notes: `Bulk ${status}` });
    setSelectedRequestIds([]);
  };

  return (
    <div className="space-y-5">
      <TwoColumn>
        <DataPanel title="Request Types + SLA">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onCreate("requestType", formValues(e.currentTarget), e.currentTarget); }}>
            <Field name="name" label="Type name" required />
            <Field name="key" label="Key" required />
            <Field name="responseSlaHours" label="Response SLA hours" type="number" defaultValue="24" />
            <Field name="approvalSlaHours" label="Approval SLA hours" type="number" defaultValue="48" />
            <div className="md:col-span-2"><PrimaryButton disabled={busy}>Create Type</PrimaryButton></div>
          </form>
        </DataPanel>
        <DataPanel title="Submit Central Request">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("hrRequest", requestValues(e.currentTarget), e.currentTarget); }}>
            <EmployeeSelect employees={employees} />
            <Select name="typeKey" label="Request type" options={requestTypes.map((type: any) => [type.key, type.name])} />
            <Select name="priority" label="Priority" options={["low", "medium", "high", "urgent"].map((value) => [value, value])} />
            <TextArea name="payloadJson" label="Payload JSON" />
            <PrimaryButton disabled={busy}>Submit Request</PrimaryButton>
          </form>
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Requests, SLA and Workflow Status">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleAllVisible} className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-white hover:bg-gray-50">
            {allVisibleSelected ? "Clear" : "Select all"}
          </button>
          <span className="text-xs text-gray-500">{selectedCount} selected</span>
          {["approved", "rejected", "returned"].map((status) => (
            <button
              key={status}
              type="button"
              disabled={busy || selectedCount === 0}
              onClick={() => bulkUpdate(status)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 disabled:opacity-40"
            >
              Bulk {status}
            </button>
          ))}
        </div>
        <SimpleTable
          columns={["Select", "Number", "Employee", "Type", "Priority", "SLA", "Status", "Actions"]}
          rows={requests.map((request: any) => [
            <input
              key={`select-${request.id}`}
              type="checkbox"
              checked={selectedRequestIds.includes(request.id)}
              onChange={() => toggleRequest(request.id)}
              className="h-4 w-4 rounded border-gray-300"
            />,
            request.requestNumber,
            request.employeeName,
            request.typeName,
            request.priority,
            statusBadge(request.slaStatus),
            statusBadge(request.status),
            <div key={request.id} className="flex flex-wrap gap-2">
              {["approved", "rejected", "returned"].map((status) => <button key={status} onClick={() => onUpdate("hrRequest", { id: request.id, status })} className="text-xs font-bold text-blue-700">{status}</button>)}
              <button onClick={() => onDelete("hrRequest", request.id)} className="text-xs font-bold text-red-600">Archive</button>
            </div>,
          ])}
        />
      </DataPanel>
      <TwoColumn>
        <DataPanel title="Delegation">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("delegation", formValues(e.currentTarget), e.currentTarget); }}>
            <Select name="delegatorId" label="Delegator" options={employees.map((employee: any) => [employee.id, employee.name])} />
            <Select name="delegateId" label="Delegate to" options={employees.map((employee: any) => [employee.id, employee.name])} />
            <Field name="startDate" label="Start date" type="date" required />
            <Field name="endDate" label="End date" type="date" required />
            <Field name="reason" label="Reason" required />
            <PrimaryButton disabled={busy}>Create Delegation</PrimaryButton>
          </form>
        </DataPanel>
        <DataPanel title="Tags">
          <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); onCreate("requestTag", formValues(e.currentTarget), e.currentTarget); }}>
            <input name="name" required placeholder="Tag name" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <input name="color" placeholder="#64748b" className="w-28 border rounded-lg px-3 py-2 text-sm" />
            <button disabled={busy} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold">Add</button>
          </form>
          <SimpleTable columns={["Name", "Color"]} rows={tags.map((tag: any) => [tag.name, tag.color || "-"])} />
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Active Delegations">
        <SimpleTable columns={["Delegator", "Delegate", "Window", "Status"]} rows={delegations.map((delegation: any) => [
          delegation.delegatorName,
          delegation.delegateName,
          `${formatDate(delegation.startDate)} - ${formatDate(delegation.endDate)}`,
          statusBadge(delegation.active ? "active" : "inactive"),
        ])} />
      </DataPanel>
    </div>
  );
}

export function AttendanceOps({ employees, shifts, shiftAssignments, holidays, attendanceAdjustments, busy, onCreate, onUpdate, onDelete }: any) {
  return (
    <div className="space-y-5">
      <TwoColumn>
        <DataPanel title="Create Shift">
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onCreate("shift", formValues(e.currentTarget), e.currentTarget); }}>
            <Field name="name" label="Shift name" required />
            <Field name="startTime" label="Start" type="time" defaultValue="09:00" />
            <Field name="endTime" label="End" type="time" defaultValue="17:00" />
            <Field name="lateGraceMinutes" label="Late grace" type="number" defaultValue="15" />
            <div className="col-span-2"><PrimaryButton disabled={busy}>Create Shift</PrimaryButton></div>
          </form>
        </DataPanel>
        <DataPanel title="Official Holiday">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("holiday", formValues(e.currentTarget), e.currentTarget); }}>
            <Field name="name" label="Holiday name" required />
            <Field name="startDate" label="Start" type="date" required />
            <Field name="endDate" label="End" type="date" required />
            <Select name="appliesTo" label="Applies to" options={[["all", "All employees"], ["departments", "Selected departments"]]} />
            <PrimaryButton disabled={busy}>Create Holiday</PrimaryButton>
          </form>
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Attendance Adjustment Requests">
        <form className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4" onSubmit={(e) => { e.preventDefault(); onCreate("attendanceAdjustment", formValues(e.currentTarget), e.currentTarget); }}>
          <div className="md:col-span-2"><EmployeeSelect employees={employees} /></div>
          <Field name="requestDate" label="Date" type="date" required />
          <Select name="adjustmentType" label="Type" options={["missed_check_in", "missed_check_out", "wrong_check_in_time", "wrong_check_out_time", "device_failure", "other"].map((value) => [value, value.replace(/_/g, " ")])} />
          <Field name="correctTime" label="Correct time" type="datetime-local" required />
          <Field name="reason" label="Reason" required />
          <div className="md:col-span-6"><PrimaryButton disabled={busy}>Submit Adjustment</PrimaryButton></div>
        </form>
        <SimpleTable
          columns={["Employee", "Date", "Type", "Status", "Actions"]}
          rows={attendanceAdjustments.map((adjustment: any) => [
            adjustment.employeeName,
            formatDate(adjustment.requestDate),
            adjustment.adjustmentType,
            statusBadge(adjustment.status),
            <div key={adjustment.id} className="flex gap-2">
              <button onClick={() => onUpdate("attendanceAdjustment", { id: adjustment.id, status: "approved" })} className="text-xs font-bold text-emerald-700">Approve</button>
              <button onClick={() => onUpdate("attendanceAdjustment", { id: adjustment.id, status: "rejected" })} className="text-xs font-bold text-red-600">Reject</button>
            </div>,
          ])}
        />
      </DataPanel>
      <TwoColumn>
        <DataPanel title="Shifts"><SimpleTable columns={["Name", "Time", "Grace", "Status"]} rows={shifts.map((shift: any) => [shift.name, `${shift.startTime} - ${shift.endTime}`, `${shift.lateGraceMinutes} min`, statusBadge(shift.active ? "active" : "inactive")])} /></DataPanel>
        <DataPanel title="Holidays"><SimpleTable columns={["Name", "Dates", "Applies"]} rows={holidays.map((holiday: any) => [holiday.name, `${formatDate(holiday.startDate)} - ${formatDate(holiday.endDate)}`, holiday.appliesTo])} /></DataPanel>
      </TwoColumn>
    </div>
  );
}

export function TalentPool({ departments, candidates, processes, interviews, offers, busy, onCreate, onUpdate, onDelete }: any) {
  return (
    <div className="space-y-5">
      <TwoColumn>
        <DataPanel title="Add Candidate">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("candidate", formValues(e.currentTarget), e.currentTarget); }}>
            <Field name="fullName" label="Full name" required />
            <Field name="phone" label="Phone" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="currentPosition" label="Current position" />
            <Field name="yearsOfExperience" label="Years experience" type="number" />
            <Field name="skills" label="Skills comma-separated" />
            <PrimaryButton disabled={busy}>Add Candidate</PrimaryButton>
          </form>
        </DataPanel>
        <DataPanel title="Reuse Candidate in Hiring Process">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("candidateProcess", formValues(e.currentTarget), e.currentTarget); }}>
            <CandidateSelect candidates={candidates} />
            <Field name="positionTitle" label="Position" required />
            <Select name="departmentName" label="Department" options={departments.map((department: any) => [department.name, department.name])} />
            <Field name="requiredSkills" label="Required skills" />
            <Field name="maxSalary" label="Max salary" type="number" />
            <PrimaryButton disabled={busy}>Start Process</PrimaryButton>
          </form>
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Talent Pool">
        <SimpleTable columns={["Candidate", "Phone", "Current", "Processes", "Actions"]} rows={candidates.map((candidate: any) => [
          <div key={candidate.id}><div className="font-bold">{candidate.fullName}</div><div className="text-xs text-gray-500">{candidate.email}</div></div>,
          candidate.phone,
          candidate.currentPosition || "-",
          candidate.processes?.length || 0,
          <button key={candidate.id} onClick={() => onDelete("candidate", candidate.id)} className="text-xs font-bold text-red-600">Archive</button>,
        ])} />
      </DataPanel>
      <TwoColumn>
        <DataPanel title="Schedule Interview">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("interview", formValues(e.currentTarget), e.currentTarget); }}>
            <ProcessSelect processes={processes} />
            <Select name="interviewType" label="Type" options={["hr_interview", "technical_interview", "final_interview"].map((value) => [value, value.replace(/_/g, " ")])} />
            <Field name="interviewDateTime" label="Date/time" type="datetime-local" required />
            <Field name="meetingLink" label="Meeting link" />
            <PrimaryButton disabled={busy}>Schedule</PrimaryButton>
          </form>
        </DataPanel>
        <DataPanel title="Create Offer">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("offer", formValues(e.currentTarget), e.currentTarget); }}>
            <ProcessSelect processes={processes} />
            <Field name="jobTitle" label="Job title" required />
            <Field name="offeredSalary" label="Offered salary" type="number" required />
            <Field name="joiningDate" label="Joining date" type="date" />
            <PrimaryButton disabled={busy}>Create Offer</PrimaryButton>
          </form>
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Recruitment Processes">
        <SimpleTable columns={["Candidate", "Position", "Status", "Match", "Actions"]} rows={processes.map((process: any) => [
          process.candidate?.fullName || "-",
          process.positionTitle,
          statusBadge(process.status),
          process.matchScore != null ? `${process.matchScore}%` : "-",
          ["cv_review", "hr_interview", "technical_interview", "offer_sent", "hired", "rejected"].map((status) => <button key={status} onClick={() => onUpdate("candidateProcess", { id: process.id, status })} className="mr-2 text-xs font-bold text-blue-700">{status.replace(/_/g, " ")}</button>),
        ])} />
      </DataPanel>
    </div>
  );
}

export function CompensationCenter({ employees, salaryChanges, promotions, compensationItems, busy, onCreate, onUpdate }: any) {
  return (
    <div className="space-y-5">
      <TwoColumn>
        <DataPanel title="Salary Change Request">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("salaryChange", formValues(e.currentTarget), e.currentTarget); }}>
            <EmployeeSelect employees={employees} />
            <Select name="changeType" label="Change type" options={["salary_increase", "salary_decrease", "promotion", "annual_review", "market_adjustment", "correction"].map((value) => [value, value.replace(/_/g, " ")])} />
            <Field name="proposedSalary" label="Proposed salary" type="number" required />
            <Field name="effectiveDate" label="Effective date" type="date" required />
            <Field name="reason" label="Reason" required />
            <PrimaryButton disabled={busy}>Create Request</PrimaryButton>
          </form>
        </DataPanel>
        <DataPanel title="Promotion / Transfer">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("promotion", formValues(e.currentTarget), e.currentTarget); }}>
            <EmployeeSelect employees={employees} />
            <Select name="promotionType" label="Type" options={["promotion", "internal_transfer", "job_title_change", "department_transfer", "promotion_with_salary"].map((value) => [value, value.replace(/_/g, " ")])} />
            <Field name="newDepartment" label="New department" />
            <Field name="newJobPosition" label="New job position" />
            <Field name="newSalary" label="New salary" type="number" />
            <Field name="effectiveDate" label="Effective date" type="date" required />
            <Field name="reason" label="Reason" required />
            <PrimaryButton disabled={busy}>Create Promotion</PrimaryButton>
          </form>
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Salary Approval Workflow">
        <SimpleTable columns={["Employee", "Type", "Current", "Proposed", "Diff", "Status", "Actions"]} rows={salaryChanges.map((request: any) => [
          request.employeeName,
          request.changeType,
          money(request.currentSalary),
          money(request.proposedSalary),
          `${money(request.differenceAmount)} / ${request.differencePercentage}%`,
          statusBadge(request.status),
          <div key={request.id} className="flex gap-2">
            <button onClick={() => onUpdate("salaryChange", { id: request.id, status: "approved" })} className="text-xs font-bold text-emerald-700">Approve</button>
            <button onClick={() => onUpdate("salaryChange", { id: request.id, status: "rejected" })} className="text-xs font-bold text-red-600">Reject</button>
          </div>,
        ])} />
      </DataPanel>
      <TwoColumn>
        <DataPanel title="Bonuses / Allowances / Deductions">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onCreate("compensationItem", formValues(e.currentTarget), e.currentTarget); }}>
            <EmployeeSelect employees={employees} />
            <Select name="itemType" label="Type" options={["bonus", "allowance", "deduction"].map((value) => [value, value])} />
            <Field name="category" label="Category" required />
            <Field name="amount" label="Amount" type="number" required />
            <Field name="startDate" label="Date" type="date" required />
            <Field name="reason" label="Reason" />
            <PrimaryButton disabled={busy}>Add Item</PrimaryButton>
          </form>
        </DataPanel>
        <DataPanel title="Promotion Approvals">
          <SimpleTable columns={["Employee", "Type", "New role", "Status", "Actions"]} rows={promotions.map((promotion: any) => [
            promotion.employeeName,
            promotion.promotionType,
            promotion.newJobPosition || promotion.newDepartment || "-",
            statusBadge(promotion.status),
            <button key={promotion.id} onClick={() => onUpdate("promotion", { id: promotion.id, status: "approved" })} className="text-xs font-bold text-emerald-700">Approve</button>,
          ])} />
        </DataPanel>
      </TwoColumn>
      <DataPanel title="Compensation Items">
        <SimpleTable columns={["Employee", "Type", "Category", "Amount", "Date"]} rows={compensationItems.map((item: any) => [item.employeeName, item.itemType, item.category, money(item.amount), formatDate(item.startDate)])} />
      </DataPanel>
    </div>
  );
}

export function AuditTrail({ activityLogs, settingAudits }: any) {
  return (
    <TwoColumn>
      <DataPanel title="Activity Log">
        <SimpleTable columns={["When", "Module", "Action", "Actor", "Employee"]} rows={activityLogs.map((entry: any) => [
          new Date(entry.createdAt).toLocaleString(),
          entry.module,
          entry.action,
          entry.actorName,
          entry.employeeName || "-",
        ])} />
      </DataPanel>
      <DataPanel title="Settings Audit">
        <SimpleTable columns={["When", "Key", "Changed by", "Previous", "New"]} rows={settingAudits.map((entry: any) => [
          new Date(entry.createdAt).toLocaleString(),
          entry.key,
          entry.changedByName,
          entry.previousValue || "-",
          entry.newValue,
        ])} />
      </DataPanel>
    </TwoColumn>
  );
}

function CandidateSelect({ candidates }: { candidates: any[] }) {
  return <Select name="candidateId" label="Candidate" options={candidates.map((candidate) => [candidate.id, `${candidate.fullName} - ${candidate.email}`])} />;
}

function ProcessSelect({ processes }: { processes: any[] }) {
  return <Select name="processId" label="Hiring process" options={processes.map((process) => [process.id, `${process.candidate?.fullName || "Candidate"} - ${process.positionTitle}`])} />;
}

function workflowValues(form: HTMLFormElement) {
  const values = formValues(form);
  return {
    ...values,
    steps: parseJson(String(values.stepsJson || ""), []),
  };
}

function requestValues(form: HTMLFormElement) {
  const values = formValues(form);
  return {
    ...values,
    payload: parseJson(String(values.payloadJson || ""), {}),
  };
}
