import bcrypt from "bcryptjs";
import { getDistributionTargets } from "@/lib/distribution";
import {
  countUserBusinessReferences,
  createUserWithHrRecord,
  findCompanyById,
  findLeastLoadedManagers,
  findUserAuthorityFields,
  findUserByEmailOrPhone,
  findUserById,
  findUserRoleById,
  findUsersForDirectory,
  hardDeleteUserCascade,
  softDeleteUser,
  updateUserDetails,
  updateUserPresenceStatus,
  updateUserSpecialization,
  upsertAgentTarget,
} from "@/server/repositories/userRepository";

type Actor = { id: string; role?: string | null };

const USER_ADMIN_ROLES = ["super_admin", "hr_manager"];
const PRESENCE_STATUSES = ["Active", "Busy", "In_Call"];
const SPECIALIZATIONS = ["Hot", "Cold", "Warm", null];
const SPECIALIZATION_MANAGER_ROLES = ["super_admin", "tele_sales_manager", "sales_manager", "chief_sales"];

/**
 * The directory each role may see: admins see everyone, Head AM sees account
 * managers, heads/leaders see whoever they can distribute work to.
 */
export async function listUsersDirectory(actor: Actor) {
  const distributableRoles = getDistributionTargets(actor.role || "");
  const canViewAllUsers = USER_ADMIN_ROLES.includes(actor.role || "");
  const canViewAccountManagers = actor.role === "head_account_manager";
  const canViewTeamLeaders = actor.role === "head_technical" || actor.role === "head_seo";

  const where: any = {};
  if (canViewAllUsers) {
    // no role filter
  } else if (canViewAccountManagers) {
    where.role = { in: ["account_manager"] };
  } else if (canViewTeamLeaders || distributableRoles.length > 0) {
    where.role = { in: distributableRoles };
  } else {
    return { status: "forbidden" as const };
  }

  const users = await findUsersForDirectory(where);
  return { status: "ok" as const, users };
}

export async function createUserAccount(input: { actor: Actor; body: any }) {
  const { actor, body: data } = input;

  if (!data.name || !data.email || !data.password || !data.role) {
    return { status: "missing_fields" as const };
  }

  if (actor.role === "hr_manager" && data.role === "super_admin") {
    return { status: "super_admin_create_forbidden" as const };
  }

  const existing = await findUserByEmailOrPhone(data.email, data.phone);
  if (existing) {
    const conflict = existing.email === data.email ? "email" : "phone";
    return { status: "conflict" as const, conflict };
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  let assignedManagerId: string | null = data.directManagerId || null;

  // Smart Manager Assignment (Load Balancing) — only when no manager was set explicitly
  if (!assignedManagerId && data.role === "tele_sales_agent") {
    const managers = await findLeastLoadedManagers("tele_sales_manager");
    if (managers.length > 0) assignedManagerId = managers[0].id;
  } else if (!assignedManagerId && data.role === "sales_agent") {
    const managers = await findLeastLoadedManagers("sales_manager");
    if (managers.length > 0) assignedManagerId = managers[0].id;
  }

  // Resolve the company relation (and denormalize its name for HR display).
  const companyId: string | null = data.companyId || null;
  let companyName: string | null = data.company || null;
  if (companyId) {
    const company = await findCompanyById(companyId);
    if (!company) return { status: "company_not_found" as const };
    companyName = company.name;
  }

  const level = data.level || "Junior";
  const user = await createUserWithHrRecord({
    userData: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      passwordHash: hashedPassword,
      role: data.role,
      level,
      status: data.status || "Active",
      company: companyName,
      companyId,
      directManagerId: assignedManagerId,
    },
    level,
    baseSalary: Number(data.baseSalary) || 0,
    monthlyTarget: Number(data.monthlyTarget) || 0,
  });

  return { status: "ok" as const, user };
}

export async function updateUserAccount(input: { actor: Actor; id: string; body: any }) {
  const { actor, id, body } = input;

  const targetUser = await findUserRoleById(id);
  if (!targetUser) return { status: "not_found" as const };

  if (actor.role === "hr_manager") {
    if (targetUser.role === "super_admin" || body.role === "super_admin") {
      return { status: "super_admin_edit_forbidden" as const };
    }
  }

  const updateData: any = {};
  if (body.directManagerId !== undefined) {
    updateData.directManagerId = body.directManagerId === "" ? null : body.directManagerId;
  }
  if (body.status) updateData.status = body.status;
  if (body.level) updateData.level = body.level;
  if (body.role) updateData.role = body.role;
  if (body.name) updateData.name = body.name;
  if (body.email) updateData.email = body.email;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.password && body.password.trim() !== "") {
    updateData.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if (body.company !== undefined) updateData.company = body.company;
  if (body.companyId !== undefined) {
    if (body.companyId === null || body.companyId === "") {
      updateData.companyId = null;
      updateData.company = null;
    } else {
      const company = await findCompanyById(body.companyId);
      if (!company) return { status: "company_not_found" as const };
      updateData.companyId = body.companyId;
      updateData.company = company.name;
    }
  }

  const user = await updateUserDetails(id, updateData);
  return { status: "ok" as const, user };
}

export async function deleteUserAccount(input: { actor: Actor; id: string }) {
  const { actor, id } = input;

  if (id === actor.id) return { status: "self_delete" as const };

  const target = await findUserById(id);
  if (!target) return { status: "not_found" as const };

  // Check for hard business references that must be preserved (deals, meetings, callLogs etc.).
  // If any exist we soft-delete (deactivate + free up email/phone) instead of throwing FK errors.
  const [dealCount, meetingCount, callLogCount, projectCount, warningCount, noteCount] =
    await countUserBusinessReferences(id);

  const hasBusinessHistory =
    dealCount + meetingCount + callLogCount + projectCount + warningCount + noteCount > 0;

  if (hasBusinessHistory) {
    // Soft delete: deactivate and free unique email/phone so they can be reused.
    // Don't re-prefix an already soft-deleted record (avoids deleted_..._deleted_... chains).
    const stamp = Date.now();
    const alreadyDeleted = target.email.startsWith("deleted_");
    await softDeleteUser(id, {
      email: alreadyDeleted ? target.email : `deleted_${stamp}_${target.email}`.slice(0, 190),
      phone:
        target.phone && !target.phone.startsWith("deleted_")
          ? `deleted_${stamp}_${target.phone}`.slice(0, 190)
          : target.phone,
    });
    return { status: "soft_deleted" as const };
  }

  // No business history — safe to hard delete. Clean up dependent records first.
  await hardDeleteUserCascade(id);
  return { status: "ok" as const };
}

export async function changeUserPresenceStatus(input: { actor: Actor; id: string; status: any }) {
  const { actor, id, status } = input;

  if (!PRESENCE_STATUSES.includes(status)) return { status: "invalid_status" as const };

  const targetUser = await findUserAuthorityFields(id);
  if (!targetUser) return { status: "not_found" as const };

  const isSelf = actor.id === id;
  const isSuper = actor.role === "super_admin";
  const isDirectSalesManager =
    actor.role === "sales_manager" &&
    targetUser.role === "sales_agent" &&
    targetUser.directManagerId === actor.id;
  const isDirectTeleSalesManager =
    actor.role === "tele_sales_manager" &&
    targetUser.role === "tele_sales_agent" &&
    targetUser.directManagerId === actor.id;

  if (!isSelf && !isSuper && !isDirectSalesManager && !isDirectTeleSalesManager) {
    return { status: "forbidden" as const };
  }

  const user = await updateUserPresenceStatus(id, status);
  return { status: "ok" as const, user };
}

export async function changeUserSpecialization(input: { actor: Actor; id: string; specialization: any }) {
  const { actor, id, specialization } = input;

  if (!SPECIALIZATION_MANAGER_ROLES.includes(actor.role || "")) {
    return { status: "unauthorized" as const };
  }

  if (!SPECIALIZATIONS.includes(specialization)) return { status: "invalid_specialization" as const };

  const targetUser = await findUserAuthorityFields(id);
  if (!targetUser) return { status: "not_found" as const };

  const canUpdate =
    actor.role === "super_admin" ||
    actor.role === "chief_sales" ||
    (actor.role === "tele_sales_manager" &&
      targetUser.role === "tele_sales_agent" &&
      targetUser.directManagerId === actor.id) ||
    (actor.role === "sales_manager" &&
      targetUser.role === "sales_agent" &&
      targetUser.directManagerId === actor.id);

  if (!canUpdate) return { status: "forbidden" as const };

  const user = await updateUserSpecialization(id, specialization);
  return { status: "ok" as const, user };
}

export async function setAgentMonthlyTarget(input: {
  actor: Actor;
  id: string;
  target: any;
  month?: string | null;
}) {
  const { actor, id, target, month } = input;

  if (typeof target !== "number") return { status: "invalid_target" as const };

  const targetUser = await findUserAuthorityFields(id);
  if (!targetUser) return { status: "not_found" as const };

  if (
    actor.role === "tele_sales_manager" &&
    (targetUser.role !== "tele_sales_agent" || targetUser.directManagerId !== actor.id)
  ) {
    return { status: "forbidden" as const };
  }

  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const updatedTarget = await upsertAgentTarget({ agentId: id, month: targetMonth, target });
  return { status: "ok" as const, target: updatedTarget };
}
