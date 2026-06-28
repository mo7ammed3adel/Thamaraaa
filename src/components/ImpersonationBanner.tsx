"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { notify } from "@/components/toast";
import { stopImpersonation } from "@/client/api/admin";

export default function ImpersonationBanner({
  name,
  role,
}: {
  name?: string | null;
  role?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const exit = async () => {
    setLoading(true);
    try {
      await stopImpersonation();
      router.push("/dashboard");
      router.refresh();
    } catch {
      notify("Failed to exit impersonation");
      setLoading(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] bg-amber-500 text-black px-4 py-2 flex flex-wrap items-center justify-center gap-3 shadow-md text-sm font-semibold">
      <Eye className="h-4 w-4" />
      <span>
        Viewing as <strong>{name}</strong>
        {role ? ` (${role.replace(/_/g, " ")})` : ""} — actions you take affect this user.
      </span>
      <button
        onClick={exit}
        disabled={loading}
        className="px-3 py-1 bg-black/85 text-white rounded-md text-xs font-bold hover:bg-black disabled:opacity-50 transition"
      >
        {loading ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}
