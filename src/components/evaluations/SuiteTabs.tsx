import React from "react";
import { BookOpen, CircleAlert, FlaskConical } from "lucide-react";
import type { EvaluationSuite } from "../../types/evaluation";

interface SuiteTabsProps {
  suites: EvaluationSuite[];
  activeSuiteId: string;
  onSelect: (suiteId: string) => void;
}

export function SuiteTabs({ suites, activeSuiteId, onSelect }: SuiteTabsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-5" role="tablist" aria-label="评测套题">
      {suites.map((suite) => {
        const active = suite.id === activeSuiteId;
        const hasWarning = suite.limitations.some((item) =>
          ["non-blind", "non-blind-sample", "input-different", "prompt-missing"].includes(item.code)
        );
        return (
          <button
            key={suite.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(suite.id)}
            className={`group min-h-[132px] rounded-2xl border p-4 text-left transition-all ${
              active
                ? "border-rose-300 bg-white shadow-[0_12px_30px_rgba(28,25,23,0.08)]"
                : "border-stone-200 bg-stone-50/70 hover:border-stone-300 hover:bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-rose-600">
                SUITE {suite.ordinal}
              </span>
              {hasWarning ? (
                <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-label="有限制条件" />
              ) : (
                <FlaskConical className="h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
              )}
            </div>
            <div className="mt-4 text-sm font-semibold leading-5 text-stone-900">{suite.title}</div>
            <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              <span>{suite.sampleAccounting.includedCount} 份有效样本</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
