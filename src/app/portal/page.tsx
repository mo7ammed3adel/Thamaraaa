import { redirect } from "next/navigation";
import { readClientSession } from "@/server/auth/clientSession";
import { getClientPortalData } from "@/server/services/clientPortalService";
import ClientPortalView from "./ClientPortalView";

/**
 * Client Portal home — the customer's own view of their project.
 *
 * The scope comes entirely from the signed session cookie: there is no project
 * id in the URL, so there is nothing for a client to tamper with.
 */
export default async function ClientPortalPage() {
  const session = readClientSession();
  if (!session) redirect("/portal/login");

  const result = await getClientPortalData(session);
  if (result.status !== "ok") redirect("/portal/login");
  if (result.data.mustChangePassword) redirect("/portal/change-password");

  return <ClientPortalView data={result.data} />;
}
