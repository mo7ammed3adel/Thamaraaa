type LeadInfo = {
  name?: string | null;
  phone?: string | null;
  source?: string | null;
  storeLink?: string | null;
  classification?: string | null;
  niche?: string | null;
  nationality?: string | null;
  customerType?: string | null;
  status?: string | null;
};

type ClientInfoProject = {
  storeUrl?: string | null;
  niche?: string | null;
};

type ClientInfoTabProps = {
  lead?: LeadInfo | null;
  project: ClientInfoProject;
};

export default function ClientInfoTab({ lead, project }: ClientInfoTabProps) {
  const items = [
    { label: "Full Name", value: lead?.name },
    { label: "Phone", value: lead?.phone },
    { label: "Source", value: lead?.source || "N/A" },
    { label: "Store Link", value: lead?.storeLink || project.storeUrl || "N/A" },
    { label: "Classification", value: lead?.classification, badge: true },
    { label: "Niche", value: lead?.niche || project.niche || "N/A" },
    { label: "Nationality", value: lead?.nationality || "N/A" },
    { label: "Customer Type", value: lead?.customerType || "N/A" },
    { label: "Lead Status", value: lead?.status },
  ];

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Client Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((item) => (
          <div key={item.label} className="border-b border-slate-100 pb-3">
            <p className="text-xs font-medium text-slate-400 uppercase mb-1">{item.label}</p>
            {item.badge ? (
              <span className={`px-2 py-0.5 rounded text-sm font-bold ${item.value === "Hot" ? "bg-red-100 text-red-700" : item.value === "Warm" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{item.value}</span>
            ) : (
              <p className="text-sm font-semibold text-slate-800">{item.value || "—"}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
