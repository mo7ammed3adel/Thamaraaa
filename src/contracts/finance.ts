export type MoneyAmount = number;

export type PaymentMethod = "Cash" | "Transfer" | "Tabby" | "Tamara" | string;

export type FinanceLineItem = {
  reason: string;
  amount: MoneyAmount;
  auto?: boolean;
};

export type CommissionTierDto = {
  minNet: number;
  maxNet: number | null;
  pct: number;
};

export type CommissionDto = {
  id: string;
  userId: string;
  month: string;
  netTarget: MoneyAmount;
  commissionPct: number;
  commissionAmount: MoneyAmount;
  bonuses: FinanceLineItem[];
  deductions: FinanceLineItem[];
  netPayout: MoneyAmount;
  finalized: boolean;
};

export type InstallmentDto = {
  id: string;
  dealId: string;
  amount: MoneyAmount;
  dueDate: string;
  isPaid: boolean;
  createdAt: string;
};
