"use client";

import { useState, useEffect } from "react";

/**
 * Props for the TaskReassignModal component.
 * @param taskId - The ID of the task to reassign
 * @param taskName - Display name for the task
 * @param leaderRole - The current Team Leader's role (to filter valid agents)
 * @param currentAgentId - The currently assigned agent ID (to exclude from list)
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to close the modal
 * @param onSuccess - Callback after successful reassignment
 */
interface TaskReassignModalProps {
  taskId: string;
  taskName: string;
  leaderRole: string;
  currentAgentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AgentOption {
  id: string;
  name: string;
  role: string;
}

/**
 * Modal for Team Leaders to reassign a task to a different agent within their team.
 * Fetches available agents based on the Team Leader's distribution targets.
 */
export default function TaskReassignModal({
  taskId,
  taskName,
  leaderRole,
  currentAgentId,
  isOpen,
  onClose,
  onSuccess,
}: TaskReassignModalProps) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    loadAgents();
  }, [isOpen, leaderRole]);

  /**
   * Fetches available agents for the Team Leader's team from the users API.
   */
  async function loadAgents() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/users");
      if (!response.ok) throw new Error("Failed to load team members");
      const data = await response.json();

      const roleMap: Record<string, string[]> = {
        team_leader_social_media: ["agent_social_media"],
        team_leader_media_buyer: ["agent_media_buyer"],
        team_leader_seo: ["agent_seo", "agent_content_seo"],
        leader_graphic_designer: ["agent_graphic_designer"],
        leader_motion_graphic: ["agent_motion_graphic"],
        leader_ui: ["agent_ui"],
      };

      const allowedRoles = roleMap[leaderRole] || [];
      const filtered = (data.users || data || [])
        .filter(
          (user: AgentOption) =>
            allowedRoles.includes(user.role) && user.id !== currentAgentId
        );

      setAgents(filtered);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load agents"
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  /**
   * Submits the reassignment request.
   */
  async function handleSubmit() {
    if (!selectedAgentId) {
      setErrorMessage("Please select an agent.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/tasks/${taskId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAgentId: selectedAgentId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reassign task");
      }

      setSelectedAgentId("");
      onSuccess();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setSelectedAgentId("");
    setErrorMessage("");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Reassign Task</h3>
          <p className="text-sm text-gray-500 mt-1">
            Reassign <span className="font-medium">&quot;{taskName}&quot;</span>{" "}
            to a different agent on your team.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-4 text-gray-500">
              Loading team members...
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No available agents found for your team.
            </div>
          ) : (
            <div>
              <label
                htmlFor="reassign-agent"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Select Agent <span className="text-red-500">*</span>
              </label>
              <select
                id="reassign-agent"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="">Choose an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedAgentId || agents.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Reassigning..." : "Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}
