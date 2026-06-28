"use client";

import { useState, useEffect, useCallback } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { Users, Briefcase, Calendar, CheckSquare, Plus, X, Search, Edit2, UserX, UserCheck, TrendingUp, FileText, Trash2, AlertTriangle, Award } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import {
  createDocument,
  createEmployee,
  deleteDocument,
  listDocuments,
  listPromotionEvaluations,
  runAutoEvaluations,
  runPromotionAction,
  submitAttendance,
  updateAttendance,
  updateEmployee,
} from "@/client/api/hr";

const ALL_ROLES = [
  { value: "super_admin", label: "Super Admin", dept: "Administration" },
  { value: "chief_sales", label: "Chief Sales", dept: "Sales" },
  { value: "sales_manager", label: "Sales Manager", dept: "Sales" },
  { value: "sales_agent", label: "Sales Agent", dept: "Sales" },
  { value: "tele_sales_manager", label: "TeleSales Manager", dept: "TeleSales" },
  { value: "tele_sales_agent", label: "TeleSales Agent", dept: "TeleSales" },
  { value: "head_account_manager", label: "Head Account Manager", dept: "Account Management" },
  { value: "account_manager", label: "Account Manager", dept: "Account Management" },
  { value: "head_technical", label: "Head Technical", dept: "Technical" },
  { value: "head_seo", label: "Head SEO", dept: "SEO" },
  { value: "team_leader_seo", label: "Team Leader SEO", dept: "SEO" },
  { value: "agent_seo", label: "SEO Agent", dept: "SEO" },
  { value: "agent_content_seo", label: "Content SEO Agent", dept: "SEO" },
  { value: "team_leader_social_media", label: "TL Social Media", dept: "Social Media" },
  { value: "agent_social_media", label: "Social Media Agent", dept: "Social Media" },
  { value: "team_leader_media_buyer", label: "TL Media Buyer", dept: "Media Buying" },
  { value: "agent_media_buyer", label: "Media Buyer Agent", dept: "Media Buying" },
  { value: "leader_graphic_designer", label: "Leader Graphic Design", dept: "Design" },
  { value: "agent_graphic_designer", label: "Graphic Designer", dept: "Design" },
  { value: "leader_motion_graphic", label: "Leader Motion Graphic", dept: "Design" },
  { value: "agent_motion_graphic", label: "Motion Designer", dept: "Design" },
  { value: "leader_ui", label: "Leader UI/UX", dept: "Design" },
  { value: "agent_ui", label: "UI/UX Designer", dept: "Design" },
  { value: "hr_manager", label: "HR Manager", dept: "HR" },
  { value: "accountant", label: "Accountant", dept: "Finance" },
];

const DEPARTMENTS = ["Administration", "Sales", "TeleSales", "Account Management", "Technical", "SEO", "Social Media", "Media Buying", "Design", "HR", "Finance"];

function getRoleLabel(roleValue: string) {
  return ALL_ROLES.find(r => r.value === roleValue)?.label || roleValue.replace(/_/g, " ");
}

function getRoleDept(roleValue: string) {
  return ALL_ROLES.find(r => r.value === roleValue)?.dept || "Other";
}

export default function HrClient({ isManager, myTodayAttendance, history, employees }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("attendance");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const goToEmployees = (status: string) => {
    setStatusFilter(status);
    setActiveTab("employees");
  };

  const handleAttendance = async (action: "checkIn" | "checkOut") => {
    setLoading(true);
    await submitAttendance({ action });
    setLoading(false);
    router.refresh();
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.target as HTMLFormElement);
    await createEmployee({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role: form.get("role"),
      phone: form.get("phone") || null,
      level: form.get("level") || "Junior",
      directManagerId: form.get("directManagerId") || null,
      company: form.get("company") || null,
      baseSalary: form.get("baseSalary") || 0,
      monthlyTarget: form.get("monthlyTarget") || 0,
      status: form.get("status") || "Active",
    });
    setLoading(false);
    setShowAddForm(false);
    router.refresh();
  };

  const handleDeduction = async (attendanceId: string, action: "approve" | "reject") => {
    setLoading(true);
    await updateAttendance({ id: attendanceId, action });
    setLoading(false);
    router.refresh();
  };

  const handleToggleStatus = async (empId: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    if (!confirm(`Are you sure you want to mark this employee as ${newStatus}?`)) return;
    setLoading(true);
    await updateEmployee({ id: empId, status: newStatus });
    setLoading(false);
    router.refresh();
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.target as HTMLFormElement);
    await updateEmployee({
      id: editEmployee.id,
      name: form.get("name"),
      role: form.get("role"),
      phone: form.get("phone") || null,
      level: form.get("level") || undefined,
      directManagerId: form.get("directManagerId") || null,
      company: form.get("company") || null,
      baseSalary: form.get("baseSalary") ?? undefined,
      monthlyTarget: form.get("monthlyTarget") ?? undefined,
    });
    setLoading(false);
    setEditEmployee(null);
    router.refresh();
  };

  // Filter employees
  const filteredEmployees = (employees || []).filter((emp: any) => {
    const matchSearch = !searchQuery || emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDept = deptFilter === "all" || getRoleDept(emp.role) === deptFilter;
    const matchStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  // Department stats
  const deptStats = DEPARTMENTS.map(dept => ({
    name: dept,
    count: (employees || []).filter((e: any) => getRoleDept(e.role) === dept).length,
    active: (employees || []).filter((e: any) => getRoleDept(e.role) === dept && e.status === "Active").length,
  })).filter(d => d.count > 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {isManager && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button onClick={() => goToEmployees("all")} className={`text-left bg-white p-5 rounded-2xl border shadow-sm transition hover:shadow-md ${activeTab === "employees" && statusFilter === "all" ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"}`}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Total Employees</p>
            <p className="text-3xl font-black text-gray-900">{employees?.length || 0}</p>
          </button>
          <button onClick={() => goToEmployees("Active")} className={`text-left bg-emerald-50 p-5 rounded-2xl border shadow-sm transition hover:shadow-md ${activeTab === "employees" && statusFilter === "Active" ? "border-emerald-600 ring-1 ring-emerald-600" : "border-emerald-200"}`}>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Active</p>
            <p className="text-3xl font-black text-emerald-700">{employees?.filter((e: any) => e.status === "Active").length || 0}</p>
          </button>
          <button onClick={() => goToEmployees("Inactive")} className={`text-left bg-red-50 p-5 rounded-2xl border shadow-sm transition hover:shadow-md ${activeTab === "employees" && statusFilter === "Inactive" ? "border-red-600 ring-1 ring-red-600" : "border-red-200"}`}>
            <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2">Inactive</p>
            <p className="text-3xl font-black text-red-700">{employees?.filter((e: any) => e.status === "Inactive").length || 0}</p>
          </button>
          <button onClick={() => setActiveTab("departments")} className={`text-left bg-blue-50 p-5 rounded-2xl border shadow-sm transition hover:shadow-md ${activeTab === "departments" ? "border-blue-600 ring-1 ring-blue-600" : "border-blue-200"}`}>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Departments</p>
            <p className="text-3xl font-black text-blue-700">{deptStats.length}</p>
          </button>
        </div>
      )}

      {/* Tabs */}
      {isManager && (
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab("attendance")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "attendance" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
            📅 Attendance
          </button>
          <button onClick={() => setActiveTab("employees")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "employees" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
            👥 Employees
          </button>
          <button onClick={() => setActiveTab("departments")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "departments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
            🏢 Departments
          </button>
          <button onClick={() => setActiveTab("promotion")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "promotion" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
            🏆 Promotion Engine
          </button>
          <button onClick={() => setActiveTab("documents")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "documents" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
            📄 Employee Documents
          </button>
        </div>
      )}

      {/* PROMOTION ENGINE TAB */}
      {isManager && activeTab === "promotion" && <PromotionEngineTab />}

      {/* DOCUMENTS TAB */}
      {isManager && activeTab === "documents" && <DocumentsTab employees={employees || []} />}

      {/* ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Today&apos;s Attendance</h2>
              {myTodayAttendance ? (
                <p className="text-sm text-gray-500">
                  Checked in at: {new Date(myTodayAttendance.checkIn).toLocaleTimeString()}
                  {myTodayAttendance.checkOut && ` • Checked out at: ${new Date(myTodayAttendance.checkOut).toLocaleTimeString()}`}
                </p>
              ) : (
                <p className="text-sm text-gray-500">You haven&apos;t checked in yet today.</p>
              )}
            </div>
            <div className="flex gap-4">
              <button 
                disabled={loading || !!myTodayAttendance} 
                onClick={() => handleAttendance("checkIn")}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition"
              >
                Check In
              </button>
              <button 
                disabled={loading || !myTodayAttendance || !!myTodayAttendance.checkOut} 
                onClick={() => handleAttendance("checkOut")}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg disabled:opacity-50 transition"
              >
                Check Out
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isManager && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delay (Mins)</th>
                  {isManager && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deduction (SAR)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((h: any) => (
                  <tr key={h.id}>
                    {isManager && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{h.user.name} <span className="text-xs text-gray-400 capitalize">({getRoleLabel(h.user.role)})</span></td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.checkIn).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{h.checkOut ? new Date(h.checkOut).toLocaleTimeString() : <span className="text-yellow-600">Active</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">{h.lateMinutes > 0 ? h.lateMinutes : <span className="text-green-600">On Time</span>}</td>
                    {isManager && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {h.deductionDraft == null ? (
                          <span className="text-gray-400">—</span>
                        ) : h.deductionApproved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">✓ {h.deductionDraft} SAR</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-700">{h.deductionDraft} SAR</span>
                            <button onClick={() => handleDeduction(h.id, "approve")} disabled={loading} className="px-2 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50">Approve</button>
                            <button onClick={() => handleDeduction(h.id, "reject")} disabled={loading} className="px-2 py-1 text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50">Reject</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={isManager ? 6 : 4} className="px-6 py-8 text-center text-sm text-gray-500">No attendance records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPLOYEES TAB */}
      {isManager && activeTab === "employees" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {(searchQuery || deptFilter !== "all" || statusFilter !== "all") && (
              <button onClick={() => { setSearchQuery(""); setDeptFilter("all"); setStatusFilter("all"); }} className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">✕ Clear</button>
            )}
            <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition shadow-sm ml-auto">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          <p className="text-xs text-gray-400">Showing {filteredEmployees.length} of {employees?.length || 0} employees</p>

          {/* Employees Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Department</th>
                  <th className="px-6 py-3 text-left">Role</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Joined</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredEmployees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{emp.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                        {getRoleDept(emp.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{getRoleLabel(emp.role)}</td>
                    <td className="px-6 py-4 text-gray-500">{emp.email}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${emp.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{emp.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {new Date(emp.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => setEditEmployee(emp)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition" title="Edit">
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button onClick={() => handleToggleStatus(emp.id, emp.status)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition" title={emp.status === "Active" ? "Deactivate" : "Activate"}>
                        {emp.status === "Active" ? <UserX className="w-3.5 h-3.5 text-red-500" /> : <UserCheck className="w-3.5 h-3.5 text-green-500" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 italic">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTMENTS TAB */}
      {isManager && activeTab === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deptStats.map(dept => {
            const deptRoles = ALL_ROLES.filter(r => r.dept === dept.name);
            return (
              <div key={dept.name} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Briefcase className="w-5 h-5" /></div>
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{dept.active} Active</span>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{dept.count} Total</span>
                  </div>
                </div>
                <h3 className="font-bold text-gray-900 text-xl mb-3">{dept.name}</h3>
                <div className="space-y-1">
                  {deptRoles.map(role => {
                    const roleCount = (employees || []).filter((e: any) => e.role === role.value).length;
                    return (
                      <div key={role.value} className="flex justify-between items-center text-sm py-1">
                        <span className="text-gray-600">{role.label}</span>
                        <span className={`font-bold ${roleCount > 0 ? "text-gray-900" : "text-gray-300"}`}>{roleCount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Add Employee Modal ═══ */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Add New Employee</h3>
              <button onClick={() => setShowAddForm(false)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input name="name" required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Employee full name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                <input name="email" type="email" required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="employee@thamaraa.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password *</label>
                <input name="password" type="password" required minLength={6} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role *</label>
                <select name="role" required className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Select Role</option>
                  {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label} ({r.dept})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input name="phone" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Optional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Level</label>
                  <select name="level" defaultValue="Junior" className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                  <select name="status" defaultValue="Active" className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Direct Manager</label>
                <select name="directManagerId" defaultValue="" className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">— None —</option>
                  {(employees || []).filter((m: any) => m.status === "Active").map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Base Salary (SAR)</label>
                  <input name="baseSalary" type="number" min="0" step="0.01" defaultValue="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Monthly Target (SAR)</label>
                  <input name="monthlyTarget" type="number" min="0" step="0.01" defaultValue="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
                <input name="company" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Optional" />
              </div>
              <div className="pt-4 border-t flex gap-3">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">
                  {loading ? "Creating..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Promotion Engine Sub-component ═══ */}
      {/* (component definitions are below the JSX return) */}

      {/* ═══ Edit Employee Modal ═══ */}
      {editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Edit Employee</h3>
              <button onClick={() => setEditEmployee(null)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEditEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input name="name" required defaultValue={editEmployee.name} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input disabled value={editEmployee.email} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role *</label>
                <select name="role" required defaultValue={editEmployee.role} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label} ({r.dept})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input name="phone" defaultValue={editEmployee.phone || ""} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Level</label>
                  <select name="level" defaultValue={editEmployee.level || "Junior"} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Junior">Junior</option>
                    <option value="Mid">Mid</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Direct Manager</label>
                  <select name="directManagerId" defaultValue={editEmployee.directManagerId || ""} className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">— None —</option>
                    {(employees || []).filter((m: any) => m.status === "Active" && m.id !== editEmployee.id).map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role.replace(/_/g, " ")})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Base Salary (SAR)</label>
                  <input name="baseSalary" type="number" min="0" step="0.01" defaultValue={editEmployee.hrRecord?.baseSalary ?? 0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Monthly Target (SAR)</label>
                  <input name="monthlyTarget" type="number" min="0" step="0.01" defaultValue={editEmployee.hrRecord?.monthlyTarget ?? 0} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
                <input name="company" defaultValue={editEmployee.company || ""} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Optional" />
              </div>
              <div className="pt-4 border-t flex gap-3">
                <button type="button" onClick={() => setEditEmployee(null)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Promotion Engine Tab — surfaces per-employee performance evaluations
// and the spec actions: promote / warn / terminate / clear flags.
// ─────────────────────────────────────────────────────────────────────
function PromotionEngineTab() {
  const router = useRouter();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "promote" | "warn" | "terminate">("all");

  const load = useCallback(() => {
    setLoading(true);
    listPromotionEvaluations()
      .then((d: any) => setEvaluations(d.evaluations || []))
      .catch(() => setEvaluations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const runAction = async (e: any, action: string) => {
    if (action === "terminate" && !confirm(`Terminate ${e.userName}? This will mark the account inactive.`)) return;
    if (action === "promote" && !confirm(`Promote ${e.userName} to ${e.nextLevel || ""} ${e.nextRole ? `(${e.nextRole.replace(/_/g, " ")})` : ""}?`)) return;
    setBusy(e.userId);
    try {
      await runPromotionAction({ userId: e.userId, action, nextLevel: e.nextLevel, nextRole: e.nextRole });
      load();
      router.refresh();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const runAutoEval = async () => {
    if (!confirm("Run the auto-evaluation against all HrRecords? This updates promotionEligible / warningCount / terminationFlag.")) return;
    await runAutoEvaluations();
    load();
  };

  const filtered = evaluations.filter((e) => filter === "all" || e.recommendation === filter);
  const counts = {
    promote: evaluations.filter((e) => e.recommendation === "promote").length,
    warn: evaluations.filter((e) => e.recommendation === "warn").length,
    terminate: evaluations.filter((e) => e.recommendation === "terminate").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-2"><Award className="w-4 h-4"/> Eligible to Promote</p>
          <p className="text-3xl font-black text-emerald-700">{counts.promote}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Warning (50–70%)</p>
          <p className="text-3xl font-black text-amber-700">{counts.warn}</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl">
          <p className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2 flex items-center gap-2"><UserX className="w-4 h-4"/> At Risk (&lt;50%)</p>
          <p className="text-3xl font-black text-red-700">{counts.terminate}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex flex-col justify-between">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Auto-Evaluate</p>
          <button onClick={runAutoEval} className="text-xs px-3 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition">
            Run 3-Month Eval
          </button>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        {(["all", "promote", "warn", "terminate"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full font-semibold transition ${filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {f === "all" ? "All" : f === "promote" ? "Promotable" : f === "warn" ? "Warnings" : "At Risk"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Role / Level</th>
              <th className="px-4 py-3 text-center">Avg %</th>
              <th className="px-4 py-3 text-center">Months</th>
              <th className="px-4 py-3 text-center">Warnings</th>
              <th className="px-4 py-3 text-left">Recommendation</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && (<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading evaluations…</td></tr>)}
            {!loading && filtered.length === 0 && (<tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 italic">No employees in this band.</td></tr>)}
            {!loading && filtered.map((e) => (
              <tr key={e.userId} className="hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-bold text-gray-900">{e.userName}</div><div className="text-xs text-gray-500">{e.userEmail}</div></td>
                <td className="px-4 py-3 capitalize"><div>{e.role.replace(/_/g, " ")}</div><div className="text-xs text-gray-500">{e.level || "—"}</div></td>
                <td className="px-4 py-3 text-center font-bold">{e.monthsEvaluated > 0 ? `${e.avgAchievementPct.toFixed(0)}%` : "—"}</td>
                <td className="px-4 py-3 text-center">{e.monthsEvaluated}</td>
                <td className="px-4 py-3 text-center">{e.warningCount}{e.terminationFlag && <span className="ml-1 text-red-500">⚑</span>}</td>
                <td className="px-4 py-3">
                  {e.recommendation === "promote" && <span className="text-emerald-700 font-bold">Promote{e.nextLevel ? ` → ${e.nextLevel}` : ""}{e.nextRole ? ` (${e.nextRole.replace(/_/g, " ")})` : ""}</span>}
                  {e.recommendation === "warn" && <span className="text-amber-700 font-bold">Issue Warning</span>}
                  {e.recommendation === "terminate" && <span className="text-red-700 font-bold">Terminate</span>}
                  {e.recommendation === "none" && <span className="text-gray-400">No action</span>}
                  {e.recommendationReason && <div className="text-xs text-gray-500 mt-0.5">{e.recommendationReason}</div>}
                </td>
                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                  {e.recommendation === "promote" && (
                    <button disabled={busy === e.userId} onClick={() => runAction(e, "promote")} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">Promote</button>
                  )}
                  <button disabled={busy === e.userId} onClick={() => runAction(e, "warn")} className="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 disabled:opacity-50">Warn</button>
                  <button disabled={busy === e.userId} onClick={() => runAction(e, "terminate")} className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 disabled:opacity-50">Terminate</button>
                  {(e.warningCount > 0 || e.terminationFlag) && (
                    <button disabled={busy === e.userId} onClick={() => runAction(e, "clear")} className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs font-bold hover:bg-slate-300 disabled:opacity-50">Clear</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Documents Tab — HR can view, upload, and delete employee documents.
// ─────────────────────────────────────────────────────────────────────
function DocumentsTab({ employees }: { employees: any[] }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listDocuments(selectedUser === "all" ? {} : { userId: selectedUser })
      .then((d: any) => setDocs(d.documents || []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [selectedUser]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    setUploading(true);
    try {
      await createDocument({ userId: form.get("userId"), name: form.get("name"), fileUrl: form.get("fileUrl") });
      setShowUpload(false);
      load();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete document "${name}"?`)) return;
    await deleteDocument(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <FileText className="w-5 h-5 text-slate-500" />
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
          <option value="all">All employees</option>
          {employees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
        <button onClick={() => setShowUpload(true)} className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Document</th>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Uploaded</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>)}
            {!loading && docs.length === 0 && (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 italic">No documents found.</td></tr>)}
            {!loading && docs.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-900">{d.name}</td>
                <td className="px-4 py-3"><div>{d.user?.name}</div><div className="text-xs text-gray-500 capitalize">{(d.user?.role || "").replace(/_/g, " ")}</div></td>
                <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold hover:bg-blue-100">View</a>
                  <button onClick={() => handleDelete(d.id, d.name)} className="p-1.5 bg-red-50 hover:bg-red-100 rounded transition" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Upload Document</h3>
              <button onClick={() => setShowUpload(false)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Employee *</label>
                <select name="userId" required className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Select employee</option>
                  {employees.map((emp: any) => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Document Name *</label>
                <input name="name" required placeholder="Contract / CV / ID" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">File URL *</label>
                <input name="fileUrl" required type="url" placeholder="https://drive.google.com/..." className="w-full border rounded-lg px-3 py-2 text-sm" />
                <p className="text-xs text-gray-500 mt-1">Paste a shared cloud-storage link (Drive, Dropbox, S3 signed URL, etc.).</p>
              </div>
              <div className="pt-4 border-t flex gap-3">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition">
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
