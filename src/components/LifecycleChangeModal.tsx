"use client";

import { useState } from "react";
import { X, ArrowRight, AlertCircle } from "lucide-react";
import { LIFECYCLE_TRANSITIONS, LIFECYCLE_STATE } from "@/lib/constants";
import LifecycleStateBadge from "./LifecycleStateBadge";

interface LifecycleChangeModalProps {
  /** Is the modal open? */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Project ID */
  projectId: string;
  /** Current lifecycle state */
  currentState: string;
  /** Project/Client name for display */
  projectName: string;
  /** Callback after successful change */
  onChanged: () => void;
}

/**
 * Modal for changing a project's lifecycle state.
 * Only shows the valid transitions based on the current state.
 */
export default function LifecycleChangeModal({
  isOpen,
  onClose,
  projectId,
  currentState,
  projectName,
  onChanged,
}: LifecycleChangeModalProps) {
  const [selectedState, setSelectedState] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const allowedTransitions = LIFECYCLE_TRANSITIONS[currentState] || [];

  /**
   * Handles lifecycle state change submission.
   */
  async function handleSubmit() {
    if (!selectedState) {
      setError("Please select a new state");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/projects/lifecycle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, newState: selectedState }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to change lifecycle state");
        return;
      }

      onChanged();
      onClose();
      setSelectedState("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Labels and descriptions for each state for better UX */
  const stateDescriptions: Record<string, string> = {
    [LIFECYCLE_STATE.ACTIVE]: "Client setup is complete, active operations begin",
    [LIFECYCLE_STATE.ON_HOLD]: "Temporarily pause operations for this client",
    [LIFECYCLE_STATE.COMPLETED]: "All deliverables completed successfully",
    [LIFECYCLE_STATE.CHURNED]: "Client has left or contract terminated",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-900">Change Lifecycle State</h3>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{projectName}</p>
        </div>

        {/* Current state indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Current:</span>
            <LifecycleStateBadge state={currentState} />
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {error && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {allowedTransitions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No transitions available from &ldquo;{currentState}&rdquo; state.
            </p>
          ) : (
            <div className="space-y-2">
              {allowedTransitions.map((state) => (
                <label
                  key={state}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedState === state
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="newState"
                    value={state}
                    checked={selectedState === state}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                      <LifecycleStateBadge state={state} />
                    </div>
                    {stateDescriptions[state] && (
                      <p className="text-xs text-gray-500 mt-1 ml-6">{stateDescriptions[state]}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
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
            disabled={isSubmitting || !selectedState || allowedTransitions.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Updating..." : "Confirm Change"}
          </button>
        </div>
      </div>
    </div>
  );
}
