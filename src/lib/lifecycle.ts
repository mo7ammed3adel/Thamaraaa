import {
  LIFECYCLE_STATE,
  LIFECYCLE_TRANSITIONS,
  LIFECYCLE_CHANGE_ROLES,
  WORK_BLOCKING_LIFECYCLE_STATES,
  getLifecycleLabelAr,
} from "./constants";

/**
 * Validates whether a lifecycle state transition is allowed.
 * @param currentState The current lifecycle state of the project
 * @param newState The desired new lifecycle state
 * @returns Object with valid flag and optional error message
 */
export function validateLifecycleTransition(
  currentState: string,
  newState: string
): { valid: boolean; error?: string } {
  const validStates = Object.values(LIFECYCLE_STATE) as string[];

  if (!validStates.includes(currentState)) {
    return { valid: false, error: `Invalid current state: "${currentState}"` };
  }

  if (!validStates.includes(newState)) {
    return { valid: false, error: `Invalid target state: "${newState}"` };
  }

  if (currentState === newState) {
    return { valid: false, error: `Project is already in "${newState}" state` };
  }

  const allowed = LIFECYCLE_TRANSITIONS[currentState as keyof typeof LIFECYCLE_TRANSITIONS];
  if (!allowed || !allowed.includes(newState)) {
    return {
      valid: false,
      error: `Transition from "${currentState}" to "${newState}" is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Checks whether a user is authorized to change a project's lifecycle state.
 * - head_account_manager and super_admin can always change state
 * - account_manager can only change state if they are the assigned Account Manager
 * @param userRole The role of the user attempting the change
 * @param userId The ID of the user attempting the change
 * @param projectAccountManagerId The ID of the project's assigned account manager
 * @returns true if the user is allowed to change lifecycle state
 */
export function canChangeLifecycle(
  userRole: string,
  userId: string,
  projectAccountManagerId: string | null
): boolean {
  if (!(LIFECYCLE_CHANGE_ROLES as readonly string[]).includes(userRole)) {
    return false;
  }

  if (userRole === "head_account_manager" || userRole === "super_admin") {
    return true;
  }

  // account_manager can only change their OWN assigned project
  if (userRole === "account_manager") {
    return userId === projectAccountManagerId;
  }

  return false;
}

/**
 * Whether a project's lifecycle state pauses delivery work on it.
 * Hold and Lost clients accept no new tasks and no forward task progress;
 * Active and Renewer clients work normally. An unset state is treated as Active
 * so legacy rows are never blocked.
 * @param lifecycleState The project's current lifecycle state
 * @returns true when work on the project must be blocked
 */
export function isWorkBlockedByLifecycle(lifecycleState: string | null | undefined): boolean {
  if (!lifecycleState) return false;
  return (WORK_BLOCKING_LIFECYCLE_STATES as readonly string[]).includes(lifecycleState);
}

/**
 * The single message every blocked endpoint returns, naming the state with the
 * same Arabic label the user sees on the client's badge.
 */
export function lifecycleBlockedMessage(lifecycleState: string | null | undefined): string {
  return `Client status is "${getLifecycleLabelAr(lifecycleState)}" — work on this client is paused. The Account Manager must set the client back to Active or Renewer first.`;
}
