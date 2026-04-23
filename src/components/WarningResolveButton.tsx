"use client";

import { useState } from "react";

/**
 * Props for the WarningResolveButton component.
 * @param warningId - The ID of the warning to resolve
 * @param senderUserId - The user ID of the warning creator
 * @param currentUserId - The current logged-in user's ID
 * @param currentStatus - The warning's current status (Active, Resolved, Archived)
 * @param onSuccess - Callback after successful resolution
 */
interface WarningResolveButtonProps {
  warningId: string;
  senderUserId: string;
  currentUserId: string;
  currentStatus: string;
  onSuccess?: () => void;
}

/**
 * Button that allows the warning creator to mark a warning as Resolved.
 * Only visible when the current user is the sender and the warning is Active.
 * Shows a confirmation prompt before resolving.
 */
export default function WarningResolveButton({
  warningId,
  senderUserId,
  currentUserId,
  currentStatus,
  onSuccess,
}: WarningResolveButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolved, setIsResolved] = useState(currentStatus === "Resolved");
  const [errorMessage, setErrorMessage] = useState("");

  const isCreator = currentUserId === senderUserId;
  const canResolve = isCreator && currentStatus === "Active" && !isResolved;

  if (isResolved || currentStatus === "Resolved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        Resolved
      </span>
    );
  }

  if (!canResolve) return null;

  /**
   * Sends the resolve request after user confirmation.
   */
  async function handleResolve() {
    const confirmed = window.confirm(
      "Are you sure you want to mark this warning as resolved? This indicates the underlying issue has been addressed."
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/warnings/${warningId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resolve warning");
      }

      setIsResolved(true);
      onSuccess?.();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleResolve}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        {isSubmitting ? (
          "Resolving..."
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mark as Resolved
          </>
        )}
      </button>
      {errorMessage && (
        <span className="text-xs text-red-600 mt-1">{errorMessage}</span>
      )}
    </div>
  );
}
