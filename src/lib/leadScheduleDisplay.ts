type LeadMeeting = {
  meetingDate?: string | Date | null;
  meetingTime?: string | null;
};

type LeadSchedule = LeadMeeting & {
  followUpDate?: string | Date | null;
  meetings?: LeadMeeting[] | null;
};

export type ScheduleDisplay = {
  hasDate: boolean;
  dateLabel: string;
  timeLabel: string;
  fullLabel: string;
};

export function formatDisplayDate(value?: string | Date | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB");
}

export function getLeadMeetingDisplay(lead: LeadSchedule): ScheduleDisplay {
  const latestMeeting = lead.meetings?.[0];
  const dateLabel = formatDisplayDate(latestMeeting?.meetingDate ?? lead.meetingDate);
  const timeLabel = latestMeeting?.meetingTime ?? lead.meetingTime ?? "";
  const fullLabel = [dateLabel, timeLabel].filter(Boolean).join(" ");

  return {
    hasDate: Boolean(dateLabel),
    dateLabel,
    timeLabel,
    fullLabel,
  };
}

export function getLeadFollowUpDisplay(lead: LeadSchedule): ScheduleDisplay {
  const dateLabel = formatDisplayDate(lead.followUpDate);

  return {
    hasDate: Boolean(dateLabel),
    dateLabel,
    timeLabel: "",
    fullLabel: dateLabel,
  };
}
