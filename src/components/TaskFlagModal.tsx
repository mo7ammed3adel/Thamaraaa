"use client";

import { useState } from "react";
import { flagTask } from "@/client/api/tasks";
import { useTranslator } from "@/components/i18n/LocaleProvider";

/**
 * Props for the TaskFlagModal component.
 * @param taskId - The ID of the task to flag/return
 * @param taskName - Display name for the task
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to close the modal
 * @param onSuccess - Callback after successful flag submission
 */
interface TaskFlagModalProps {
  taskId: string;
  taskName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal for agents to flag/return a task to their Team Leader with a mandatory reason.
 * Submits POST /api/tasks/[id]/flag with the reason text.
 */
export default function TaskFlagModal({
  taskId,
  taskName,
  isOpen,
  onClose,
  onSuccess,
}: TaskFlagModalProps) {
  const t = useTranslator();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  /**
   * Handles the flag submission.
   * Validates reason is non-empty, sends POST request, resets state on success.
   */
  async function handleSubmit() {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMessage("Please provide a reason for flagging this task.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await flagTask(taskId, { reason: trimmedReason });

      setReason("");
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

  /**
   * Handles closing the modal and resetting state.
   */
  function handleClose() {
    setReason("");
    setErrorMessage("");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Flag / Return Task
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Return <span className="font-medium">&quot;{taskName}&quot;</span> to
            your Team Leader with a reason.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="flag-reason"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Reason for flagging <span className="text-red-500">*</span>
            </label>
            <textarea
              id="flag-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("task.flagReason")}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={4}
              disabled={isSubmitting}
            />
          </div>

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
            disabled={isSubmitting || !reason.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Flagging..." : "Flag Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
