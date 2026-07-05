"use client";

import { useState, type FormEvent } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { createTask, updateTask } from "@/client/api/tasks";
import { createNote } from "@/client/api/notes";
import { addProjectFile, updateProjectTeamAssignment } from "@/client/api/projects";
import { createWarning } from "@/client/api/warnings";
import { HttpError } from "@/client/transport/http";

/** These fire-and-forget flows always refreshed even on a rejected request,
 * so an HTTP failure is swallowed to keep that behavior; network errors still throw. */
function swallowHttpError(error: unknown) {
  if (!(error instanceof HttpError)) throw error;
}

type ClientJourneyActionsParams = {
  project: {
    id: string;
  };
  lead?: {
    id?: string | null;
    name?: string | null;
  } | null;
};

export function useClientJourneyActions({ project, lead }: ClientJourneyActionsParams) {
  const router = useRouter();
  const [noteContent, setNoteContent] = useState("");
  const [noteCategory, setNoteCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("other");
  const [uploadingFile, setUploadingFile] = useState(false);

  const [newTaskType, setNewTaskType] = useState("seo");
  const [newTaskBrief, setNewTaskBrief] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("Medium");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newTaskLink, setNewTaskLink] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const [taskFilterTeam, setTaskFilterTeam] = useState("all");
  const [taskFilterStatus, setTaskFilterStatus] = useState("all");
  const [taskFilterCreator, setTaskFilterCreator] = useState("all");

  async function handleCreateTask() {
    if (!newTaskBrief) return notify("Please enter task details");
    setCreatingTask(true);
    await createTask({
      projectId: project.id,
      taskType: newTaskType,
      brief: newTaskBrief,
      priority: newTaskPriority,
      deadline: newTaskDeadline || undefined,
      taskLink: newTaskLink.trim() || undefined,
    }).catch(swallowHttpError);
    setNewTaskBrief("");
    setNewTaskLink("");
    setCreatingTask(false);
    router.refresh();
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSaving(true);
    await createNote({ projectId: project.id, content: noteContent, category: noteCategory }).catch(swallowHttpError);
    setNoteContent("");
    setSaving(false);
    router.refresh();
  }

  async function handleUploadProjectFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fileUrl.trim()) return;

    setUploadingFile(true);
    try {
      await addProjectFile(project.id, { fileUrl: fileUrl.trim(), fileType });

      setFileUrl("");
      setFileType("other");
      router.refresh();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Network error — could not reach server.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleCreateWarning() {
    const message = prompt("Warning message for all teams:");
    if (!message) return;
    await createWarning({
      message: `⚠️ ${lead?.name}: ${message}`,
      clientId: lead?.id,
      projectId: project.id,
      recipientRoles: [
        "account_manager", "head_account_manager", "head_technical", "head_seo",
        "team_leader_seo", "team_leader_social_media", "team_leader_media_buyer",
        "agent_seo", "agent_social_media", "agent_media_buyer",
        "leader_graphic_designer", "agent_graphic_designer",
        "leader_motion_graphic", "agent_motion_graphic", "leader_ui", "agent_ui",
      ],
    }).catch(swallowHttpError);
    router.refresh();
  }

  async function handleAssignUser(taskId: string, field: "leaderId" | "agentId", newValue: string) {
    if (!taskId || !newValue) return;
    try {
      await updateTask(taskId, { [field]: newValue });
      router.refresh();
    } catch (err) {
      notify(err instanceof HttpError ? `Assignment failed: ${err.message}` : "Network error — could not reach server.");
    }
  }

  async function handleUpdateStatus(taskId: string, status: string) {
    try {
      const payload: { status: string; completedAt?: string } = { status };
      if (status === "done") payload.completedAt = new Date().toISOString();
      await updateTask(taskId, payload);
      router.refresh();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Network error — could not reach server.");
    }
  }

  async function handleUpdateProgress(taskId: string, progressPct: number) {
    try {
      await updateTask(taskId, { progressPct });
      router.refresh();
    } catch (err) {
      notify(err instanceof HttpError ? err.message : "Network error — could not reach server.");
    }
  }

  async function handleTeamAssignment(department: string, roleType: "leader" | "agent", newUserId: string) {
    if (!department || !newUserId) return;
    try {
      await updateProjectTeamAssignment(project.id, { department, assignedRoleType: roleType, newUserId });
      router.refresh();
    } catch (err) {
      notify(err instanceof HttpError ? `Assignment failed: ${err.message}` : "Network error — could not reach server.");
    }
  }

  return {
    noteContent,
    setNoteContent,
    noteCategory,
    setNoteCategory,
    saving,
    fileUrl,
    setFileUrl,
    fileType,
    setFileType,
    uploadingFile,
    newTaskType,
    setNewTaskType,
    newTaskBrief,
    setNewTaskBrief,
    newTaskPriority,
    setNewTaskPriority,
    newTaskDeadline,
    setNewTaskDeadline,
    newTaskLink,
    setNewTaskLink,
    creatingTask,
    taskFilterTeam,
    setTaskFilterTeam,
    taskFilterStatus,
    setTaskFilterStatus,
    taskFilterCreator,
    setTaskFilterCreator,
    handleCreateTask,
    handleAddNote,
    handleUploadProjectFile,
    handleCreateWarning,
    handleAssignUser,
    handleUpdateStatus,
    handleUpdateProgress,
    handleTeamAssignment,
    goBack: () => router.back(),
  };
}
