/** Personal chat labels — shared by server validation and the UI. */

export const MAX_LABELS = 30;
export const MAX_LABEL_NAME = 30;

/** Palette keys; the UI maps each to its colours. */
export const LABEL_COLORS = ["emerald", "sky", "amber", "rose", "violet", "teal", "orange", "pink", "lime", "slate"] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

/** Tailwind classes per colour: dot, chip (idle) and chip (selected). */
export const LABEL_STYLES: Record<LabelColor, { dot: string; chip: string; active: string }> = {
  emerald: { dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", active: "bg-emerald-500 text-white ring-emerald-400" },
  sky: { dot: "bg-sky-500", chip: "bg-sky-500/10 text-sky-300 ring-sky-500/30", active: "bg-sky-500 text-white ring-sky-400" },
  amber: { dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-300 ring-amber-500/30", active: "bg-amber-500 text-white ring-amber-400" },
  rose: { dot: "bg-rose-500", chip: "bg-rose-500/10 text-rose-300 ring-rose-500/30", active: "bg-rose-500 text-white ring-rose-400" },
  violet: { dot: "bg-violet-500", chip: "bg-violet-500/10 text-violet-300 ring-violet-500/30", active: "bg-violet-500 text-white ring-violet-400" },
  teal: { dot: "bg-teal-500", chip: "bg-teal-500/10 text-teal-300 ring-teal-500/30", active: "bg-teal-500 text-white ring-teal-400" },
  orange: { dot: "bg-orange-500", chip: "bg-orange-500/10 text-orange-300 ring-orange-500/30", active: "bg-orange-500 text-white ring-orange-400" },
  pink: { dot: "bg-pink-500", chip: "bg-pink-500/10 text-pink-300 ring-pink-500/30", active: "bg-pink-500 text-white ring-pink-400" },
  lime: { dot: "bg-lime-500", chip: "bg-lime-500/10 text-lime-300 ring-lime-500/30", active: "bg-lime-500 text-slate-900 ring-lime-400" },
  slate: { dot: "bg-slate-400", chip: "bg-slate-400/10 text-slate-300 ring-slate-400/30", active: "bg-slate-400 text-white ring-slate-300" },
};

export function labelStyle(color: string) {
  return LABEL_STYLES[(LABEL_COLORS as readonly string[]).includes(color) ? (color as LabelColor) : "slate"];
}
