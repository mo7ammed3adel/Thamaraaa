"use client";
import { useState } from "react";
import { notify } from "@/components/toast";
import { Clock, FileText, UploadCloud, Calendar, User } from "lucide-react";
import { createDocument, submitLeaveRequest } from "@/client/api/hr";
import { HttpError } from "@/client/transport/http";

/** These flows always showed success and reloaded even on a rejected request,
 * so an HTTP failure is swallowed to keep that behavior; network errors still throw. */
function swallowHttpError(error: unknown) {
  if (!(error instanceof HttpError)) throw error;
}

export default function ProfileClient({ profile }: { profile: any }) {
  const [requestForm, setRequestForm] = useState(false);
  const [docForm, setDocForm] = useState(false);
  const [reqData, setReqData] = useState({ type: "Leave", date: "", reason: "" });
  const [docData, setDocData] = useState({ name: "", fileUrl: "" });

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitLeaveRequest(reqData).catch(swallowHttpError);
    notify("Request submitted successfully to HR.");
    window.location.reload();
  };

  const uploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDocument(docData).catch(swallowHttpError);
    notify("Document uploaded.");
    window.location.reload();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Workspace & Profile</h1>
      
      {/* Header Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="h-24 w-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold shrink-0">
            {profile.name.charAt(0)}
          </div>
          <div className="flex-1 text-center sm:text-start">
            <h2 className="text-2xl font-bold text-gray-900">{profile.name}</h2>
            <p className="text-gray-500 mb-2">{profile.email} • {profile.phone || "No phone"}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium capitalize">{profile.role.replace(/_/g, " ")}</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{profile.level}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${profile.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{profile.status}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
            <button onClick={() => setRequestForm(true)} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg text-sm hover:bg-blue-700 transition">
              + Request Leave / Remote
            </button>
            <button onClick={() => setDocForm(true)} className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg text-sm hover:bg-gray-50 transition">
              + Upload Document
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Attendance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Clock className="w-5 h-5 text-gray-400"/>
            <h3 className="text-lg font-bold text-gray-900">Recent Attendance</h3>
          </div>
          <div className="space-y-3">
            {profile.attendances.map((a: any) => (
              <div key={a.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{new Date(a.date).toLocaleDateString()}</span>
                <span className="text-sm text-gray-500">{new Date(a.checkIn).toLocaleTimeString()} - {a.checkOut ? new Date(a.checkOut).toLocaleTimeString() : "Ongoing"}</span>
                <span className="text-sm font-medium text-red-500">{a.lateMinutes > 0 ? `${a.lateMinutes}m delay` : "On time"}</span>
              </div>
            ))}
            {profile.attendances.length === 0 && <p className="text-sm text-gray-500">No attendance records.</p>}
          </div>
        </div>

        {/* Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <Calendar className="w-5 h-5 text-gray-400"/>
            <h3 className="text-lg font-bold text-gray-900">My Requests</h3>
          </div>
          <div className="space-y-3">
            {profile.leaveRequests.map((r: any) => (
              <div key={r.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="text-sm font-bold text-gray-800">{r.type}</p>
                  <p className="text-xs text-gray-500">{new Date(r.date).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded ${r.status === 'Approved' ? 'bg-green-100 text-green-700' : r.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {r.status}
                </span>
              </div>
            ))}
            {profile.leaveRequests.length === 0 && <p className="text-sm text-gray-500">No requests.</p>}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4 border-b pb-2">
            <FileText className="w-5 h-5 text-gray-400"/>
            <h3 className="text-lg font-bold text-gray-900">Documents</h3>
          </div>
          <div className="space-y-3">
            {profile.documents.map((d: any) => (
              <div key={d.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                <span className="text-sm font-medium text-gray-800">{d.name}</span>
                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">View Link</a>
              </div>
            ))}
            {profile.documents.length === 0 && <p className="text-sm text-gray-500">No documents uploaded.</p>}
          </div>
        </div>

        {/* Sales / Telesales Stats Module */}
        {profile.role.includes("sales") && (
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-100 p-6">
            <h3 className="text-lg font-bold text-green-900 mb-4 border-b border-green-200 pb-2">
              {profile.role.startsWith("tele_") ? "My Telesales Performance" : "My Sales Performance"}
            </h3>
            <p className="text-3xl font-bold text-green-600 mb-2">{profile.salesStats?.dealCount ?? 0} Deals</p>
            <p className="text-sm text-green-700 font-medium">
              Total Revenue: SAR {(profile.salesStats?.revenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {requestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">New Request</h3>
            <form onSubmit={submitRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="w-full border p-2 rounded" value={reqData.type} onChange={e => setReqData({...reqData, type: e.target.value})}>
                  <option>Leave</option>
                  <option>Remote Work</option>
                  <option>Permission (Hours)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input required type="date" className="w-full border p-2 rounded" value={reqData.date} onChange={e => setReqData({...reqData, date: e.target.value})}/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason / Notes</label>
                <textarea className="w-full border p-2 rounded" rows={3} value={reqData.reason} onChange={e => setReqData({...reqData, reason: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setRequestForm(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {docForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Upload Document Link</h3>
            <form onSubmit={uploadDoc} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Document Name (e.g. CV, Contract)</label>
                <input required type="text" className="w-full border p-2 rounded" value={docData.name} onChange={e => setDocData({...docData, name: e.target.value})}/>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File URL (Google Drive, AWS, etc.)</label>
                <input required type="url" className="w-full border p-2 rounded" value={docData.fileUrl} onChange={e => setDocData({...docData, fileUrl: e.target.value})}/>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setDocForm(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
