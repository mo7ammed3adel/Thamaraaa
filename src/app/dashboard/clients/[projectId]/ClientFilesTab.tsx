import type { Dispatch, FormEvent, SetStateAction } from "react";

type FileTask = {
  id: string;
  taskType: string;
  taskLink?: string | null;
  leader?: { name?: string | null; role?: string | null } | null;
  requesterRole?: string | null;
  createdAt: string | Date;
  deadline?: string | Date | null;
  status: string;
};

type ProjectFile = {
  id: string;
  fileUrl: string;
  fileType: string;
  createdAt: string | Date;
};

type ClientFilesProject = {
  tasks?: FileTask[];
  files?: ProjectFile[];
  driveLink?: string | null;
  storeUrl?: string | null;
};

type ClientFilesTabProps = {
  project: ClientFilesProject;
  canUploadProjectFiles: boolean;
  fileType: string;
  setFileType: Dispatch<SetStateAction<string>>;
  fileUrl: string;
  setFileUrl: Dispatch<SetStateAction<string>>;
  uploadingFile: boolean;
  handleUploadProjectFile: (event: FormEvent<HTMLFormElement>) => void;
};

function getTaskLinkMeta(link: string) {
  const url = link.toLowerCase();
  if (url.includes("drive.google")) return { icon: "📁", label: "Google Drive" };
  if (url.includes("docs.google.com/spreadsheets") || url.includes("sheets.google")) return { icon: "📊", label: "Google Sheet" };
  if (url.includes("docs.google.com/document")) return { icon: "📝", label: "Google Doc" };
  if (url.includes("docs.google.com/presentation")) return { icon: "📽️", label: "Google Slides" };
  if (url.includes("figma.com")) return { icon: "🎨", label: "Figma" };
  if (url.includes("canva.com")) return { icon: "🖼️", label: "Canva" };
  if (url.includes("notion.")) return { icon: "📓", label: "Notion" };
  if (url.includes("trello.")) return { icon: "📋", label: "Trello" };
  return { icon: "🔗", label: "Link" };
}

export default function ClientFilesTab({
  project,
  canUploadProjectFiles,
  fileType,
  setFileType,
  fileUrl,
  setFileUrl,
  uploadingFile,
  handleUploadProjectFile,
}: ClientFilesTabProps) {
  const taskLinks = (project.tasks || []).filter((task) => task.taskLink);
  const files = project.files || [];

  return (
    <div className="space-y-4">
      {taskLinks.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-800">📎 Task Links</h2>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">{taskLinks.length}</span>
            <span className="text-xs text-slate-400 ml-auto">Auto-synced from Tasks</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Link</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sent By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sent Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deadline</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {taskLinks.map((task) => {
                  const link = task.taskLink || "";
                  const { icon, label } = getTaskLinkMeta(link);
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "done";

                  return (
                    <tr key={task.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 capitalize">
                          {icon} {task.taskType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition max-w-[200px] truncate">
                          {label} ↗
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{task.leader?.name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500 capitalize">{(task.requesterRole || task.leader?.role || "—").replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(task.createdAt).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3">
                        {task.deadline ? (
                          <span className={`text-xs font-semibold ${isOverdue ? "text-red-600" : "text-slate-600"}`}>
                            {new Date(task.deadline).toLocaleDateString("en-GB")}
                            {isOverdue && " ⚠️"}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${task.status === "done" ? "bg-emerald-100 text-emerald-700" : task.status === "in_progress" ? "bg-amber-100 text-amber-700" : task.status === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                          {task.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Project Files</h2>
        {canUploadProjectFiles && (
          <form onSubmit={handleUploadProjectFile} className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 mb-5 p-4 bg-slate-50 border rounded-xl">
            <select value={fileType} onChange={(e) => setFileType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="contract">Contract</option>
              <option value="screenshot">Screenshot</option>
              <option value="report">Report</option>
              <option value="brief">Brief</option>
              <option value="other">Other</option>
            </select>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button type="submit" disabled={uploadingFile || !fileUrl.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
              {uploadingFile ? "Adding..." : "Add File"}
            </button>
          </form>
        )}
        {files.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4">No files uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((file) => (
              <a key={file.id} href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border rounded-lg p-4 hover:bg-slate-50 hover:shadow-sm transition">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg ${file.fileType === "contract" ? "bg-red-500" : file.fileType === "screenshot" ? "bg-blue-500" : "bg-slate-500"}`}>
                  {file.fileType === "contract" ? "📄" : file.fileType === "screenshot" ? "📸" : "📎"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 capitalize">{file.fileType}</p>
                  <p className="text-xs text-slate-400">{new Date(file.createdAt).toLocaleDateString()}</p>
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
          {project.driveLink && (
            <a href={project.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">📁 Google Drive Folder</a>
          )}
          {project.storeUrl && (
            <a href={project.storeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">🛒 Store Link</a>
          )}
        </div>
      </div>
    </div>
  );
}
