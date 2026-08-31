"use client";

import { X } from "lucide-react";

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any[];
  columns: { key: string; label: string; render?: (val: any, row: any) => React.ReactNode }[];
}

export default function DrillDownModal({ isOpen, onClose, title, data, columns }: DrillDownModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <h2 className="text-lg font-bold text-slate-800">{title} <span className="text-sm font-normal text-slate-500 ms-2">({data.length} records)</span></h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {data.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 italic">No data available</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
              <table className="w-full text-start text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 sticky top-0">
                  <tr>
                    {columns.map((c, i) => (
                      <th key={i} className="px-4 py-3">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      {columns.map((c, j) => (
                        <td key={j} className="px-4 py-3 text-slate-700">
                          {c.render ? c.render(row[c.key], row) : (row[c.key] || "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
