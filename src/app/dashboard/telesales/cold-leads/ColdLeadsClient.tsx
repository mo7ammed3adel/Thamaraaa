"use client";
import { useState, useEffect } from "react";
import { Plus, Link as LinkIcon, PhoneCall, User as UserIcon, Tag, Store } from "lucide-react";

interface ColdLead {
  id: string;
  name: string;
  phone: string;
  storeLink: string | null;
  niche: string | null;
  createdAt: Date;
}

export default function ColdLeadsClient({ initialLeads, agentId }: { initialLeads: ColdLead[], agentId: string }) {
  const [leads, setLeads] = useState<ColdLead[]>(initialLeads);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [storeLink, setStoreLink] = useState("");
  const [niche, setNiche] = useState("");
  
  // Niche definitions
  const [availableNiches, setAvailableNiches] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    fetch("/api/niches")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableNiches(data);
      })
      .catch(err => console.error("Failed to load niches", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return alert("Name and phone are required.");
    
    setLoading(true);
    try {
      // If a niche is provided, standardize & ensure it gets created in global list
      let finalNiche = niche;
      if (niche) {
        const nicheRes = await fetch("/api/niches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: niche })
        });
        if (nicheRes.ok) {
          const nicheData = await nicheRes.json();
          finalNiche = nicheData.niche.name;
          
          // Optimistically update dropdown if it was new
          if (!availableNiches.find(n => n.name.toLowerCase() === finalNiche.toLowerCase())) {
            setAvailableNiches(prev => [...prev, nicheData.niche].sort((a,b) => a.name.localeCompare(b.name)));
          }
        }
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          storeLink: storeLink || undefined,
          niche: finalNiche || undefined,
          classification: "Cold",
          assignedTeleAgentId: agentId,
          status: "New"
        }),
      });

      if (!res.ok) throw new Error("Failed to add lead");

      const newLead = await res.json();
      setLeads([newLead, ...leads]);
      setShowForm(false);
      setName("");
      setPhone("");
      setStoreLink("");
      setNiche("");
    } catch (err: any) {
      alert(err.message || "Failed to add lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {!showForm ? (
        <button 
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Cold Lead
        </button>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
          <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-3">New Cold Lead Details</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="E.g. Ahmed Ali"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <PhoneCall className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="E.g. +966..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store Link</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="url" 
                    value={storeLink}
                    onChange={e => setStoreLink(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="https://salla.sa/..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Niche / Industry</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    list="niche-options"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-blue-200 bg-blue-50/30 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-gray-400"
                    placeholder="Search or type to add new..."
                    autoComplete="off"
                  />
                  <datalist id="niche-options">
                    {availableNiches.map(n => (
                      <option key={n.id} value={n.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 text-sm font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? "Saving..." : "Save Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Store className="h-4 w-4 text-gray-500" /> My Added Cold Leads
          </h3>
          <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{leads.length} Total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store Link</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niche</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No cold leads added yet. Click "Add Cold Lead" above to start.
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{lead.phone}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {lead.storeLink ? (
                        <a href={lead.storeLink} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" /> Link
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {lead.niche ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{lead.niche}</span> : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                      {new Date(lead.createdAt).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
