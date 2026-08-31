import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "متابعة مشروعك | ثمرة",
  description: "تابع تقدّم العمل على مشروعك ومدفوعاتك",
};

/**
 * Client Portal shell — deliberately shares nothing with the employee dashboard
 * layout: no sidebar, no notifications, no warning popups, no employee session.
 */
export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      {children}
    </div>
  );
}
