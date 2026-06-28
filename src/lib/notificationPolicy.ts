export function canReceiveNotification(status?: string | null): boolean {
  return Boolean(status) && status !== "Inactive";
}
