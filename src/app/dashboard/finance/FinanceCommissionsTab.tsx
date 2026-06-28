import { Fragment, useState, useEffect, useCallback } from "react";
import { notify } from "@/components/toast";
import { Calculator, Download, Plus, X, Trash2, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { formatSar } from "@/shared/formatters/currency";
import { HttpError } from "@/client/transport/http";
import { listCommissions, recomputeCommissions, updateCommission } from "@/client/api/finance";

export function CommissionsTab() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState<string>(defaultMonth);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [config, setConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCommissions(month)
      .then((d) => {
        const payload = d as any;
        setCommissions(payload.commissions || []);
        setConfig(payload.config || null);
      })
      .catch(() => setCommissions([]))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: when Super Admin changes a finance rule, the server recomputes
  // and broadcasts on `finance-channel` so this view updates without a manual reload.
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) return;
    let client: any = null;
    let channel: any = null;
    (async () => {
      try {
        const PusherModule = await import("pusher-js");
        const Pusher = PusherModule.default;
        client = new Pusher(key, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu" });
        channel = client.subscribe("finance-channel");
        channel.bind("config-updated", () => load());
      } catch (e) {
        console.error("Finance live-update subscription failed:", e);
      }
    })();
    return () => {
      if (channel) channel.unbind_all();
      if (client) client.unsubscribe("finance-channel");
    };
  }, [load]);

  const recompute = async () => {
    setBusy("recompute");
    try {
      await recomputeCommissions({ month });
      load();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Recompute failed");
    } finally {
      setBusy(null);
    }
  };

  const finalize = async (c: any) => {
    if (!confirm(`Finalize ${c.user.name}'s ${month} commission? This payout becomes immutable.`)) return;
    setBusy(c.id);
    await updateCommission(c.id, { finalized: true });
    setBusy(null);
    load();
  };

  const exportXlsx = () => {
    window.location.href = `/api/finance/commissions/export?month=${month}`;
  };

  const totalPayout = commissions.reduce((s, c) => s + c.netPayout, 0);
  const totalNet = commissions.reduce((s, c) => s + c.netTarget, 0);
  const totalGross = commissions.reduce((s, c) => s + (c.breakdown?.grossFund || 0), 0);
  const finalizedCount = commissions.filter((c) => c.finalized).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <Calculator className="w-5 h-5 text-slate-500" />
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white" />
        <button onClick={recompute} disabled={busy === "recompute"} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
          {busy === "recompute" ? "Recomputing…" : "Recompute Month"}
        </button>
        <button onClick={exportXlsx} className="ml-auto px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2">
          <Download className="w-4 h-4" /> Export XLSX
        </button>
      </div>

      {/* Formula reminder */}
      {config && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-700 leading-relaxed">
          <div className="font-bold text-slate-900 mb-2">Commission rules applied for accountant payroll</div>
          <code className="block bg-white p-2 rounded border">Gateway net base = gross deal value minus Tabby/Tamara fee ({(config.gatewayFeePct * 100).toFixed(2)}%)</code>
          <RuleChips title="Sales Agent" tiers={config.rules?.salesAgentTiers || []} />
          <RuleChips title="Sales Team Leader" tiers={config.rules?.salesTeamLeaderTiers || []} />
          <RuleChips title="TeleSales Cold Count" tiers={config.rules?.telesalesColdTiers || []} />
          <RuleChips title="TeleSales Manager" tiers={config.rules?.telesalesManagerRates || []} />
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Gross Fund</p>
          <p className="text-3xl font-black text-gray-900">{formatSar(totalGross, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Net Commission Base</p>
          <p className="text-3xl font-black text-emerald-700">{formatSar(totalNet, { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Total Payout</p>
          <p className="text-3xl font-black text-blue-700">{formatSar(totalPayout, { maximumFractionDigits: 2 })}</p>
          <p className="text-xs font-semibold text-blue-700 mt-1">Finalized {finalizedCount} / {commissions.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-right">Gross Fund</th>
              <th className="px-4 py-3 text-right">Net Base</th>
              <th className="px-4 py-3 text-left">Tier / Rate</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-right">Salary</th>
              <th className="px-4 py-3 text-right">Bonus / Deduct</th>
              <th className="px-4 py-3 text-right">Net Payout</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && (<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>)}
            {!loading && commissions.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 italic">No commissions for {month}. Click "Recompute Month".</td></tr>
            )}
            {!loading && commissions.map((c) => {
              const target = c.user.hrRecord?.monthlyTarget || 0;
              const bonusesSum = sumJson(c.bonuses);
              const deductionsSum = sumJson(c.deductions);
              const baseSalary = c.user.hrRecord?.baseSalary || 0;
              const breakdown = c.breakdown;
              const expanded = expandedId === c.id;
              return (
                <Fragment key={c.id}>
                  <tr className={`hover:bg-gray-50 ${c.finalized ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{c.user.name}</div>
                      <div className="text-xs text-gray-500">{formatRole(c.user.role)} - {breakdown?.planLabel || c.user.level || "—"}</div>
                      {target > 0 && <div className="text-[11px] text-gray-400 mt-0.5">Target: {formatSar(target)}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-gray-900">{formatSar(breakdown?.grossFund || 0, { maximumFractionDigits: 2 })}</div>
                      {(breakdown?.gatewayFees || 0) > 0 && (
                        <div className="text-xs text-amber-600">Fees: {formatSar(breakdown.gatewayFees, { maximumFractionDigits: 2 })}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatSar(c.netTarget, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{breakdown?.tierLabel || "—"}</div>
                      <div className="text-xs text-gray-500">{((breakdown?.tierPct || c.commissionPct || 0) * 100).toFixed(2)}%</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-gray-900">{formatSar(c.commissionAmount, { maximumFractionDigits: 2 })}</div>
                      <div className="text-xs text-gray-400">Effective {(c.commissionPct * 100).toFixed(2)}%</div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatSar(baseSalary, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      {bonusesSum > 0 && <div className="text-emerald-600">+{formatSar(bonusesSum, { maximumFractionDigits: 2 })}</div>}
                      {deductionsSum > 0 && <div className="text-red-600">-{formatSar(deductionsSum, { maximumFractionDigits: 2 })}</div>}
                      {bonusesSum === 0 && deductionsSum === 0 && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-black">{formatSar(c.netPayout, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                      <button onClick={() => setExpandedId(expanded ? null : c.id)} className="px-2 py-1 bg-white border hover:bg-gray-50 text-slate-800 rounded text-xs font-bold inline-flex items-center gap-1">
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Details
                      </button>
                      {c.finalized ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold"><Lock className="w-3 h-3" /> Finalized</span>
                      ) : (
                        <>
                          <button onClick={() => setEditing(c)} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-bold">Edit</button>
                          <button disabled={busy === c.id} onClick={() => finalize(c)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-50">Finalize</button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50">
                      <td colSpan={9} className="px-4 py-4">
                        <CommissionBreakdownPanel breakdown={breakdown} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && <BonusDeductionModal commission={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function RuleChips({ title, tiers }: { title: string; tiers: any[] }) {
  if (!tiers.length) return null;
  return (
    <div className="mt-2">
      <span className="font-bold text-slate-900 mr-2">{title}:</span>
      {tiers.map((tier, i) => (
        <span key={`${title}-${i}`} className="inline-block bg-white border rounded px-2 py-0.5 mr-1.5 mb-1">
          {tier.min.toLocaleString()}-{tier.max ? tier.max.toLocaleString() : "∞"}: {(tier.pct * 100).toFixed(2)}%
        </span>
      ))}
    </div>
  );
}

function CommissionBreakdownPanel({ breakdown }: { breakdown: any }) {
  if (!breakdown) {
    return <div className="text-sm text-gray-500">No detailed breakdown is available for this row yet.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="bg-white border rounded-xl p-4">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Components</h4>
        <div className="space-y-2">
          {(breakdown.components || []).map((component: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-600">{component.label}</span>
              <span className="font-bold text-gray-900 whitespace-nowrap">
                {formatSar(component.amount, { maximumFractionDigits: 2 })}
                {component.pct !== undefined && <span className="text-xs text-gray-400 ml-1">({(component.pct * 100).toFixed(2)}%)</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border rounded-xl p-4">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Metrics</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(breakdown.metrics || {}).map(([key, value]) => (
            <div key={key} className="border rounded-lg px-3 py-2">
              <div className="text-[11px] text-gray-500 uppercase">{formatMetricLabel(key)}</div>
              <div className="font-bold text-gray-900">{formatMetricValue(value)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border rounded-xl p-4">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Policy Notes</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          {(breakdown.notes || []).map((note: string, index: number) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function sumJson(json: string | null): number {
  if (!json) return 0;
  try {
    const items = JSON.parse(json);
    if (!Array.isArray(items)) return 0;
    return items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
  } catch {
    return 0;
  }
}

function formatRole(role: string | null | undefined) {
  return String(role || "unknown").replace(/_/g, " ");
}

function formatMetricLabel(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
}

function formatMetricValue(value: unknown) {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value ?? "—");
}

function BonusDeductionModal({ commission, onClose, onSaved }: { commission: any; onClose: () => void; onSaved: () => void }) {
  const [bonuses, setBonuses] = useState<{ reason: string; amount: number }[]>(safeParse(commission.bonuses));
  const [deductions, setDeductions] = useState<{ reason: string; amount: number }[]>(safeParse(commission.deductions));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateCommission(commission.id, { bonuses, deductions });
      onSaved();
      onClose();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Bonuses & Deductions — {commission.user.name}</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
        </div>

        <LineItemEditor title="Bonuses" colorClass="emerald" items={bonuses} setItems={setBonuses} />
        <LineItemEditor title="Deductions" colorClass="red" items={deductions} setItems={setDeductions} />

        <div className="pt-4 border-t flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LineItemEditor({ title, colorClass, items, setItems }: { title: string; colorClass: "emerald" | "red"; items: { reason: string; amount: number }[]; setItems: (v: any) => void }) {
  // Static class names so Tailwind's JIT doesn't purge them.
  const addBtnClass = colorClass === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  return (
    <div className="my-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-sm text-gray-700">{title}</h4>
        <button onClick={() => setItems([...items, { reason: "", amount: 0 }])} className={`px-2 py-1 ${addBtnClass} rounded text-xs font-bold flex items-center gap-1`}>
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-gray-400 italic">No {title.toLowerCase()} yet.</p>}
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <input value={it.reason} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} placeholder="Reason" className="flex-1 border rounded px-2 py-1 text-sm" />
            <input type="number" value={it.amount} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))} placeholder="Amount" className="w-32 border rounded px-2 py-1 text-sm text-right" />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="p-1.5 bg-red-50 hover:bg-red-100 rounded">
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function safeParse(json: string | null): { reason: string; amount: number }[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
