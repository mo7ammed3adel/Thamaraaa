import { useTranslator } from "@/components/i18n/LocaleProvider";
type ProgressTask = {
  status?: string | null;
};

type ClientProgressProject = {
  seoProgress?: number | null;
  socialMediaProgress?: number | null;
  mediaBuyerProgress?: number | null;
  finalDeadline?: string | Date | null;
  tasks?: ProgressTask[];
};

type ClientProgressTabProps = {
  project: ClientProgressProject;
};

export default function ClientProgressTab({ project }: ClientProgressTabProps) {
  const t = useTranslator();
  const bars = [
    { label: "SEO Progress", value: project.seoProgress, color: "bg-blue-500" },
    { label: "Social Media Progress", value: project.socialMediaProgress, color: "bg-purple-500" },
    { label: "Media Buyer Progress", value: project.mediaBuyerProgress, color: "bg-amber-500" },
  ];
  const tasks = project.tasks || [];

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-6">{t("journey.progressTracking")}</h2>
      <div className="space-y-6">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">{bar.label}</span>
              <span className="text-sm font-bold text-slate-800">{bar.value}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
              <div className={`${bar.color} h-4 rounded-full transition-all duration-500 flex items-center justify-center`} style={{ width: `${bar.value}%` }}>
                {(bar.value || 0) > 15 && <span className="text-xs text-white font-bold">{bar.value}%</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
        <div className="text-center"><p className="text-xs text-slate-400">{t("task.deadline")}</p><p className="text-sm font-bold text-slate-700">{project.finalDeadline ? new Date(project.finalDeadline).toLocaleDateString() : "Not Set"}</p></div>
        <div className="text-center"><p className="text-xs text-slate-400">{t("journey.totalTasks")}</p><p className="text-sm font-bold text-slate-700">{tasks.length}</p></div>
        <div className="text-center"><p className="text-xs text-slate-400">{t("status.completed")}</p><p className="text-sm font-bold text-emerald-700">{tasks.filter((task) => task.status === "done").length}</p></div>
      </div>
    </div>
  );
}
