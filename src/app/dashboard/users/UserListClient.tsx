"use client";

import { useState } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, LogIn, Search } from "lucide-react";
import { HttpError } from "@/client/transport/http";
import { impersonateUser } from "@/client/api/admin";
import { createUser, deleteUser, updateUser } from "@/client/api/users";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function UserListClient({ initialUsers, managers, companies = [], canImpersonate = false, canDelete = false }: { initialUsers: any[]; managers: any[]; companies?: any[]; canImpersonate?: boolean; canDelete?: boolean }) {
  const t = useTranslator();
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [showModal, setShowModal] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const handleImpersonate = async (user: any) => {
    setImpersonatingId(user.id);
    try {
      await impersonateUser(user.id);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Failed to access dashboard");
      setImpersonatingId(null);
    }
  };
  
  // Create User State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "sales_agent",
    level: "Junior",
    status: "Active",
    directManagerId: "",
    company: "",
    companyId: "",
    baseSalary: "",
    monthlyTarget: "",
  });

  // Edit User State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "",
    directManagerId: "",
    status: "",
    level: "",
    company: "",
    companyId: "",
  });

  // Delete confirmation state
  const [deletingUser, setDeletingUser] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newUser = await createUser(formData);
      setShowModal(false);
      setFormData({ name: "", email: "", phone: "", password: "", role: "sales_agent", level: "Junior", status: "Active", directManagerId: "", company: "", companyId: "", baseSalary: "", monthlyTarget: "" });
      setUsers([newUser, ...users]);
      router.refresh();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Error creating user");
    }
    setLoading(false);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditData({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      password: "",
      role: user.role || "",
      directManagerId: user.directManagerId || "",
      status: user.status || "Active",
      level: user.level || "Junior",
      company: user.company || "",
      companyId: user.companyId || "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updatedUser: any = await updateUser(editingUser.id, {
        name: editData.name,
        email: editData.email,
        phone: editData.phone,
        password: editData.password || undefined,
        role: editData.role,
        directManagerId: editData.directManagerId === "" ? null : editData.directManagerId,
        status: editData.status,
        level: editData.level,
        companyId: editData.companyId === "" ? null : editData.companyId,
      });
      setEditingUser(null);
      setUsers(users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
      router.refresh();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Error updating user");
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setLoading(true);

    try {
      await deleteUser(deletingUser.id);
      setUsers(users.filter(u => u.id !== deletingUser.id));
      setDeletingUser(null);
      router.refresh();
    } catch (error) {
      notify(error instanceof HttpError ? error.message : "Error deleting user");
    }
    setLoading(false);
  };

  // Filter managers to matching role if possible (simplified: just list all fetched managers)
  const availableManagers = managers;

  const availableRoles = Array.from(new Set(users.map((u) => u.role))).sort();

  const userCompanyName = (u: any) => u.companyRef?.name || u.company || "";

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesCompany =
      companyFilter === "all" ||
      (companyFilter === "none" ? !u.companyId : u.companyId === companyFilter);
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      userCompanyName(u).toLowerCase().includes(q);
    return matchesRole && matchesCompany && matchesSearch;
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
        >
          + Create New User
        </button>

        <div className="flex flex-wrap items-center gap-3 ms-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("users.searchPlaceholder")}
              className="w-64 max-w-full ps-9 pe-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 capitalize"
          >
            <option value="all">{t("users.allRoles")}</option>
            {availableRoles.map((r) => (
              <option key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t("users.allCompanies")}</option>
            {companies.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value="none">— No company —</option>
          </select>
          {(searchQuery || roleFilter !== "all" || companyFilter !== "all") && (
            <button
              onClick={() => { setSearchQuery(""); setRoleFilter("all"); setCompanyFilter("all"); }}
              className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
            >
              ✕ Clear
            </button>
          )}
          <span className="text-xs text-gray-400 whitespace-nowrap">{filteredUsers.length} of {users.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.name")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.contact")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("users.roleLevel")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.company")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.directManager")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.status")}</th>
                <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 italic">{t("users.noMatch")}</td></tr>
              )}
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {u.email}<br/><span className="text-xs text-gray-400">{u.phone || "—"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {u.role.replace(/_/g, " ")} <br/>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                      {u.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {userCompanyName(u) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">{userCompanyName(u)}</span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {u.directManager ? (
                      <span className="font-medium text-indigo-700">{u.directManager.name}</span>
                    ) : (
                      <span className="text-gray-400 italic">{t("common.unassigned")}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-end text-sm">
                    <div className="flex items-center justify-end gap-1">
                      {canImpersonate && (
                        <button
                          onClick={() => handleImpersonate(u)}
                          disabled={impersonatingId === u.id}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors disabled:opacity-50"
                          title={t("users.impersonate")}
                        >
                          <LogIn className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title={t("users.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title={t("users.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-gray-900">{t("users.create")}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="createForm" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.nameRequired")}</label>
                    <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("users.password")}</label>
                    <input required type="password" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.emailRequired")}</label>
                    <input required type="email" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.phone")}</label>
                    <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.roleRequired")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                      <option value="super_admin">{t("role.superAdmin")}</option>
                      <option value="hr_manager">{t("role.hrManager")}</option>
                      <option value="accountant">{t("role.accountant")}</option>
                      <optgroup label="Tele Sales">
                        <option value="tele_sales_manager">{t("role.teleSalesManager")}</option>
                        <option value="tele_sales_agent">{t("role.teleSalesAgent")}</option>
                      </optgroup>
                      <optgroup label="Sales">
                        <option value="chief_sales">{t("role.chiefSales")}</option>
                        <option value="sales_manager">{t("role.salesManager")}</option>
                        <option value="sales_agent">{t("telesales.salesAgent")}</option>
                      </optgroup>
                      <optgroup label="Operations & Technical">
                        <option value="head_account_manager">{t("role.headAccountManager")}</option>
                        <option value="account_manager">{t("sales.accountManager")}</option>
                        <option value="head_technical">{t("role.headTechnical")}</option>
                      </optgroup>
                      <optgroup label="SEO Team">
                        <option value="head_seo">{t("role.headSeo")}</option>
                        <option value="team_leader_seo">{t("role.tlSeo")}</option>
                        <option value="agent_seo">{t("role.agentSeo")}</option>
                        <option value="agent_content_seo">{t("role.agentContentSeo")}</option>
                      </optgroup>
                      <optgroup label="Media Buyer Team">
                        <option value="team_leader_media_buyer">{t("role.tlMedia")}</option>
                        <option value="agent_media_buyer">{t("role.agentMediaBuyer")}</option>
                      </optgroup>
                      <optgroup label="Social Media Team">
                        <option value="team_leader_social_media">{t("role.tlSocial")}</option>
                        <option value="agent_social_media">{t("role.agentSocial")}</option>
                      </optgroup>
                      <optgroup label="Design & Media">
                        <option value="leader_graphic_designer">{t("role.leaderGraphic")}</option>
                        <option value="agent_graphic_designer">{t("role.agentGraphic")}</option>
                        <option value="leader_motion_graphic">{t("role.leaderMotion")}</option>
                        <option value="agent_motion_graphic">{t("role.agentMotion")}</option>
                        <option value="leader_ui">{t("role.leaderUi")}</option>
                        <option value="agent_ui">{t("role.agentUi")}</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("users.level")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                      <option value="Intern">{t("level.intern")}</option>
                      <option value="Junior">{t("level.junior")}</option>
                      <option value="Mid">{t("level.mid")}</option>
                      <option value="Senior">{t("level.senior")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.directManager")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.directManagerId} onChange={e => setFormData({...formData, directManagerId: e.target.value})}>
                      <option value="">— Auto / None —</option>
                      {managers.map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role.replace(/_/g, " ")})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.company")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white" value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})}>
                      <option value="">— None —</option>
                      {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("users.baseSalary")}</label>
                    <input type="number" min="0" step="0.01" placeholder="0" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.baseSalary} onChange={e => setFormData({...formData, baseSalary: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("users.monthlyTarget")}</label>
                    <input type="number" min="0" step="0.01" placeholder="0" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={formData.monthlyTarget} onChange={e => setFormData({...formData, monthlyTarget: e.target.value})} />
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg">{t("common.cancel")}</button>
              <button type="submit" form="createForm" disabled={loading} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{t("users.save")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t("users.edit")}</h3>
                <p className="text-xs text-gray-500">{editingUser.name} ({editingUser.role.replace(/_/g, " ")})</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="editForm" onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.nameRequired")}</label>
                    <input required type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("users.newPassword")}</label>
                    <input type="password" placeholder={t("users.leaveBlank")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={editData.password} onChange={e => setEditData({...editData, password: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.emailRequired")}</label>
                    <input required type="email" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.phone")}</label>
                    <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("form.roleRequired")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" value={editData.role} onChange={e => setEditData({...editData, role: e.target.value})}>
                      <option value="super_admin">{t("role.superAdmin")}</option>
                      <option value="hr_manager">{t("role.hrManager")}</option>
                      <option value="accountant">{t("role.accountant")}</option>
                      <optgroup label="Tele Sales">
                        <option value="tele_sales_manager">{t("role.teleSalesManager")}</option>
                        <option value="tele_sales_agent">{t("role.teleSalesAgent")}</option>
                      </optgroup>
                      <optgroup label="Sales">
                        <option value="chief_sales">{t("role.chiefSales")}</option>
                        <option value="sales_manager">{t("role.salesManager")}</option>
                        <option value="sales_agent">{t("telesales.salesAgent")}</option>
                      </optgroup>
                      <optgroup label="Operations & Technical">
                        <option value="head_account_manager">{t("role.headAccountManager")}</option>
                        <option value="account_manager">{t("sales.accountManager")}</option>
                        <option value="head_technical">{t("role.headTechnical")}</option>
                      </optgroup>
                      <optgroup label="SEO Team">
                        <option value="head_seo">{t("role.headSeo")}</option>
                        <option value="team_leader_seo">{t("role.tlSeo")}</option>
                        <option value="agent_seo">{t("role.agentSeo")}</option>
                        <option value="agent_content_seo">{t("role.agentContentSeo")}</option>
                      </optgroup>
                      <optgroup label="Media Buyer Team">
                        <option value="team_leader_media_buyer">{t("role.tlMedia")}</option>
                        <option value="agent_media_buyer">{t("role.agentMediaBuyer")}</option>
                      </optgroup>
                      <optgroup label="Social Media Team">
                        <option value="team_leader_social_media">{t("role.tlSocial")}</option>
                        <option value="agent_social_media">{t("role.agentSocial")}</option>
                      </optgroup>
                      <optgroup label="Design & Media">
                        <option value="leader_graphic_designer">{t("role.leaderGraphic")}</option>
                        <option value="agent_graphic_designer">{t("role.agentGraphic")}</option>
                        <option value="leader_motion_graphic">{t("role.leaderMotion")}</option>
                        <option value="agent_motion_graphic">{t("role.agentMotion")}</option>
                        <option value="leader_ui">{t("role.leaderUi")}</option>
                        <option value="agent_ui">{t("role.agentUi")}</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.level")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" value={editData.level} onChange={e => setEditData({...editData, level: e.target.value})}>
                      <option value="Intern">{t("level.intern")}</option>
                      <option value="Junior">{t("level.junior")}</option>
                      <option value="Mid">{t("level.mid")}</option>
                      <option value="Senior">{t("level.senior")}</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t("common.directManager")}</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-medium" 
                    value={editData.directManagerId} 
                    onChange={e => setEditData({...editData, directManagerId: e.target.value})}
                  >
                    <option value="">-- No Direct Manager --</option>
                    {availableManagers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role.replace(/_/g, " ")})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.status")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                      <option value="Active">{t("status.active")}</option>
                      <option value="Inactive">{t("status.inactive")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.company")}</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white" value={editData.companyId} onChange={e => setEditData({...editData, companyId: e.target.value})}>
                      <option value="">— None —</option>
                      {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50">
              <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg">{t("common.cancel")}</button>
              <button type="submit" form="editForm" disabled={loading} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{t("users.saveChanges")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t("users.delete")}</h3>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete <span className="font-semibold text-gray-700">{deletingUser.name}</span>?
                <br/>This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-center gap-3 bg-gray-50">
              <button 
                type="button" 
                onClick={() => setDeletingUser(null)} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleDelete} 
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
