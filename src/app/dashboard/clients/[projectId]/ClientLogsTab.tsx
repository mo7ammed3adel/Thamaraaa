import ProjectLogsPanel from "@/components/ProjectLogsPanel";

type ProjectLog = {
  id?: string;
  createdAt?: string | Date;
  action?: string | null;
  details?: string | null;
  userName?: string | null;
  userRole?: string | null;
};

type ClientLogsTabProps = {
  logs?: ProjectLog[];
};

export default function ClientLogsTab({ logs = [] }: ClientLogsTabProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Project Operational Logs</h2>
      <ProjectLogsPanel logs={logs} />
    </div>
  );
}
