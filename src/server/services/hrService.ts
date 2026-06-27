import {
  createHrNotification,
  createEmployeeDocument,
  createLeaveRequest,
  deleteEmployeeDocument,
  findEmployeeDocuments,
  findAllLeaveRequests,
  findFirstHrManager,
  findJobApplicants,
  findLeaveRequestsForUser,
  createJobApplicant,
  updateLeaveRequestDecision,
  updateJobApplicant,
} from "@/server/repositories/hrRepository";
import { normalizeWebUrl } from "@/lib/safe-url";

const HR_ROLES = ["super_admin", "hr_manager"];

export async function submitLeaveRequest(input: {
  userId: string;
  userName?: string | null;
  body: any;
}) {
  const { type, date, duration, reason } = input.body;
  const request = await createLeaveRequest({
    userId: input.userId,
    type,
    date: new Date(date),
    duration,
    reason,
  });

  const hr = await findFirstHrManager();
  if (hr) {
    await createHrNotification({
      userId: hr.id,
      title: `New ${type} Request`,
      message: `${input.userName} has requested a ${type} for ${date}`,
      link: `/dashboard/hr/requests`,
    });
  }

  return request;
}

export function listLeaveRequests(input: { userId: string; userRole?: string | null }) {
  if (input.userRole === "hr_manager" || input.userRole === "super_admin") {
    return findAllLeaveRequests();
  }

  return findLeaveRequestsForUser(input.userId);
}

export async function decideLeaveRequest(input: {
  id: string;
  status: string;
  feedbackNotes?: string | null;
}) {
  const leaveRequest = await updateLeaveRequestDecision(input);

  await createHrNotification({
    userId: leaveRequest.userId,
    title: `Request ${input.status}`,
    message: `Your ${leaveRequest.type} request for ${leaveRequest.date.toLocaleDateString()} has been ${input.status}.`,
    link: `/dashboard/profile`,
  });

  return leaveRequest;
}

export async function listEmployeeDocuments(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  userIdParam?: string | null;
}) {
  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  const targetUserId = input.userIdParam || input.sessionUserId;
  if (!isHr && targetUserId !== input.sessionUserId) {
    return { status: "forbidden" as const };
  }

  const documents = await findEmployeeDocuments(targetUserId);
  return { status: "ok" as const, documents };
}

export async function uploadEmployeeDocument(input: {
  sessionUserId: string;
  sessionUserRole?: string | null;
  body: any;
}) {
  const { userId, name, fileUrl } = input.body || {};
  const safeFileUrl = normalizeWebUrl(fileUrl);
  const safeName = typeof name === "string" ? name.trim().slice(0, 120) : "";
  if (!safeName || !safeFileUrl) {
    return { status: "missing_fields" as const };
  }

  const isHr = HR_ROLES.includes(input.sessionUserRole || "");
  const targetUserId = userId || input.sessionUserId;
  if (!isHr && targetUserId !== input.sessionUserId) {
    return { status: "upload_forbidden" as const };
  }

  const document = await createEmployeeDocument({
    userId: targetUserId,
    name: safeName,
    fileUrl: safeFileUrl,
  });

  return { status: "ok" as const, document };
}

export async function removeEmployeeDocument(id: string) {
  await deleteEmployeeDocument(id);
  return { success: true };
}

export function listJobApplicants() {
  return findJobApplicants();
}

export function addJobApplicant(body: any) {
  return createJobApplicant({
    name: body.name,
    email: body.email,
    phone: body.phone,
    roleApplied: body.roleApplied,
    notes: body.notes || null,
  });
}

export function editJobApplicant(id: string, body: any) {
  const updateData: any = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;

  return updateJobApplicant(id, updateData);
}
