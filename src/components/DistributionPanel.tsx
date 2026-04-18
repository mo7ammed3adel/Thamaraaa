"use client";

import { useState } from "react";

/**
 * Props for the DistributionPanel component.
 * @param title - Header text displayed above the user list
 * @param users - Array of available team members to assign
 * @param isLoading - Whether an assignment operation is in progress
 * @param onAssign - Callback fired with the selected user's ID
 */
interface DistributionPanelProps {
  title: string;
  users: Array<{
    id: string;
    name: string;
    role: string;
    taskCount: number;
    clientCount: number;
  }>;
  isLoading: boolean;
  onAssign: (targetId: string) => void;
}

/**
 * A selection panel used by Team Leaders to pick an agent for assignment.
 * Displays each team member as a card with their current workload.
 */
export default function DistributionPanel({ title, users, isLoading, onAssign }: DistributionPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (users.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm italic">
        No team members available for assignment.
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-3">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            disabled={isLoading}
            onClick={() => {
              setSelectedId(user.id);
              onAssign(user.id);
            }}
            className={`p-3 rounded-lg border-2 text-left transition-all ${
              selectedId === user.id && isLoading
                ? "border-indigo-500 bg-indigo-50 opacity-70"
                : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"
            }`}
          >
            <p className="font-bold text-sm text-slate-900">{user.name}</p>
            <p className="text-[10px] text-slate-500 uppercase mt-0.5">
              {user.role.replace(/_/g, " ")}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-semibold text-slate-500">
                {user.clientCount} client{user.clientCount !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {user.taskCount} task{user.taskCount !== 1 ? "s" : ""}
              </span>
            </div>
            {selectedId === user.id && isLoading && (
              <p className="text-[10px] text-indigo-600 font-bold mt-1 animate-pulse">Assigning...</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
