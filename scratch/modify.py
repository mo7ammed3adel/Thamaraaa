import sys
with open('src/app/dashboard/sales/SalesClient.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add imports
imports_to_add = '''
import { LifecycleStateBadge } from "@/components/LifecycleStateBadge";
import { TeamOverview } from "@/components/TeamOverview";
import { ClientJourney } from "@/components/ClientJourney";
'''
text = text.replace('from "lucide-react";', 'from "lucide-react";\n' + imports_to_add)

# Change props
text = text.replace(
    'export default function SalesClient({ initialLeads, userRole, userId, initialStatus }: { initialLeads: any[], userRole: string, userId: string, initialStatus: string }) {',
    'export default function SalesClient({ initialLeads, userRole, userId, initialStatus, postSaleProjects = [] }: { initialLeads: any[], userRole: string, userId: string, initialStatus: string, postSaleProjects?: any[] }) {'
)

# Add state
state_to_add = '''
  const [activeTab, setActiveTab] = useState("sales");
  const [journeyProject, setJourneyProject] = useState<any>(null);
  const [journeyData, setJourneyData] = useState<any>(null);

  const openJourney = async (project: any) => {
    setJourneyProject(project);
    try {
      const res = await fetch(`/api/projects/${project.id}/journey`);
      if (res.ok) {
        const data = await res.json();
        setJourneyData(data.journey);
      }
    } catch(e) {
      console.error(e);
    }
  };
'''
text = text.replace('const [logFilter, setLogFilter] = useState("All");', 'const [logFilter, setLogFilter] = useState("All");\n' + state_to_add)

# Add tabs to UI
ui_tabs = '''
      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6 border-slate-200">
        <button 
          onClick={() => setActiveTab("sales")}
          className={`pb-2 font-bold px-2 ${activeTab === "sales" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
        >
          Sales Workspace
        </button>
        <button 
          onClick={() => setActiveTab("post-sale")}
          className={`pb-2 font-bold px-2 ${activeTab === "post-sale" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
        >
          Post-Sale Journey
        </button>
      </div>

      {activeTab === "sales" ? (
        <>
'''
text = text.replace('<div className="mb-6 flex justify-between items-center', ui_tabs + '\n      <div className="mb-6 flex justify-between items-center', 1)

# Add post-sale tab content
post_sale_content = '''
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
             <h2 className="text-xl font-bold">Post-Sale Journey</h2>
             <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{postSaleProjects.length} Projects</span>
          </div>
          {postSaleProjects.length === 0 ? (
            <p className="text-gray-500 italic text-center py-10">No closed deals with active operations found.</p>
          ) : (
            postSaleProjects.map((project: any) => {
              const completedTasks = project.tasks?.filter((t:any) => t.status === "done").length || 0;
              const inProgressTasks = project.tasks?.filter((t:any) => t.status !== "done").length || 0;
              const totalTasks = project.tasks?.length || 0;

              // Format teams for TeamOverview
              const teamsMap = new Map();
              project.teamAssignments?.forEach((assignment: any) => {
                if (!teamsMap.has(assignment.department)) {
                  teamsMap.set(assignment.department, {
                    department: assignment.department,
                    leader: null,
                    agents: [],
                    taskCounts: { hold: 0, inProgress: 0, done: 0, total: 0 },
                    progressPercentage: 0
                  });
                }
                const team = teamsMap.get(assignment.department);
                if (assignment.role.includes("leader") || assignment.role.includes("head")) {
                  team.leader = assignment.user;
                } else {
                  team.agents.push(assignment.user);
                }
              });

              project.tasks?.forEach((t: any) => {
                 const tDept = t.taskType === "technical" ? "technical" : (t.taskType || "general");
                 if (!tDept) return;
                 // Need to normalize to team map or just add loosely
                 let targetDept = tDept;
                 if (tDept === "technical" && !teamsMap.has("technical")) targetDept = "seo"; // fallback for demo
                 
                 if (teamsMap.has(targetDept)) {
                   const team = teamsMap.get(targetDept);
                   team.taskCounts.total++;
                   if (t.status === "done") team.taskCounts.done++;
                   else if (t.status === "hold") team.taskCounts.hold++;
                   else team.taskCounts.inProgress++;
                   team.progressPercentage = team.taskCounts.total ? Math.round((team.taskCounts.done / team.taskCounts.total) * 100) : 0;
                 }
              });

              return (
                <div key={project.id} className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm space-y-5 transition hover:shadow-md">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{project.deal?.lead?.name || "Unknown Client"}</h3>
                      <p className="text-sm text-gray-500 mt-1">Account Manager: <span className="font-semibold text-slate-700">{project.accountManager?.name || "Not Assigned"}</span></p>
                    </div>
                    <div>
                      <LifecycleStateBadge state={project.lifecycleState} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                     <div className="flex justify-between items-center">
                       <span className="text-slate-500 border-b border-transparent font-medium">Ops Tasks 📋</span>
                       <span className="font-bold text-slate-700">{completedTasks}/{totalTasks} <span className="text-[10px] text-slate-400 font-normal">({inProgressTasks} active)</span></span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-slate-500 border-b border-transparent font-medium">Notes 📝</span>
                       <span className="font-bold text-slate-700">{project._count?.notes || 0}</span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-slate-500 border-b border-transparent font-medium">Warnings ⚠️</span>
                       <span className="font-bold text-red-500">{project._count?.warnings || 0}</span>
                     </div>
                  </div>

                  {teamsMap.size > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-5">
                       <h4 className="font-bold text-sm text-slate-700 mb-4 tracking-wide uppercase">Teams Overview</h4>
                       <TeamOverview teams={Array.from(teamsMap.values())} />
                    </div>
                  )}

                  <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-4">
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      Last Updated: {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                    <button onClick={() => openJourney(project)} className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition">
                      View Full Journey &rarr;
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Full Journey Modal */}
      {journeyProject && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center p-4 overflow-y-auto">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 my-8 min-h-[50vh]">
             <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
               <div>
                 <h3 className="text-2xl font-black text-slate-800">Client Journey</h3>
                 <p className="text-sm font-semibold text-slate-500 mt-1">{journeyProject.deal?.lead?.name}</p>
               </div>
               <button onClick={() => { setJourneyProject(null); setJourneyData(null); }} className="text-slate-400 hover:text-slate-800 transition p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
             </div>
             <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 h-[600px] overflow-y-auto">
               {journeyData ? (
                 <ClientJourney 
                    leadName={journeyProject.deal?.lead?.name}
                    phone={journeyProject.deal?.lead?.phone}
                    callLogs={journeyData.callLogs}
                    meetings={journeyData.meetings}
                    deals={journeyData.deals}
                    globalNotes={journeyData.notes}
                    projectLogs={journeyData.projectLogs}
                    tasks={journeyData.tasks}
                 />
               ) : (
                 <div className="flex justify-center items-center h-full"><div className="animate-pulse flex items-center gap-2 font-semibold text-slate-500"><div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>Loading journey data...</div></div>
               )}
             </div>
           </div>
        </div>
      )}
'''

import re
text = re.sub(r'(\s+)(</div>)(\s+)(</div>\s+\);\s+})', post_sale_content + r'\1\2\3\4', text)
# Note: Since I used {TeamOverview} and {ClientJourney} I'll export them as default or named below if they are not exported that way.

with open('src/app/dashboard/sales/SalesClient.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
