import {
  createHrNotification,
  createLeaveRequest,
  findAllLeaveRequests,
  findFirstHrManager,
  findLeaveRequestsForUser,
  updateLeaveRequestDecision,
} from "@/server/repositories/hrRepository";

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
