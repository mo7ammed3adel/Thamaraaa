type ClientWarning = {
  id: string;
  severity?: string | null;
  subject?: string | null;
  message?: string | null;
  createdAt: string | Date;
  sender?: { name?: string | null } | null;
  senderRole?: string | null;
};

type ClientWarningsTabProps = {
  warnings?: ClientWarning[];
};

export default function ClientWarningsTab({ warnings = [] }: ClientWarningsTabProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-3">Active Warnings ({warnings.length})</h2>
      <div className="space-y-3">
        {warnings.map((warning) => (
          <div key={warning.id} className="border border-orange-200 bg-orange-50 text-orange-800 rounded-lg p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase">{warning.severity}</span>
                <span className="text-xs opacity-60">•</span>
                <span className="text-sm font-bold">{warning.subject}</span>
              </div>
              <span className="text-xs opacity-60">{new Date(warning.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm">{warning.message}</p>
            <p className="text-xs opacity-70 mt-2">From: {warning.sender?.name || warning.senderRole}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
