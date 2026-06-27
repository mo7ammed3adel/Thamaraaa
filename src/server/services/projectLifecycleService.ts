import { canChangeLifecycle, validateLifecycleTransition } from "@/lib/lifecycle";
import { safeTrigger } from "@/lib/pusher";
import {
  findProjectLifecycleAuth,
  updateProjectLifecycleWithLog,
} from "@/server/repositories/projectRepository";

export async function changeProjectLifecycle(input: {
  projectId: string;
  newState: string;
  userId: string;
  userRole: string;
  userName: string;
}) {
  const project = await findProjectLifecycleAuth(input.projectId);
  if (!project) return { status: "not_found" as const };

  if (!canChangeLifecycle(input.userRole, input.userId, project.accountManagerId)) {
    return { status: "forbidden" as const };
  }

  const validation = validateLifecycleTransition(project.lifecycleState, input.newState);
  if (!validation.valid) {
    return { status: "invalid_transition" as const, error: validation.error };
  }

  const [updatedProject] = await updateProjectLifecycleWithLog({
    projectId: input.projectId,
    fromState: project.lifecycleState,
    toState: input.newState,
    userId: input.userId,
    userName: input.userName,
    userRole: input.userRole,
  });

  await safeTrigger("projects-channel", "lifecycle-changed", {
    projectId: input.projectId,
    newState: input.newState,
    changedBy: input.userName,
  });

  return { status: "ok" as const, project: updatedProject };
}
