"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Responsive app shell.
 * - Desktop (lg+): sidebar is a static column, always visible (unchanged layout).
 * - Mobile/tablet (< lg): sidebar becomes an off-canvas drawer toggled by a
 *   hamburger button in the header, with a tap-to-dismiss backdrop.
 */
export default function DashboardShell({
  nav,
  footer,
  headerActions,
  children,
}: {
  nav: React.ReactNode;
  footer: React.ReactNode;
  headerActions: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (e.g. after tapping a nav link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col transform transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <span className="text-xl font-bold text-white tracking-wide">Thamaraa ERP</span>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {/* Header */}
        <div className="h-16 flex items-center gap-3 px-4 sm:px-6 border-b border-gray-200 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden -ml-1 p-2 text-gray-600 hover:text-gray-900"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3 ml-auto">{headerActions}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
