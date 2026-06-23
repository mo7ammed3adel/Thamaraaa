"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_TIERS = [
  { minNet: 1000, maxNet: 15000, pct: 0.015 },
  { minNet: 15001, maxNet: 20000, pct: 0.02 },
  { minNet: 20001, maxNet: null, pct: 0.025 },
];

// TeleSales bonus thresholds are fixed by spec (§14.4); only the amounts are editable.
const TELESALES_TIER_THRESHOLDS = [100, 125, 150];
const DEFAULT_TELESALES_BONUS = {
  meetingTiers: [
    { achievementPct: 150, amount: 1000 },
    { achievementPct: 125, amount: 600 },
    { achievementPct: 100, amount: 300 },
  ],
  perConversionAmount: 100,
};

function parseTelesalesBonus(raw: string | undefined): {
  meetingTiers: { achievementPct: number; amount: number }[];
  perConversionAmount: number;
} {
  if (!raw) return DEFAULT_TELESALES_BONUS;
  try {
    const parsed = JSON.parse(raw);
    const tiers = Array.isArray(parsed?.meetingTiers) ? parsed.meetingTiers : [];
    const perConversionAmount =
      typeof parsed?.perConversionAmount === "number"
        ? parsed.perConversionAmount
        : DEFAULT_TELESALES_BONUS.perConversionAmount;
    return { meetingTiers: tiers, perConversionAmount };
  } catch {
    return DEFAULT_TELESALES_BONUS;
  }
}

export default function SettingsClient({
  initialConfigs,
  initialCommissions = [],
}: {
  initialConfigs: any[];
  initialCommissions?: any[];
}) {
  const router = useRouter();
  const [configs] = useState(initialConfigs);
  const [commissions] = useState(initialCommissions);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("finance");

  const findConfig = (key: string) => configs.find((c: any) => c.key === key);

  const handleUpdate = async (key: string, value: string) => {
    setLoading(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setLoading(false);
    router.refresh();
  };

  let tiers: { minNet: number; maxNet: number | null; pct: number }[] = DEFAULT_TIERS;
  const tiersConfig = findConfig("commission_tiers");
  if (tiersConfig) {
    try {
      const parsed = JSON.parse(tiersConfig.value);
      if (Array.isArray(parsed) && parsed.length) tiers = parsed;
    } catch {
      // keep defaults
    }
  }

  const gatewayFee = parseFloat(findConfig("gateway_fee_pct")?.value || "0.07");
  const telesalesBonus = parseTelesalesBonus(findConfig("telesales_bonus_rules")?.value);

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200">
        <TabButton active={activeTab === "finance"} onClick={() => setActiveTab("finance")} label="💵 Finance Rules" />
        <TabButton active={activeTab === "commissions"} onClick={() => setActiveTab("commissions")} label="🧮 Commission Rules" />
        <TabButton active={activeTab === "config"} onClick={() => setActiveTab("config")} label="⚙️ System Config" />
        <TabButton active={activeTab === "permissions"} onClick={() => setActiveTab("permissions")} label="🔐 Permission Matrix" />
      </div>

      {activeTab === "permissions" && <PermissionMatrix />}

      {activeTab === "finance" && (
        <div className="space-y-6">
          <FinanceRulesSection gatewayFee={gatewayFee} tiers={tiers} onUpdate={handleUpdate} />
          <TelesalesBonusSection rules={telesalesBonus} loading={loading} onUpdate={handleUpdate} />
        </div>
      )}

      {activeTab === "config" && (
        <SystemConfigSection configs={configs} loading={loading} onUpdate={handleUpdate} />
      )}

      {activeTab === "commissions" && (
        <CommissionRulesSection commissions={commissions} loading={loading} setLoading={setLoading} router={router} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${active ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
      {label}
    </button>
  );
}

function FinanceRulesSection({ gatewayFee, tiers, onUpdate }: { gatewayFee: number; tiers: any[]; onUpdate: (k: string, v: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Net Target Formula</h3>
        <p className="text-xs text-gray-500 mt-1">Per spec: Net = Cash × 1.0 + (Tabby/Tamara × (1 − gateway_fee_pct))</p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Payment Gateway Fee % (Tabby / Tamara)</label>
          <p className="text-xs text-gray-500 mb-2">Decimal value. 0.07 means 7% deducted from Tabby/Tamara amounts before commission.</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              step="0.01"
              min="0"
              max="0.99"
              defaultValue={gatewayFee}
              onBlur={(e) => {
                const v = e.target.value;
                if (parseFloat(v) !== gatewayFee) onUpdate("gateway_fee_pct", v);
              }}
              className="border px-3 py-2 rounded text-sm w-40"
            />
            <span className="text-sm text-gray-500">= {(gatewayFee * 100).toFixed(2)}%</span>
          </div>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-semibold text-sm text-gray-900 mb-1">Commission Tier Brackets</h4>
          <p className="text-xs text-gray-500 mb-3">
            Saved as JSON in <code>commission_tiers</code> system config. Default = spec values.
          </p>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Min Net (SAR)</th>
                <th className="px-3 py-2 text-left">Max Net (SAR)</th>
                <th className="px-3 py-2 text-left">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tiers.map((t, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{t.minNet.toLocaleString()}</td>
                  <td className="px-3 py-2">{t.maxNet ? t.maxNet.toLocaleString() : "∞"}</td>
                  <td className="px-3 py-2 font-bold">{(t.pct * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-blue-600 font-semibold">Edit tiers (JSON)</summary>
            <textarea
              defaultValue={JSON.stringify(tiers, null, 2)}
              onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (!Array.isArray(parsed)) throw new Error("Must be an array");
                  onUpdate("commission_tiers", JSON.stringify(parsed));
                } catch (err: any) {
                  alert("Invalid JSON: " + err.message);
                }
              }}
              rows={8}
              className="w-full font-mono text-xs border rounded p-3 mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">Each row should be an object with minNet, maxNet (or null), and pct.</p>
          </details>
        </div>
      </div>
    </div>
  );
}

function TelesalesBonusSection({
  rules,
  loading,
  onUpdate,
}: {
  rules: { meetingTiers: { achievementPct: number; amount: number }[]; perConversionAmount: number };
  loading: boolean;
  onUpdate: (k: string, v: string) => void;
}) {
  const amountFor = (pct: number) =>
    rules.meetingTiers.find((t) => t.achievementPct === pct)?.amount ?? 0;

  // Rebuilds the full rules object from the fixed thresholds + current amounts and saves it.
  const save = (overrides: { pct?: number; amount?: number; perConversion?: number }) => {
    const meetingTiers = TELESALES_TIER_THRESHOLDS.slice()
      .sort((a, b) => b - a)
      .map((p) => ({
        achievementPct: p,
        amount: overrides.pct === p ? Number(overrides.amount) || 0 : amountFor(p),
      }));
    const perConversionAmount =
      overrides.perConversion !== undefined ? Number(overrides.perConversion) || 0 : rules.perConversionAmount;
    onUpdate("telesales_bonus_rules", JSON.stringify({ meetingTiers, perConversionAmount }));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">TeleSales Bonus Rules</h3>
        <p className="text-xs text-gray-500 mt-1">
          Per spec §14.4. Bonus (SAR) granted when an agent reaches each % of their monthly meetings
          target, plus a flat bonus per converted (Closed_Won) deal. Saved to{" "}
          <code>telesales_bonus_rules</code> and <span className="font-semibold text-emerald-600">applied immediately</span> for the current month.
        </p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-3">Meetings Target Bonus</h4>
          <div className="grid grid-cols-3 gap-4">
            {TELESALES_TIER_THRESHOLDS.map((pct) => (
              <div key={pct}>
                <label className="block text-xs font-bold text-gray-600 mb-1">At {pct}% of target</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    defaultValue={amountFor(pct)}
                    disabled={loading}
                    onBlur={(e) => {
                      const v = Number(e.target.value) || 0;
                      if (v !== amountFor(pct)) save({ pct, amount: v });
                    }}
                    className="border px-3 py-2 rounded text-sm w-full focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <span className="text-xs text-gray-500">SAR</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 max-w-xs">
          <label className="block text-sm font-bold text-gray-700 mb-1">Bonus per converted deal</label>
          <p className="text-xs text-gray-500 mb-2">Flat SAR for each lead the agent handled that closed as a deal.</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="10"
              defaultValue={rules.perConversionAmount}
              disabled={loading}
              onBlur={(e) => {
                const v = Number(e.target.value) || 0;
                if (v !== rules.perConversionAmount) save({ perConversion: v });
              }}
              className="border px-3 py-2 rounded text-sm w-40 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <span className="text-xs text-gray-500">SAR / conversion</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemConfigSection({ configs, loading, onUpdate }: { configs: any[]; loading: boolean; onUpdate: (k: string, v: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Global Settings</h3>
      </div>
      <div className="p-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Key</th>
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Value</th>
              <th className="py-2 text-left text-xs font-semibold text-gray-500 uppercase">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {configs.map((c: any) => (
              <tr key={c.id ?? c.key}>
                <td className="py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.key}</td>
                <td className="py-4 whitespace-nowrap text-sm text-gray-500">
                  <input
                    type="text"
                    defaultValue={c.value}
                    onBlur={(e) => {
                      if (e.target.value !== c.value) onUpdate(c.key, e.target.value);
                    }}
                    className="border px-3 py-1.5 rounded text-sm w-full max-w-xs focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </td>
                <td className="py-4 whitespace-nowrap text-xs text-gray-400">
                  {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-sm text-gray-500">
                  No system configurations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-semibold mb-3">Add New Parameter</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              onUpdate(form.keyName.value, form.keyValue.value);
              form.reset();
            }}
            className="flex gap-3"
          >
            <input required name="keyName" type="text" placeholder="Key (e.g. gateway_fee_pct)" className="border px-3 py-2 rounded text-sm w-64" />
            <input required name="keyValue" type="text" placeholder="Value (e.g. 0.07)" className="border px-3 py-2 rounded text-sm w-64" />
            <button disabled={loading} type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded hover:bg-slate-900 transition">
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CommissionRulesSection({ commissions, loading, setLoading, router }: { commissions: any[]; loading: boolean; setLoading: (b: boolean) => void; router: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <h3 className="text-base font-semibold text-gray-900">Dynamic Commission Rules</h3>
        <p className="text-xs text-gray-500 mt-1">Set the final commission percentage (e.g. 0.05 for 5%) that each role instantly receives when targets are hit.</p>
      </div>
      <div className="p-6">
        <table className="min-w-full divide-y divide-gray-200">
          <tbody className="divide-y divide-gray-200">
            {commissions.map((c: any) => (
              <tr key={c.id}>
                <td className="py-4 whitespace-nowrap text-sm font-bold text-gray-800 capitalize">{c.role.replace(/_/g, " ")}</td>
                <td className="py-4 whitespace-nowrap text-sm text-gray-500">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={c.percentage}
                    onBlur={async (e) => {
                      if (parseFloat(e.target.value) !== c.percentage) {
                        setLoading(true);
                        await fetch("/api/settings/commissions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ role: c.role, percentage: e.target.value }),
                        });
                        setLoading(false);
                        router.refresh();
                      }
                    }}
                    className="border px-3 py-1.5 rounded text-sm w-32 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </td>
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr>
                <td colSpan={2} className="py-8 text-center text-sm text-gray-500">
                  No commission rules set.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-semibold mb-3">Add / Update Rule</h4>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              setLoading(true);
              await fetch("/api/settings/commissions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: form.roleName.value, percentage: form.percentageVal.value }),
              });
              form.reset();
              setLoading(false);
              router.refresh();
            }}
            className="flex gap-3"
          >
            <input required name="roleName" type="text" placeholder="Role (e.g. sales_agent)" className="border px-3 py-2 rounded text-sm w-64" />
            <input required name="percentageVal" type="number" step="0.01" placeholder="Percentage (e.g. 0.05)" className="border px-3 py-2 rounded text-sm w-48" />
            <button disabled={loading} type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition">
              Create Rule
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Permission Matrix — read-only summary derived from src/lib/constants.ts
// and src/lib/distribution.ts. This is informational; permissions are
// enforced at the API layer, not configured here.
// ─────────────────────────────────────────────────────────────────────
function PermissionMatrix() {
  const ROLES_BY_DEPT: Record<string, { role: string; capabilities: string[] }[]> = {
    "Administration": [
      { role: "super_admin", capabilities: ["Full access (View/Create/Edit/Delete/Export)", "System config", "User management", "All distributions"] },
    ],
    "Sales Leadership": [
      { role: "chief_sales", capabilities: ["View pipeline aggregated", "Drill into TeleSales/Sales metrics"] },
      { role: "sales_manager", capabilities: ["View team", "Recycle Bin", "Master Sheet", "Issue warnings"] },
      { role: "tele_sales_manager", capabilities: ["View aggregated team", "Manage targets", "Manage cold leads"] },
    ],
    "Account Management": [
      { role: "head_account_manager", capabilities: ["View ALL projects", "Distribute → AM / Head Tech / Head SEO", "Issue warnings", "Change lifecycle state"] },
      { role: "account_manager", capabilities: ["View own projects", "Setup project", "Distribute → Head SEO", "Issue warnings", "Lifecycle state"] },
    ],
    "Technical Heads": [
      { role: "head_technical", capabilities: ["View assigned projects", "Distribute → TL Social Media / TL Media Buyer"] },
      { role: "head_seo", capabilities: ["View SEO projects", "Distribute → TL SEO"] },
    ],
    "Team Leaders": [
      { role: "team_leader_seo", capabilities: ["Distribute to agent_seo / agent_content_seo", "Reassign tasks"] },
      { role: "team_leader_social_media", capabilities: ["Distribute to agent_social_media", "Reassign tasks"] },
      { role: "team_leader_media_buyer", capabilities: ["Distribute to agent_media_buyer", "Reassign tasks"] },
      { role: "leader_graphic_designer", capabilities: ["Receive cross-team graphic_design tasks", "Distribute to agent_graphic_designer"] },
      { role: "leader_motion_graphic", capabilities: ["Receive cross-team motion_graphic tasks", "Distribute to agent_motion_graphic"] },
      { role: "leader_ui", capabilities: ["Receive cross-team ui_design tasks", "Distribute to agent_ui"] },
    ],
    "Agents": [
      { role: "agent_seo / agent_content_seo", capabilities: ["Update task progress", "Flag tasks", "Create cross-team tasks (UI / Content)"] },
      { role: "agent_social_media / agent_media_buyer", capabilities: ["Update task progress", "Flag tasks", "Create cross-team tasks (Graphic / Motion / UI)"] },
      { role: "agent_graphic_designer / agent_motion_graphic / agent_ui", capabilities: ["Update task progress", "Upload deliverables", "Flag tasks"] },
    ],
    "TeleSales / Sales (frozen)": [
      { role: "tele_sales_agent", capabilities: ["Manage own leads", "Call logging", "Schedule meetings"] },
      { role: "sales_agent", capabilities: ["Manage own opportunities", "Status toggle", "Close deals", "Issue warnings"] },
    ],
    "HR / Finance": [
      { role: "hr_manager", capabilities: ["User management", "Hiring pipeline", "Leave requests", "Promotion engine", "Documents"] },
      { role: "accountant", capabilities: ["View finance overview", "Mark installments paid", "Compute commissions", "Finalize payouts", "Export XLSX"] },
    ],
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Role × Capability Matrix</h3>
        <p className="text-xs text-gray-500 mt-1">
          Read-only. Permissions are enforced server-side at <code>src/lib/constants.ts</code> + <code>src/lib/distribution.ts</code>. To change them, edit those files.
        </p>
      </div>

      {Object.entries(ROLES_BY_DEPT).map(([dept, rows]) => (
        <div key={dept}>
          <h4 className="font-bold text-sm text-slate-800 mb-2 border-l-4 border-blue-500 pl-3">{dept}</h4>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-left w-1/3">Role</th>
                <th className="px-3 py-2 text-left">Capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{r.role}</td>
                  <td className="px-3 py-2">
                    <ul className="list-disc list-inside space-y-0.5">
                      {r.capabilities.map((cap, j) => (
                        <li key={j} className="text-xs text-slate-600">{cap}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
