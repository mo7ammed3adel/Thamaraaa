"use client";

import { useState, useEffect } from "react";
import { listUsers } from "@/client/api/users";
import { reassignAccountManager } from "@/client/api/projects";
import { useTranslator } from "@/components/i18n/LocaleProvider";

/**
 * Props for the ClientReassignModal component.
 * @param projectId - The project ID of the client to reassign
 * @param clientName - Display name for the client
 * @param currentAccountManagerId - The currently assigned Account Manager's user ID
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to close the modal
 * @param onSuccess - Callback after successful reassignment
 */
interface ClientReassignModalProps {
  projectId: string;
  clientName: string;
  currentAccountManagerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AccountManagerOption {
  id: string;
  name: string;
  email: string;
  status?: string;
}

/**
 * Modal for the Head Account Manager to reassign a client (project) from one
 * Account Manager Agent to another. All history is preserved.
 */
export default function ClientReassignModal({
  projectId,
  clientName,
  currentAccountManagerId,
  isOpen,
  onClose,
  onSuccess,
}: ClientReassignModalProps) {
  const t = useTranslator();
  const [accountManagers, setAccountManagers] = useState<AccountManagerOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    loadAccountManagers();
  }, [isOpen]);

  /**
   * Fetches all users with the account_manager role, excluding the current AM.
   */
  async function loadAccountManagers() {
    setIsLoading(true);
    try {
      const data: any = await listUsers();

      const filtered = (data.users || data || []).filter(
        (user: AccountManagerOption & { role: string }) =>
          user.role === "account_manager" &&
          user.status === "Active" &&
          user.id !== currentAccountManagerId
      );

      setAccountManagers(filtered);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load account managers"
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  /**
   * Submits the client reassignment request.
   */
  async function handleSubmit() {
    if (!selectedManagerId) {
      setErrorMessage("Please select an Account Manager.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await reassignAccountManager(projectId, { newAccountManagerId: selectedManagerId });

      setSelectedManagerId("");
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
    setSelectedManagerId("");
    setErrorMessage("");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Reassign Account Manager
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Transfer <span className="font-medium">&quot;{clientName}&quot;</span>{" "}
            to a different Account Manager. All history will be preserved.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-4 text-gray-500">
              Loading account managers...
            </div>
          ) : accountManagers.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No other Account Managers available.
            </div>
          ) : (
            <div>
              <label
                htmlFor="reassign-am"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                New Account Manager <span className="text-red-500">*</span>
              </label>
              <select
                id="reassign-am"
                value={selectedManagerId}
                onChange={(e) => setSelectedManagerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              >
                <option value="">{t("modal.chooseAm")}</option>
                {accountManagers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} ({manager.email})
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
            disabled={isSubmitting || !selectedManagerId || accountManagers.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Reassigning..." : "Reassign Client"}
          </button>
        </div>
      </div>
    </div>
  );
}
