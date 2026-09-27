import React from "react";
import { BarChart3, ClipboardCheck } from "lucide-react";

export type AppView = "kill-line" | "evaluation";

interface ViewSwitcherProps {
  activeView: AppView;
  onChange: (view: AppView) => void;
}

export function AppViewSwitcher({ activeView, onChange }: ViewSwitcherProps) {
  return (
    <nav
      aria-label="主导航"
      className="relative mx-auto mb-3 flex w-fit items-center gap-1 rounded-xl border border-stone-300 bg-white/95 p-1 text-stone-600 shadow-[0_12px_30px_rgba(28,25,23,0.12)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => onChange("kill-line")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
          activeView === "kill-line"
            ? "bg-stone-900 text-white"
            : "hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
        斩杀线榜
      </button>
      <button
        type="button"
        onClick={() => onChange("evaluation")}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
          activeView === "evaluation"
            ? "bg-rose-700 text-white"
            : "hover:bg-stone-100 hover:text-stone-900"
        }`}
      >
        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
        题答评测
      </button>
    </nav>
  );
}
