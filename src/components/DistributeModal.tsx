"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { distributeProject } from "@/client/api/projects";

interface User {
  id: string;
  name: string;
  role: string;
  managedProjects?: { id: string }[];
}

interface DistributeModalProps {
  /** Is the modal open? */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Project ID to distribute */
  projectId: string;
  /** Client/project name for display */
  projectName: string;
  /** List of users the distributor can assign to */
  availableUsers: User[];
  /** Label for the action (e.g., "Assign Account Manager") */
  actionLabel: string;
  /** Callback after successful distribution */
  onDistributed: () => void;
}

/**
 * Modal for distributing (assigning) a project to a user.
 * Shows a list of available users with their current workload count.
 */
export default function DistributeModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  availableUsers,
  actionLabel,
  onDistributed,
}: DistributeModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  /**
   * Handles the form submission for distributing a project.
   */
  async function handleSubmit() {
    if (!selectedUserId) {
      setError("Please select a user");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await distributeProject({ projectId, targetUserId: selectedUserId });

      onDistributed();
      onClose();
      setSelectedUserId("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{actionLabel}</h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {availableUsers.map((u) => {
              const workload = u.managedProjects?.length ?? 0;
              return (
                <label
                  key={u.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedUserId === u.id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="targetUser"
                      value={u.id}
                      checked={selectedUserId === u.id}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{u.role.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {workload} projects
                  </span>
                </label>
              );
            })}

            {availableUsers.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No available users to assign.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedUserId}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
