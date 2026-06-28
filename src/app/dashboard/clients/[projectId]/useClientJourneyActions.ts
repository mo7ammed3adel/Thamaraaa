"use client";

import { useState, type FormEvent } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";

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
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        taskType: newTaskType,
        brief: newTaskBrief,
        priority: newTaskPriority,
        deadline: newTaskDeadline || undefined,
        taskLink: newTaskLink.trim() || undefined,
      }),
    });
    setNewTaskBrief("");
    setNewTaskLink("");
    setCreatingTask(false);
    router.refresh();
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSaving(true);
    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, content: noteContent, category: noteCategory }),
    });
    setNoteContent("");
    setSaving(false);
    router.refresh();
  }

  async function handleUploadProjectFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fileUrl.trim()) return;

    setUploadingFile(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: fileUrl.trim(), fileType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || "Failed to upload project file");
        return;
      }

      setFileUrl("");
      setFileType("other");
      router.refresh();
    } catch (err) {
      notify("Network error — could not reach server.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleCreateWarning() {
    const message = prompt("Warning message for all teams:");
    if (!message) return;
    await fetch("/api/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    router.refresh();
  }

  async function handleAssignUser(taskId: string, field: "leaderId" | "agentId", newValue: string) {
    if (!taskId || !newValue) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`Assignment failed: ${data.error || "Unknown error"}`);
        return;
      }
      router.refresh();
    } catch (err) {
      notify("Network error — could not reach server.");
    }
  }

  async function handleUpdateStatus(taskId: string, status: string) {
    try {
      const payload: { status: string; completedAt?: string } = { status };
      if (status === "done") payload.completedAt = new Date().toISOString();
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to update status");
        return;
      }
      router.refresh();
    } catch (err) {
      notify("Network error — could not reach server.");
    }
  }

  async function handleUpdateProgress(taskId: string, progressPct: number) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPct }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || "Failed to update progress");
        return;
      }
      router.refresh();
    } catch (err) {
      notify("Network error — could not reach server.");
    }
  }

  async function handleTeamAssignment(department: string, roleType: "leader" | "agent", newUserId: string) {
    if (!department || !newUserId) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/team-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, assignedRoleType: roleType, newUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`Assignment failed: ${data.error || "Unknown error"}`);
        return;
      }
      router.refresh();
    } catch (err) {
      notify("Network error — could not reach server.");
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
