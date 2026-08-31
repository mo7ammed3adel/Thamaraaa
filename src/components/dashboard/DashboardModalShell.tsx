import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type DashboardModalShellProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
  onClose: () => void;
};

export default function DashboardModalShell({
  title,
  children,
  footer,
  maxWidthClassName = "max-w-md",
  onClose,
}: DashboardModalShellProps) {
  const t = useTranslator();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl w-full ${maxWidthClassName} overflow-hidden shadow-2xl`}>
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white transition"
            aria-label={t("modal.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="p-4 border-t bg-slate-50">{footer}</div>}
      </div>
    </div>
  );
}
