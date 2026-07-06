import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { getAgentTargetHistory } from "./targetService";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentTarget: {
      findMany: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
    },
    meeting: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  agentTarget: { findMany: Mock };
  deal: { findMany: Mock };
  meeting: { findMany: Mock };
  user: { findMany: Mock };
};

describe("getAgentTargetHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPrisma.agentTarget.findMany.mockResolvedValue([]);
    mockedPrisma.deal.findMany.mockResolvedValue([]);
    mockedPrisma.meeting.findMany.mockResolvedValue([]);
    mockedPrisma.user.findMany.mockResolvedValue([]);
  });

  it("counts sales manager personal fund in the chief sales target history", async () => {
    mockedPrisma.agentTarget.findMany.mockResolvedValue([
      { month: "2026-07", target: 100000 },
    ] as any);
    mockedPrisma.user.findMany.mockImplementation(async (args: any) => {
      const role = args?.where?.role;
      const roles = typeof role === "object" && Array.isArray(role.in) ? role.in : [role];
      const users = [
        { id: "sales-agent-1", role: "sales_agent" },
        { id: "sales-manager-1", role: "sales_manager" },
      ];
      return users.filter((user) => roles.includes(user.role)).map(({ id }) => ({ id })) as any;
    });
    mockedPrisma.deal.findMany.mockImplementation(async (args: any) => {
      const ids = args?.where?.salesAgentId?.in || [];
      return [
        { salesAgentId: "sales-agent-1", createdAt: new Date("2026-07-05T10:00:00Z"), totalAmount: 60000 },
        { salesAgentId: "sales-manager-1", createdAt: new Date("2026-07-06T10:00:00Z"), totalAmount: 40000 },
      ].filter((deal) => ids.includes(deal.salesAgentId)) as any;
    });

    const result = await getAgentTargetHistory({ id: "chief-1", role: "chief_sales" });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.months).toEqual([{ month: "2026-07", target: 100000, achieved: 100000 }]);
  });
});
