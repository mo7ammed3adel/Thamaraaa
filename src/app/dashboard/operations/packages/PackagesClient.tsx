"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPackage, listPackages } from "@/client/api/packages";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface PackageData {
  id: string;
  name: string;
  servicesJson: string;
  createdAt: string;
}

/**
 * Client component for managing packages and services configuration.
 * Allows creating new packages and viewing existing ones.
 */
export default function PackagesClient() {
  const t = useTranslator();
  const router = useRouter();
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newServices, setNewServices] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  /**
   * Fetches all packages from the API.
   */
  async function fetchPackages() {
    try {
      const data = await listPackages();
      setPackages(data as PackageData[]);
    } catch (error) {
      console.error("Failed to fetch packages:", error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Creates a new package with the specified name and services.
   */
  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);

    const servicesArray = newServices
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await createPackage({
        name: newName.trim(),
        servicesJson: JSON.stringify(servicesArray),
      });
      setNewName("");
      setNewServices("");
      setShowCreate(false);
      fetchPackages();
    } catch (error) {
      console.error("Failed to create package:", error);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Parses the JSON services string into an array safely.
   */
  function parseServices(json: string): string[] {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("nav.packagesSettings")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage service packages that map to projects and task generation.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
        >
          {showCreate ? "Cancel" : "+ New Package"}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">{t("ops.createPackage")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Package Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("ops.packageNameExample")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Services (comma-separated)
              </label>
              <input
                type="text"
                value={newServices}
                onChange={(e) => setNewServices(e.target.value)}
                placeholder={t("ops.servicesExample")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
            >
              {saving ? "Saving..." : "Create Package"}
            </button>
          </div>
        </div>
      )}

      {/* Packages List */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Package Name
              </th>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Services Included
              </th>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {packages.map((pkg) => {
              const services = parseServices(pkg.servicesJson);
              return (
                <tr key={pkg.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                      {pkg.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {services.map((service, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium capitalize"
                        >
                          {service}
                        </span>
                      ))}
                      {services.length === 0 && (
                        <span className="text-xs text-slate-400 italic">{t("ops.noServices")}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(pkg.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
            {packages.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-400 italic">
                  No packages configured yet. Click &quot;+ New Package&quot; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
