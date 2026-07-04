import { findLeadTeleAgentOwner } from "@/server/repositories/leadRepository";
import {
  countCompanyLinks,
  createCompany,
  createCustomColumn,
  createPackageRecord,
  deleteCompany,
  deleteCustomColumn,
  findAllCompaniesWithCounts,
  findAllNiches,
  findAllPackages,
  findCompanyByExactName,
  findCompanyNameConflict,
  findCustomColumnsWithValues,
  updateCompanyName,
  upsertCustomColumnValue,
  upsertNicheByName,
} from "@/server/repositories/referenceDataRepository";

type Actor = { id: string; role?: string | null };

// ── Niches ──

export function listNiches() {
  return findAllNiches();
}

export async function addNiche(name: unknown) {
  if (!name || typeof name !== "string") return { status: "invalid_name" as const };

  // Standardize: trim and title case
  const standardizedName = name
    .trim()
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

  const niche = await upsertNicheByName(standardizedName);
  return { status: "ok" as const, niche };
}

// ── Packages ──

export function listPackages() {
  return findAllPackages();
}

export async function addPackage(body: any) {
  const { name, servicesJson } = body || {};
  if (!name || !servicesJson) return { status: "missing_fields" as const };

  const pkg = await createPackageRecord({ name, servicesJson });
  return { status: "ok" as const, pkg };
}

// ── Custom columns ──

/** Agents only see values belonging to their own leads; managers see everything. */
export function listCustomColumns(actor: Actor) {
  return findCustomColumnsWithValues(actor.role === "tele_sales_agent" ? actor.id : null);
}

export async function addCustomColumn(input: { actor: Actor; name: unknown }) {
  const name = typeof input.name === "string" ? input.name : "";
  if (!name || !name.trim()) return { status: "missing_name" as const };

  const column = await createCustomColumn({ name: name.trim(), createdBy: input.actor.id });
  return { status: "ok" as const, column };
}

export function removeCustomColumn(id: string) {
  return deleteCustomColumn(id);
}

export async function setCustomColumnValue(input: {
  actor: Actor;
  columnId: string;
  leadId: string;
  value: unknown;
}) {
  const { actor, columnId, leadId, value } = input;
  if (!columnId || !leadId) return { status: "missing_fields" as const };

  // An agent may only edit values on leads assigned to them.
  if (actor.role === "tele_sales_agent") {
    const lead = await findLeadTeleAgentOwner(leadId);
    if (!lead || lead.assignedTeleAgentId !== actor.id) {
      return { status: "lead_forbidden" as const };
    }
  }

  const result = await upsertCustomColumnValue({
    columnId,
    leadId,
    value: (value as string) || "",
  });
  return { status: "ok" as const, result };
}

// ── Companies ──

export function listCompanies() {
  return findAllCompaniesWithCounts();
}

export async function addCompany(name: string) {
  const existing = await findCompanyByExactName(name);
  if (existing) return { status: "duplicate_name" as const };

  const company = await createCompany(name);
  return { status: "ok" as const, company };
}

export async function renameCompany(input: { id: string; name: string }) {
  const conflict = await findCompanyNameConflict(input.name, input.id);
  if (conflict) return { status: "duplicate_name" as const };

  const company = await updateCompanyName(input.id, input.name);
  return { status: "ok" as const, company };
}

export async function removeCompany(id: string) {
  const [userCount, leadCount] = await countCompanyLinks(id);
  if (userCount > 0 || leadCount > 0) {
    return { status: "in_use" as const, userCount, leadCount };
  }
  await deleteCompany(id);
  return { status: "ok" as const };
}
