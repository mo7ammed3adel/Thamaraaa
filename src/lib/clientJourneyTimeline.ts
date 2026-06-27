type UserRef = {
  name?: string | null;
  role?: string | null;
};

type CallLogRef = {
  createdAt: string | Date;
  callStatus?: string | null;
  notes?: string | null;
  agent?: UserRef | null;
};

type MeetingRef = {
  meetingDate: string | Date;
  status?: string | null;
  salesNotes?: string | null;
  summary?: string | null;
  salesAgent?: UserRef | null;
  teleAgent?: UserRef | null;
};

type LeadRef = {
  id?: string | null;
  name?: string | null;
  source?: string | null;
  classification?: string | null;
  createdAt?: string | Date;
  createdBy?: UserRef | null;
  callLogs?: CallLogRef[];
  meetings?: MeetingRef[];
};

type InstallmentRef = {
  dueDate: string | Date;
  amount?: number | null;
  isPaid?: boolean | null;
};

type DealRef = {
  createdAt?: string | Date;
  package?: string | null;
  totalAmount?: number | null;
  firstAmount?: number | null;
  paymentMethod?: string | null;
  salesAgent?: UserRef | null;
  installments?: InstallmentRef[];
  lead?: LeadRef | null;
};

type TaskRef = {
  taskType: string;
  status?: string | null;
  progressPct?: number | null;
  createdAt: string | Date;
  completedAt?: string | Date | null;
  leader?: UserRef | null;
  agent?: UserRef | null;
};

type GlobalNoteRef = {
  category?: string | null;
  createdAt: string | Date;
  userName?: string | null;
  userRole?: string | null;
  content?: string | null;
};

type WarningRef = {
  severity?: string | null;
  createdAt: string | Date;
  sender?: UserRef | null;
  senderRole?: string | null;
  subject?: string | null;
  message?: string | null;
};

type ClientJourneyProject = {
  createdAt: string | Date;
  package?: string | null;
  niche?: string | null;
  projectStatus?: string | null;
  notes?: string | null;
  accountManager?: UserRef | null;
  deal?: DealRef | null;
  tasks?: TaskRef[];
  globalNotes?: GlobalNoteRef[];
  warnings?: WarningRef[];
};

export type ClientJourneyTimelineEntry = {
  stage: string;
  color: string;
  label: string;
  date: string | Date;
  agent: string;
  role: string;
  detail: string;
};

export function buildClientJourneyTimeline(project: ClientJourneyProject): ClientJourneyTimelineEntry[] {
  const deal = project.deal;
  const lead = deal?.lead;
  const entries: ClientJourneyTimelineEntry[] = [];

  if (lead?.createdAt) {
    entries.push({
      stage: "lead",
      color: "bg-slate-500",
      label: "Lead Created",
      date: lead.createdAt,
      agent: lead.createdBy?.name || "System",
      role: "TeleSales",
      detail: `Source: ${lead.source || "N/A"} | Classification: ${lead.classification}`,
    });
  }

  lead?.callLogs?.forEach((callLog) => {
    entries.push({
      stage: "telesales",
      color: "bg-blue-500",
      label: "Call Log",
      date: callLog.createdAt,
      agent: callLog.agent?.name || "Agent",
      role: "TeleSales",
      detail: `Status: ${callLog.callStatus} | ${callLog.notes}`,
    });
  });

  lead?.meetings?.forEach((meeting) => {
    entries.push({
      stage: "sales",
      color: "bg-purple-500",
      label: `Meeting (${meeting.status})`,
      date: meeting.meetingDate,
      agent: meeting.salesAgent?.name || meeting.teleAgent?.name || "Agent",
      role: "Sales",
      detail: meeting.salesNotes || meeting.summary || "No notes",
    });
  });

  if (deal?.createdAt) {
    entries.push({
      stage: "deal",
      color: "bg-emerald-500",
      label: "Deal Closed",
      date: deal.createdAt,
      agent: deal.salesAgent?.name || "Sales",
      role: "Sales",
      detail: `Package: ${deal.package} | Total: ${deal.totalAmount?.toLocaleString()} SAR | Method: ${deal.paymentMethod}`,
    });
  }

  if (deal?.firstAmount && deal.createdAt) {
    entries.push({
      stage: "payment",
      color: "bg-green-600",
      label: "First Payment",
      date: deal.createdAt,
      agent: "System",
      role: "Finance",
      detail: `Amount: ${deal.firstAmount.toLocaleString()} SAR`,
    });
  }

  deal?.installments?.forEach((installment, index) => {
    entries.push({
      stage: "payment",
      color: installment.isPaid ? "bg-green-500" : "bg-orange-500",
      label: `Installment ${index + 1} ${installment.isPaid ? "(Paid)" : "(Pending)"}`,
      date: installment.dueDate,
      agent: "System",
      role: "Finance",
      detail: `Amount: ${installment.amount?.toLocaleString()} SAR | Due: ${new Date(installment.dueDate).toLocaleDateString()}`,
    });
  });

  entries.push({
    stage: "accounts",
    color: "bg-amber-500",
    label: "Project Created",
    date: project.createdAt,
    agent: project.accountManager?.name || "AM",
    role: "Account Manager",
    detail: `Package: ${project.package} | Niche: ${project.niche || "N/A"} | Status: ${project.projectStatus}`,
  });

  if (project.notes) {
    entries.push({
      stage: "accounts",
      color: "bg-amber-400",
      label: "AM Notes",
      date: project.createdAt,
      agent: project.accountManager?.name || "AM",
      role: "Account Manager",
      detail: project.notes,
    });
  }

  project.tasks?.forEach((task) => {
    entries.push({
      stage: "technical",
      color: "bg-indigo-500",
      label: `Task: ${task.taskType.replace(/_/g, " ")}`,
      date: task.createdAt,
      agent: task.leader?.name || "Leader",
      role: task.taskType,
      detail: `Status: ${task.status} | Agent: ${task.agent?.name || "Unassigned"} | Progress: ${task.progressPct}%`,
    });
    if (task.completedAt) {
      entries.push({
        stage: "delivery",
        color: "bg-teal-500",
        label: `Completed: ${task.taskType.replace(/_/g, " ")}`,
        date: task.completedAt,
        agent: task.agent?.name || task.leader?.name || "Team",
        role: task.taskType,
        detail: `Duration: ${Math.ceil((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 86400000)} days`,
      });
    }
  });

  project.globalNotes?.forEach((note) => {
    entries.push({
      stage: "note",
      color: "bg-yellow-500",
      label: `Note (${note.category})`,
      date: note.createdAt,
      agent: note.userName || "User",
      role: (note.userRole || "user").replace(/_/g, " "),
      detail: note.content || "",
    });
  });

  project.warnings?.forEach((warning) => {
    entries.push({
      stage: "warning",
      color: "bg-red-500",
      label: `Warning (${warning.severity})`,
      date: warning.createdAt,
      agent: warning.sender?.name || "System",
      role: warning.senderRole?.replace(/_/g, " ") || "Warning",
      detail: `${warning.subject}: ${warning.message}`,
    });
  });

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return entries;
}
