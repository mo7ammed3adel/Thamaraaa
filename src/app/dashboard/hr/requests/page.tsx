"use client";
import { useState, useEffect } from "react";
import { Check, X, Clock } from "lucide-react";
import { listHrRequests, updateHrRequest } from "@/client/api/hr";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function HRRequestsPage() {
  const t = useTranslator();
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    listHrRequests()
      .then(data => setRequests(data || []));
  }, []);

  const handleDecision = async (id: string, decision: string) => {
    await updateHrRequest(id, { status: decision });
    setRequests(requests.map(r => r.id === id ? { ...r, status: decision } : r));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">
        Leave & Remote Work Requests
      </h1>
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <ul className="divide-y">
          {requests.map(req => (
            <li key={req.id} className="py-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{req.user.name}</span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize">{req.user.role.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm font-medium mt-1">{t("hr.requested")} <span className="text-blue-600">{req.type}</span> for {new Date(req.date).toLocaleDateString()}</p>
                {req.reason && <p className="text-sm text-gray-500 mt-1 italic">"{req.reason}"</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {req.status}
                </span>
                {req.status === "Pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => handleDecision(req.id, "Approved")} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title={t("common.approve")}>
                      <Check className="w-5 h-5"/>
                    </button>
                    <button onClick={() => handleDecision(req.id, "Rejected")} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200" title={t("common.reject")}>
                      <X className="w-5 h-5"/>
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {requests.length === 0 && <p className="text-gray-500 py-4">{t("hr.noPendingRequests")}</p>}
        </ul>
      </div>
    </div>
  );
}
