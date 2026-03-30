"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Users } from "lucide-react";
import * as XLSX from "xlsx";

interface Agent {
  id: string;
  name: string;
}

interface ParsedRow {
  name: string;
  phone: string;
  source: string;
  classification: string;
  nationality: string;
  gender: string;
  customerType: string;
  storeLink: string;
  [key: string]: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  totalRows: number;
  errors: string[];
}

/** Column mapping for client-side preview parsing */
const COLUMN_MAP: Record<string, string> = {
  name: "name", "الاسم": "name", "اسم العميل": "name", "client name": "name",
  "customer name": "name", "full name": "name", "lead name": "name",
  phone: "phone", "الهاتف": "phone", "رقم الهاتف": "phone", mobile: "phone",
  "الموبايل": "phone", "phone number": "phone", "رقم الموبايل": "phone", tel: "phone",
  source: "source", "المصدر": "source", campaign: "source", "الحملة": "source",
  "ad source": "source", "مصدر الحملة": "source",
  classification: "classification", "التصنيف": "classification", type: "classification",
  "النوع": "classification", "lead type": "classification",
  nationality: "nationality", "الجنسية": "nationality",
  gender: "gender", "الجنس": "gender",
  "customer type": "customerType", "نوع العميل": "customerType",
  "store link": "storeLink", "رابط المتجر": "storeLink", "store url": "storeLink",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-]+/g, " ");
}

export default function LeadsImportClient({ agents }: { agents: Agent[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Parse Excel file and generate preview */
  const parseFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setError("");

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rawRows.length === 0) {
        setError("الملف فارغ — لا توجد بيانات");
        return;
      }

      // Map columns
      const headers = Object.keys(rawRows[0]);
      const mapping: Record<string, string> = {};
      for (const h of headers) {
        const norm = normalizeHeader(h);
        if (COLUMN_MAP[norm]) mapping[h] = COLUMN_MAP[norm];
      }

      if (!Object.values(mapping).includes("name") || !Object.values(mapping).includes("phone")) {
        setError(`الملف لازم يحتوي على عمود "Name/الاسم" و "Phone/الهاتف" على الأقل. الأعمدة الموجودة: ${headers.join(", ")}`);
        return;
      }

      const parsed: ParsedRow[] = rawRows.map((row) => {
        const mapped: Record<string, string> = {
          name: "", phone: "", source: "", classification: "",
          nationality: "", gender: "", customerType: "", storeLink: "",
        };
        for (const [excelCol, field] of Object.entries(mapping)) {
          mapped[field] = String(row[excelCol] ?? "").trim();
        }
        return mapped as ParsedRow;
      });

      setPreview(parsed);
    } catch {
      setError("فشل في قراءة الملف — تأكد إنه ملف Excel صحيح (.xlsx أو .xls)");
    }
  }, []);

  /** Handle file drop */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) parseFile(droppedFile);
  }, [parseFile]);

  /** Handle file input change */
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) parseFile(selected);
  }, [parseFile]);

  /** Upload to API */
  const handleImport = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedAgent) formData.append("assignToAgentId", selectedAgent);

      const res = await fetch("/api/leads/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "حدث خطأ أثناء الرفع");
        return;
      }

      setResult(data);
    } catch {
      setError("فشل الاتصال بالسيرفر");
    } finally {
      setUploading(false);
    }
  };

  /** Reset everything */
  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setError("");
    setSelectedAgent("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      {!result && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer
            ${dragActive
              ? "border-blue-500 bg-blue-50"
              : file
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="hidden"
          />
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <FileSpreadsheet className="h-12 w-12 text-green-500" />
              <div>
                <p className="text-sm font-semibold text-green-700">{file.name}</p>
                <p className="text-xs text-green-600 mt-1">{preview.length} صف جاهز للاستيراد</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="mt-2 text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors"
              >
                <X className="h-3 w-3" /> تغيير الملف
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-12 w-12 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  اسحب ملف Excel هنا أو <span className="text-blue-600 underline">اختر ملف</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">يدعم xlsx, xls, csv</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">خطأ في الاستيراد</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {preview.length > 0 && !result && (
        <>
          {/* Agent Assignment */}
          <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-4">
            <Users className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تعيين الليدز لموظف تيلي سيلز (اختياري)
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">بدون تعيين — يتم التوزيع لاحقاً</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Data Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                معاينة البيانات ({preview.length} صف)
              </h3>
              <span className="text-xs text-gray-400">يتم عرض أول 50 صف</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">الاسم</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">الهاتف</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">المصدر</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">التصنيف</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">الجنسية</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{row.name || "—"}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 font-mono">{row.phone || "—"}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.source || "—"}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium
                          ${row.classification?.toLowerCase() === "hot" ? "bg-red-100 text-red-700" :
                            row.classification?.toLowerCase() === "warm" ? "bg-yellow-100 text-yellow-700" :
                            "bg-blue-100 text-blue-700"}`}>
                          {row.classification || "Cold"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.nationality || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Button */}
          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={uploading}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  استيراد {preview.length} عميل
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Success Result */}
      {result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <h3 className="text-lg font-bold text-green-800">تم الاستيراد بنجاح!</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center border border-green-100">
                <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                <p className="text-xs text-gray-500 mt-1">تم استيرادهم</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border border-yellow-100">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-xs text-gray-500 mt-1">مكررين (تم تخطيهم)</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border border-gray-100">
                <p className="text-2xl font-bold text-gray-600">{result.totalRows}</p>
                <p className="text-xs text-gray-500 mt-1">إجمالي الصفوف</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800 mb-2">ملاحظات:</p>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              رفع ملف جديد
            </button>
            <a
              href="/dashboard/telesales"
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              عرض الليدز في التيلي سيلز
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
