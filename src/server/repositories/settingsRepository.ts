import { prisma } from "@/lib/prisma";

export function upsertSystemConfig(input: { key: string; value: string; updatedById: string }) {
  return prisma.systemConfig.upsert({
    where: { key: input.key },
    update: { value: input.value, updatedById: input.updatedById },
    create: input,
  });
}

export function upsertCommissionRule(input: { role: string; percentage: number }) {
  return prisma.commissionRule.upsert({
    where: { role: input.role },
    update: { percentage: input.percentage },
    create: input,
  });
}
