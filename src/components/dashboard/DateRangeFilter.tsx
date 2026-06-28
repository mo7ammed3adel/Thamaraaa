"use client";

import { CalendarDays, RotateCcw } from "lucide-react";
import { DateRangePreset, getDateRangePreset } from "@/lib/dateRange";

type DateRangeFilterProps = {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onApply?: () => void;
  onReset?: () => void;
  label?: string;
  description?: string;
  includeLastMonth?: boolean;
};

const BASE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
];

export default function DateRangeFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onApply,
  onReset,
  label = "Date Range",
  description,
  includeLastMonth = false,
}: DateRangeFilterProps) {
  const presets = includeLastMonth
    ? [...BASE_PRESETS, { value: "last_month" as DateRangePreset, label: "Last Month" }]
    : BASE_PRESETS;

  const setRange = (preset: DateRangePreset) => {
    const range = getDateRangePreset(preset);
    onFromDateChange(range.from);
    onToDateChange(range.to);
  };

  const clearRange = () => {
    onFromDateChange("");
    onToDateChange("");
    onReset?.();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="min-w-[180px]">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            {label}
          </div>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>

        <div className="flex flex-wrap items-end gap-3 flex-1">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase">From Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => onFromDateChange(event.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1 uppercase">To Date</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => onToDateChange(event.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </label>

          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium border border-blue-600"
            >
              Apply
            </button>
          )}

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={clearRange}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.value}
            onClick={() => setRange(preset.value)}
            className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition border border-blue-200"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
