import { prisma } from "@/lib/prisma";

// ── Niches ──

export function findAllNiches() {
  return prisma.niche.findMany({ orderBy: { name: "asc" } });
}

export function upsertNicheByName(name: string) {
  return prisma.niche.upsert({
    where: { name },
    update: {}, // if it exists, do nothing
    create: { name },
  });
}

// ── Packages ──

export function findAllPackages() {
  return prisma.package.findMany({ orderBy: { createdAt: "desc" } });
}

export function createPackageRecord(input: { name: string; servicesJson: string }) {
  return prisma.package.create({ data: input });
}

// ── Custom columns ──

/** Pass an agent id to limit values to that agent's leads; null returns all values. */
export function findCustomColumnsWithValues(scopeToAgentId: string | null) {
  return prisma.customColumn.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      values: scopeToAgentId
        ? { where: { lead: { assignedTeleAgentId: scopeToAgentId } } }
        : true,
    },
  });
}

export function createCustomColumn(input: { name: string; createdBy: string }) {
  return prisma.customColumn.create({ data: input, include: { values: true } });
}

export function deleteCustomColumn(id: string) {
  return prisma.customColumn.delete({ where: { id } });
}

export function upsertCustomColumnValue(input: { columnId: string; leadId: string; value: string }) {
  return prisma.customColumnValue.upsert({
    where: { columnId_leadId: { columnId: input.columnId, leadId: input.leadId } },
    update: { value: input.value },
    create: input,
  });
}

// ── Companies ──

export function findAllCompaniesWithCounts() {
  return prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, leads: true } } },
  });
}

export function findCompanyByExactName(name: string) {
  return prisma.company.findUnique({ where: { name } });
}

export function findCompanyNameConflict(name: string, excludeId: string) {
  return prisma.company.findFirst({ where: { name, NOT: { id: excludeId } } });
}

export function createCompany(name: string) {
  return prisma.company.create({ data: { name } });
}

export function updateCompanyName(id: string, name: string) {
  return prisma.company.update({ where: { id }, data: { name } });
}

export function countCompanyLinks(id: string) {
  return Promise.all([
    prisma.user.count({ where: { companyId: id } }),
    prisma.lead.count({ where: { companyId: id } }),
  ]);
}

export function deleteCompany(id: string) {
  return prisma.company.delete({ where: { id } });
}
