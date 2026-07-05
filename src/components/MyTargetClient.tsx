"use client";
import { useEffect, useState } from "react";
import { Target, TrendingUp, Trophy, CalendarDays } from "lucide-react";
import { getMyTarget } from "@/client/api/analytics";

interface MonthlyTargetRow {
  month: string; // YYYY-MM
  target: number;
  achieved: number;
}

interface TargetData {
  role: string;
  metric: string;
  months: MonthlyTargetRow[];
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function barColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-blue-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-red-500";
}

export default function MyTargetClient() {
  const [data, setData] = useState<TargetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyTarget()
      .then((d) => {
        if (active) setData(d as TargetData);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-500 py-10 text-center">Loading your target history…</div>;
  }

  if (!data || data.months.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-600">No target set yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Your manager hasn&apos;t assigned a monthly target. Once they do, your monthly progress will appear here.
        </p>
      </div>
    );
  }

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentRow = data.months.find((m) => m.month === currentMonthKey);
  const currentPct =
    currentRow && currentRow.target > 0
      ? Math.round((currentRow.achieved / currentRow.target) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Current month highlight */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2 opacity-90">
            <CalendarDays className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">This Month</span>
          </div>
          <p className="text-3xl font-bold">{currentRow?.achieved ?? 0}</p>
          <p className="text-xs opacity-80 mt-1">
            of {currentRow?.target ?? 0} {data.metric.toLowerCase()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">This Month %</span>
          </div>
          <p className={`text-3xl font-bold ${currentPct >= 100 ? "text-emerald-600" : "text-gray-900"}`}>
            {currentPct}%
          </p>
          <p className="text-xs text-gray-400 mt-1">of your monthly target</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Trophy className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Metric</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{data.metric}</p>
          <p className="text-xs text-gray-400 mt-1">{data.months.length} months tracked</p>
        </div>
      </div>

      {/* Monthly bars */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Monthly Performance</h3>
        <div className="space-y-4">
          {data.months.map((row) => {
            const pct = row.target > 0 ? Math.round((row.achieved / row.target) * 100) : 0;
            const width = Math.min(100, pct);
            const isCurrent = row.month === currentMonthKey;
            return (
              <div key={row.month} className={`${isCurrent ? "bg-indigo-50/60 -mx-2 px-2 py-2 rounded-lg" : ""}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{formatMonthLabel(row.month)}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold text-gray-900">
                      {row.achieved}
                      <span className="text-gray-400 font-normal"> / {row.target || "—"}</span>
                    </span>
                    {row.target > 0 && (
                      <span
                        className={`text-xs font-bold min-w-[3rem] text-right ${
                          pct >= 100 ? "text-emerald-600" : pct >= 30 ? "text-gray-600" : "text-red-500"
                        }`}
                      >
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                  {row.target > 0 ? (
                    <div
                      className={`h-3 rounded-full transition-all ${barColor(pct)}`}
                      style={{ width: `${width}%` }}
                    />
                  ) : (
                    <div className="h-3 flex items-center pl-2">
                      <span className="text-[10px] text-gray-400 italic">No target set for this month</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
