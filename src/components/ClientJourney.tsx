"use client";

import { useState } from "react";

interface JourneyEntry {
  stage: string;
  date: string;
  agentName: string;
  agentRole: string;
  notes?: string;
  details?: string;
}

interface ClientJourneyProps {
  leadName: string;
  phone?: string;
  callLogs?: any[];
  meetings?: any[];
  deals?: any[];
  projectNotes?: string;
  tasks?: any[];
  globalNotes?: any[];
  warnings?: any[];
  payments?: any[];
  projectCreatedAt?: Date | string;
}

const stageColors: Record<string, { bg: string; border: string; dot: string; text: string }> = {
  project_creation: { bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-800", text: "text-slate-800" },
  telesales: { bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", text: "text-blue-700" },
  sales: { bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-500", text: "text-purple-700" },
  deal: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
  accounts: { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", text: "text-amber-700" },
  technical: { bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-500", text: "text-indigo-700" },
  delivery: { bg: "bg-teal-50", border: "border-teal-200", dot: "bg-teal-500", text: "text-teal-700" },
  note: { bg: "bg-cyan-50", border: "border-cyan-200", dot: "bg-cyan-400", text: "text-cyan-700" },
  warning: { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-700" },
  payment: { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-700" },
};

export default function ClientJourney({ leadName, phone, callLogs, meetings, deals, projectNotes, tasks, globalNotes, warnings, payments, projectCreatedAt }: ClientJourneyProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build timeline entries from all data
  const timeline: JourneyEntry[] = [];

  // Call logs (TeleSales stage)
  callLogs?.forEach((c) => {
    timeline.push({
      stage: "telesales",
      date: c.createdAt,
      agentName: c.agent?.name || "Agent",
      agentRole: "Tele Sales",
      notes: c.notes,
      details: `Call Status: ${c.callStatus}${c.classification ? ` | Classification: ${c.classification}` : ""}`,
    });
  });

  // Meetings (Sales stage)
  meetings?.forEach((m) => {
    timeline.push({
      stage: "sales",
      date: m.meetingDate || m.createdAt,
      agentName: m.salesAgent?.name || m.teleAgent?.name || "Agent",
      agentRole: "Sales",
      notes: m.salesNotes || m.summary,
      details: `Status: ${m.status}${m.dealAmount ? ` | Amount: ${m.dealAmount.toLocaleString()} SAR` : ""}`,
    });
  });

  // Deals
  deals?.forEach((d) => {
    timeline.push({
      stage: "deal",
      date: d.createdAt,
      agentName: d.salesAgent?.name || "Sales Agent",
      agentRole: "Sales",
      notes: `Package: ${d.package} | Payment: ${d.paymentMethod}`,
      details: `Total: ${d.totalAmount?.toLocaleString()} SAR | First Payment: ${d.firstAmount?.toLocaleString() || "N/A"} SAR | Status: ${d.status}`,
    });
  });

  // Tasks (Technical/Operations)
  tasks?.forEach((t) => {
    timeline.push({
      stage: "technical",
      date: t.createdAt,
      agentName: t.agent?.name || t.leader?.name || "Team",
      agentRole: t.assignedRole || t.taskType,
      notes: t.brief || t.taskType,
      details: `Progress: ${t.progressPct}% | Status: ${t.status || "pending"} | Priority: ${t.priority || "Medium"}`,
    });
  });

  // Global Notes
  globalNotes?.forEach((n) => {
    timeline.push({
      stage: "note",
      date: n.createdAt,
      agentName: n.userName,
      agentRole: n.userRole,
      notes: n.content,
      details: `Category: ${n.category}`,
    });
  });

  // Warnings
  warnings?.forEach((w) => {
    timeline.push({
      stage: "warning",
      date: w.createdAt,
      agentName: w.authorUserName || "System",
      agentRole: w.authorUserRole || "System",
      notes: w.content,
      details: `Severity: ${w.severity} | Code: ${w.type}${w.resolved ? " | RESOLVED" : " | UNRESOLVED"}`,
    });
  });

  // Payments
  payments?.forEach((p) => {
    timeline.push({
      stage: "payment",
      date: p.createdAt,
      agentName: "Accountant",
      agentRole: "Finance",
      notes: `Received payment of ${p.amount.toLocaleString()} SAR for ${p.type}`,
      details: `Transaction ID: ${p.transactionId || "N/A"}${p.note ? ` | Note: ${p.note}` : ""}`,
    });
  });

  // Project Creation
  if (projectCreatedAt) {
    timeline.push({
      stage: "project_creation",
      date: typeof projectCreatedAt === "string" ? projectCreatedAt : projectCreatedAt.toISOString(),
      agentName: "System",
      agentRole: "System",
      notes: "Project automatically created from closed deal.",
      details: `Base configuration instantiated`,
    });
  }

  // Sort by date
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-1">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-800">{leadName}</h3>
        {phone && <p className="text-sm text-slate-500">{phone}</p>}
      </div>

      {timeline.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-4">No journey data available yet.</p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

          <div className="space-y-3">
            {timeline.map((entry, i) => {
              const colors = stageColors[entry.stage] || stageColors.technical;
              const isExpanded = expanded === `${i}`;

              return (
                <div
                  key={i}
                  className={`relative pl-10 cursor-pointer transition-all duration-200`}
                  onClick={() => setExpanded(isExpanded ? null : `${i}`)}
                >
                  {/* Dot */}
                  <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ${colors.dot} ring-2 ring-white shadow-sm`} />

                  <div className={`${colors.bg} ${colors.border} border rounded-lg p-3 hover:shadow-sm transition`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase ${colors.text}`}>
                          {entry.stage}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-medium text-slate-600">{entry.agentName}</span>
                        <span className="text-xs text-slate-400">({entry.agentRole})</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {entry.notes && (
                      <p className="text-sm text-slate-700 mt-1.5 line-clamp-2">{entry.notes}</p>
                    )}

                    {isExpanded && entry.details && (
                      <div className="mt-2 pt-2 border-t border-slate-200/50">
                        <p className="text-xs text-slate-600">{entry.details}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {projectNotes && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-xs font-bold text-yellow-700 uppercase mb-1">Account Manager Notes</h4>
          <p className="text-sm text-yellow-800">{projectNotes}</p>
        </div>
      )}
    </div>
  );
}
