"use client";
import { useState, useEffect } from "react";
import { notify } from "@/components/toast";
import { Plus, Link as LinkIcon, PhoneCall, User as UserIcon, Tag, Store } from "lucide-react";
import { bulkDeleteLeads, bulkPromoteLeads, createLead } from "@/client/api/leads";
import { createNiche, listNiches } from "@/client/api/niches";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";
import { isDateInRange } from "@/lib/dateRange";

interface ColdLead {
  id: string;
  name: string;
  phone: string;
  storeLink: string | null;
  niche: string | null;
  createdAt: Date;
}

export default function ColdLeadsClient({
  initialLeads,
  agentId,
  userRole,
}: {
  initialLeads: ColdLead[];
  agentId: string;
  userRole: string;
}) {
  const [leads, setLeads] = useState<ColdLead[]>(initialLeads);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Selection
  const [selected, setSelected] = useState<string[]>([]);
  const [promoting, setPromoting] = useState(false);

  // Date Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [storeLink, setStoreLink] = useState("");
  const [niche, setNiche] = useState("");
  
  // Niche definitions
  const [availableNiches, setAvailableNiches] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    listNiches()
      .then(data => {
        if (Array.isArray(data)) setAvailableNiches(data);
      })
      .catch(err => console.error("Failed to load niches", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return notify("Name and phone are required.");
    
    setLoading(true);
    try {
      // If a niche is provided, standardize & ensure it gets created in global list
      let finalNiche = niche;
      if (niche) {
        const nicheData = await createNiche({ name: niche }) as any;
        finalNiche = nicheData.niche.name;
        
        // Optimistically update dropdown if it was new
        if (!availableNiches.find(n => n.name.toLowerCase() === finalNiche.toLowerCase())) {
          setAvailableNiches(prev => [...prev, nicheData.niche].sort((a,b) => a.name.localeCompare(b.name)));
        }
      }

      const payload: Record<string, string | undefined> = {
        name,
        phone,
        storeLink: storeLink || undefined,
        niche: finalNiche || undefined,
        classification: "Cold",
        status: "Draft",
      };

      if (userRole === "tele_sales_agent") {
        payload.assignedTeleAgentId = agentId;
      }

      const newLead = await createLead(payload) as ColdLead;
      setLeads([newLead, ...leads]);
      setShowForm(false);
      setName("");
      setPhone("");
      setStoreLink("");
      setNiche("");
    } catch (err: any) {
      notify(err.message || "Failed to add lead");
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    if (selected.length === 0) return;
    setPromoting(true);
    try {
      const data = await bulkPromoteLeads({ leadIds: selected }) as any;

      notify(data.message || `Successfully added ${data.promotedCount} to Leads!`);
      
      // Remove promoted leads from UI
      setLeads(leads.filter(l => !selected.includes(l.id)));
      setSelected([]);
    } catch (err: any) {
      notify(err.message || "Failed to promote leads");
    } finally {
      setPromoting(false);
    }
  };

  const handleDelete = async () => {
    if (selected.length === 0 || !confirm("Are you sure you want to delete these draft leads?")) return;
    setPromoting(true);
    try {
      await bulkDeleteLeads({ leadIds: selected });

      setLeads(leads.filter(l => !selected.includes(l.id)));
      setSelected([]);
    } catch (err) {
      notify("Error deleting leads");
    } finally {
      setPromoting(false);
    }
  };

  // Filter leads based on Date Range — parse YYYY-MM-DD as LOCAL day boundaries
  // (not UTC midnight) so a lead created today in the user's timezone is always included.
  const filteredLeads = leads.filter(l => {
    return isDateInRange(l.createdAt, { from: fromDate, to: toDate });
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(filteredLeads.map(l => l.id));
    } else {
      setSelected([]);
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
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 gap-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Store className="h-4 w-4 text-gray-500" /> My Added Cold Leads
          </h3>
          
          <div className="w-full sm:w-auto sm:min-w-[520px]">
            <DateRangeFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              label="Added Date Range"
              description="Filters draft cold leads by added date."
            />
          </div>
        </div>
        
        {/* Bulk Actions Header */}
        {selected.length > 0 && (
          <div className="bg-blue-50/50 border-b border-blue-100 px-5 py-3 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">{selected.length} selected</span>
                <button onClick={() => setSelected([])} className="text-xs text-slate-500 hover:text-slate-700 font-medium underline">Clear Selection</button>
             </div>
             <div className="flex gap-2">
                <button onClick={handleDelete} disabled={promoting} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition disabled:opacity-50">
                  Delete Selected
                </button>
                <button onClick={handlePromote} disabled={promoting} className="px-4 py-1.5 text-xs font-bold text-white bg-green-600 rounded hover:bg-green-700 transition shadow-sm disabled:opacity-50">
                  {promoting ? "Promoting..." : "Add to Leads"}
                </button>
             </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredLeads.length > 0 && selected.length === filteredLeads.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store Link</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niche</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No draft leads found. Add new leads above.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${selected.includes(lead.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input 
                        type="checkbox" 
                        checked={selected.includes(lead.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelected([...selected, lead.id]);
                          else setSelected(selected.filter(id => id !== lead.id));
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
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
