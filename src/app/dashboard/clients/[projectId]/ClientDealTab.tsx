"use client";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type Installment = {
  id: string;
  amount?: number | null;
  dueDate: string | Date;
  isPaid?: boolean | null;
};

type DealInfo = {
  package?: string | null;
  totalAmount?: number | null;
  firstAmount?: number | null;
  paymentMethod?: string | null;
  contractStart?: string | Date | null;
  contractEnd?: string | Date | null;
  salesAgent?: { name?: string | null } | null;
  installments?: Installment[];
};

type ClientDealTabProps = {
  deal?: DealInfo | null;
};

const formatDate = (date?: string | Date | null) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString();
};

export default function ClientDealTab({ deal }: ClientDealTabProps) {
  const t = useTranslator();
  const installments = deal?.installments || [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">{t("journey.dealInfo")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: "Package", value: deal?.package, cls: "bg-purple-50 text-purple-800" },
            { label: "Total Amount", value: `${deal?.totalAmount?.toLocaleString()} SAR`, cls: "bg-emerald-50 text-emerald-800" },
            { label: "First Payment", value: `${deal?.firstAmount?.toLocaleString() || 0} SAR`, cls: "bg-blue-50 text-blue-800" },
            {
              label: "Remaining",
              value: `${((deal?.totalAmount || 0) - (deal?.firstAmount || 0)).toLocaleString()} SAR`,
              cls: "bg-amber-50 text-amber-800",
            },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.cls} rounded-xl p-4 text-center border`}>
              <p className="text-xs font-medium opacity-70">{kpi.label}</p>
              <p className="text-xl font-bold mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[
            { label: "Payment Method", value: deal?.paymentMethod },
            { label: "Contract Start", value: formatDate(deal?.contractStart) },
            { label: "Contract End", value: formatDate(deal?.contractEnd) },
            { label: "Sales Agent", value: deal?.salesAgent?.name || "N/A" },
          ].map((item) => (
            <div key={item.label} className="border-b pb-2">
              <p className="text-xs text-slate-400 uppercase">{item.label}</p>
              <p className="text-sm font-semibold text-slate-700">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {installments.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-md font-bold text-slate-800 mb-3">Installments</h3>
          <div className="space-y-2">
            {installments.map((inst, index) => (
              <div
                key={inst.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  inst.isPaid ? "bg-emerald-50 border-emerald-200" : "bg-orange-50 border-orange-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      inst.isPaid ? "bg-emerald-500" : "bg-orange-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{inst.amount?.toLocaleString()} SAR</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">Due: {formatDate(inst.dueDate)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      inst.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {inst.isPaid ? "Paid" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
