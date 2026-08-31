import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listDevices, listEnrollableUsers, getScreenshotInterval } from "@/server/services/deviceMonitoringService";
import MonitoringClient from "./MonitoringClient";

/**
 * Device Monitoring — super admin only. Enrol employee devices, set the capture
 * interval, and review screenshots. Monitoring is disclosed to employees (the
 * agent shows a visible tray icon and asks for consent at install).
 */
export default async function MonitoringPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "super_admin") redirect("/dashboard");

  const [devicesResult, usersResult, interval] = await Promise.all([
    listDevices(role),
    listEnrollableUsers(role),
    getScreenshotInterval(),
  ]);

  const devices = devicesResult.status === "ok" ? devicesResult.devices : [];
  const users = usersResult.status === "ok" ? usersResult.users : [];

  return <MonitoringClient devices={devices} users={users} interval={interval} />;
}
