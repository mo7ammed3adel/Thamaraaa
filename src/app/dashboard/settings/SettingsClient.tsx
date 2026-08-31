"use client";

import { useState } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { saveCommissionRule, saveSetting } from "@/client/api/settings";
import { wipeTestData } from "@/client/api/admin";
import { HttpError } from "@/client/transport/http";
import { useTranslator } from "@/components/i18n/LocaleProvider";

/** These flows always refreshed even on a rejected request, so an HTTP
 * failure is swallowed to keep that behavior; network errors still throw. */
function swallowHttpError(error: unknown) {
  if (!(error instanceof HttpError)) throw error;
}

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
  const t = useTranslator();
  const router = useRouter();
  const [configs] = useState(initialConfigs);
  const [commissions] = useState(initialCommissions);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("finance");

  const findConfig = (key: string) => configs.find((c: any) => c.key === key);

  const handleUpdate = async (key: string, value: string) => {
    setLoading(true);
    await saveSetting({ key, value }).catch(swallowHttpError);
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
        <TabButton active={activeTab === "testing"} onClick={() => setActiveTab("testing")} label="🧪 Testing" />
      </div>

      {activeTab === "permissions" && <PermissionMatrix />}

      {activeTab === "testing" && <TestDataSection router={router} />}

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
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">{t("settings.netFormula")}</h3>
        <p className="text-xs text-gray-500 mt-1">{t("settings.netFormulaHint")}</p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">{t("settings.gatewayFee")}</label>
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
          <h4 className="font-semibold text-sm text-gray-900 mb-1">{t("settings.tierBrackets")}</h4>
          <p className="text-xs text-gray-500 mb-3">
            Saved as JSON in <code>commission_tiers</code> system config. Default = spec values.
          </p>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-start">{t("settings.minNet")}</th>
                <th className="px-3 py-2 text-start">{t("settings.maxNet")}</th>
                <th className="px-3 py-2 text-start">{t("settings.rate")}</th>
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
            <summary className="cursor-pointer text-sm text-blue-600 font-semibold">{t("settings.editTiers")}</summary>
            <textarea
              defaultValue={JSON.stringify(tiers, null, 2)}
              onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (!Array.isArray(parsed)) throw new Error("Must be an array");
                  onUpdate("commission_tiers", JSON.stringify(parsed));
                } catch (err: any) {
                  notify("Invalid JSON: " + err.message);
                }
              }}
              rows={8}
              className="w-full font-mono text-xs border rounded p-3 mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">{t("settings.tiersHint")}</p>
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
  const t = useTranslator();
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
        <h3 className="text-base font-semibold text-gray-900">{t("settings.teleBonusRules")}</h3>
        <p className="text-xs text-gray-500 mt-1">
          Per spec §14.4. Bonus (SAR) granted when an agent reaches each % of their monthly meetings
          target, plus a flat bonus per converted (Closed_Won) deal. Saved to{" "}
          <code>telesales_bonus_rules</code> and <span className="font-semibold text-emerald-600">applied immediately</span> for the current month.
        </p>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <h4 className="font-semibold text-sm text-gray-900 mb-3">{t("settings.meetingsBonus")}</h4>
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
                  <span className="text-xs text-gray-500">{t("finance.sar")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6 max-w-xs">
          <label className="block text-sm font-bold text-gray-700 mb-1">{t("settings.bonusPerDeal")}</label>
          <p className="text-xs text-gray-500 mb-2">{t("settings.bonusPerDealHint")}</p>
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
            <span className="text-xs text-gray-500">{t("settings.sarPerConversion")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemConfigSection({ configs, loading, onUpdate }: { configs: any[]; loading: boolean; onUpdate: (k: string, v: string) => void }) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">{t("settings.global")}</h3>
      </div>
      <div className="p-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="py-2 text-start text-xs font-semibold text-gray-500 uppercase">{t("settings.key")}</th>
              <th className="py-2 text-start text-xs font-semibold text-gray-500 uppercase">{t("settings.value")}</th>
              <th className="py-2 text-start text-xs font-semibold text-gray-500 uppercase">{t("settings.lastUpdated")}</th>
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
          <h4 className="text-sm font-semibold mb-3">{t("settings.addParameter")}</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              onUpdate(form.keyName.value, form.keyValue.value);
              form.reset();
            }}
            className="flex gap-3"
          >
            <input required name="keyName" type="text" placeholder={t("settings.keyExample")} className="border px-3 py-2 rounded text-sm w-64" />
            <input required name="keyValue" type="text" placeholder={t("settings.valueExample")} className="border px-3 py-2 rounded text-sm w-64" />
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
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <h3 className="text-base font-semibold text-gray-900">{t("settings.dynamicRules")}</h3>
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
                        await saveCommissionRule({ role: c.role, percentage: e.target.value }).catch(swallowHttpError);
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
          <h4 className="text-sm font-semibold mb-3">{t("settings.addRule")}</h4>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              setLoading(true);
              await saveCommissionRule({ role: form.roleName.value, percentage: form.percentageVal.value }).catch(swallowHttpError);
              form.reset();
              setLoading(false);
              router.refresh();
            }}
            className="flex gap-3"
          >
            <input required name="roleName" type="text" placeholder={t("settings.roleExample")} className="border px-3 py-2 rounded text-sm w-64" />
            <input required name="percentageVal" type="number" step="0.01" placeholder={t("settings.pctExample")} className="border px-3 py-2 rounded text-sm w-48" />
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
  const t = useTranslator();
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
        <h3 className="text-base font-semibold text-gray-900">{t("settings.roleMatrix")}</h3>
        <p className="text-xs text-gray-500 mt-1">
          Read-only. Permissions are enforced server-side at <code>src/lib/constants.ts</code> + <code>src/lib/distribution.ts</code>. To change them, edit those files.
        </p>
      </div>

      {Object.entries(ROLES_BY_DEPT).map(([dept, rows]) => (
        <div key={dept}>
          <h4 className="font-bold text-sm text-slate-800 mb-2 border-s-4 border-blue-500 ps-3">{dept}</h4>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2 text-start w-1/3">{t("common.role")}</th>
                <th className="px-3 py-2 text-start">{t("settings.capabilities")}</th>
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

// ─────────────────────────────────────────────────────────────────────
// Testing — reset operational CRM data for a clean test run.
// Wipes leads/clients, meetings, calls, deals, projects, tasks, and their
// dependents. Keeps users, companies, packages, HR, and all configuration.
// Super-admin only; enforced again server-side in /api/admin/wipe-test-data.
// ─────────────────────────────────────────────────────────────────────
const WIPE_KEEPS = ["المستخدمين (Users)", "الشركات (Companies)", "الباقات (Packages)", "بيانات HR", "الإعدادات (Config)"];
const WIPE_DELETES = [
  "العملاء / الـ Leads",
  "الاجتماعات (Meetings)",
  "المكالمات (Call Logs)",
  "الصفقات (Deals) + الأقساط",
  "المشاريع (Projects) + التاسكات",
  "الإشعارات، التارجت، الملاحظات، التحذيرات",
];

function TestDataSection({ router }: { router: any }) {
  const t = useTranslator();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const armed = confirmText.trim().toUpperCase() === "WIPE";

  const handleWipe = async () => {
    if (!armed || loading) return;
    setLoading(true);
    try {
      const result = await wipeTestData();
      notify(`تم مسح البيانات التجريبية — ${result.total} صف اتشال. اليوزرات والشركات والباقات و HR زي ما هما.`, "success");
      setConfirmText("");
      router.refresh();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "حصل خطأ أثناء المسح. جرّب تاني.";
      notify(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-red-200">
      <div className="px-6 py-4 border-b border-red-100 bg-red-50 rounded-t-xl">
        <h3 className="text-base font-semibold text-red-800">🧨 Danger Zone — مسح البيانات التجريبية</h3>
        <p className="text-xs text-red-600 mt-1">
          للتجربة فقط. بيمسح البيانات التشغيلية كلها من قاعدة البيانات <span className="font-bold">اللايف</span> ومفيش رجوع.
          راجع كويس قبل ما تضغط.
        </p>
      </div>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
            <h4 className="text-sm font-bold text-red-700 mb-2">هيتمسح ❌</h4>
            <ul className="list-disc list-inside space-y-1">
              {WIPE_DELETES.map((item) => (
                <li key={item} className="text-xs text-red-700">{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
            <h4 className="text-sm font-bold text-emerald-700 mb-2">هيفضل زي ما هو ✅</h4>
            <ul className="list-disc list-inside space-y-1">
              {WIPE_KEEPS.map((item) => (
                <li key={item} className="text-xs text-emerald-700">{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <label className="block text-sm font-bold text-gray-700 mb-1">
            اكتب <code className="px-1.5 py-0.5 bg-gray-100 rounded text-red-600 font-mono">WIPE</code> للتأكيد
          </label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="WIPE"
              disabled={loading}
              className="border px-3 py-2 rounded text-sm w-40 font-mono focus:ring-red-500 focus:border-red-500 outline-none"
            />
            <button
              onClick={handleWipe}
              disabled={!armed || loading}
              className="px-5 py-2 rounded text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
            >
              {loading ? "جاري المسح…" : "امسح البيانات التجريبية"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
