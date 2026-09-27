import React from "react";
import { CircleAlert, FileText, UsersRound } from "lucide-react";
import type { EvaluationSuite } from "../../types/evaluation";

interface MethodologyPanelProps {
  suite: EvaluationSuite;
}

export function MethodologyPanel({ suite }: MethodologyPanelProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Suite protocol
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-700">{suite.taskSummary}</p>
        <div className="mt-4 border-t border-stone-200 pt-4 font-mono text-[11px] leading-5 text-stone-500">
          <div>有效样本 {suite.sampleAccounting.includedCount} / 原始范围 {suite.sampleAccounting.sourceCount}</div>
          <div>展示方式 {suite.leaderboardMode}</div>
          {suite.primaryJudgeId && <div>主评审 {suite.primaryJudgeId}</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          Evaluation limits
        </div>
        <ul className="mt-3 space-y-3 text-sm leading-6 text-amber-950">
          {suite.limitations.map((limitation) => (
            <li key={limitation.code} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden="true" />
              <span>{limitation.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
          Sample accounting
        </div>
        <div className="mt-3 text-sm text-stone-700">
          仅展示有原始答案、可以核验的样本。
        </div>
        {suite.sampleAccounting.excluded.length > 0 ? (
          <ul className="mt-3 space-y-2 text-xs leading-5 text-stone-500">
            {suite.sampleAccounting.excluded.map((item) => (
              <li key={item.label}>
                <span className="font-mono text-stone-700">{item.label}</span>：{item.reason}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 font-mono text-xs text-stone-500">无剔除记录</div>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
          Source references
        </div>
        <ul className="mt-3 space-y-3">
          {suite.sourceRefs.map((ref) => (
            <li key={`${ref.kind}:${ref.path}`} className="text-xs leading-5 text-stone-600">
              <span className="font-mono text-[10px] uppercase text-rose-600">{ref.kind}</span>
              <div className="break-all font-mono text-[11px] text-stone-700">{ref.path}</div>
              <div className="font-mono text-[10px] text-stone-400">sha256 {ref.sha256.slice(0, 12)}…</div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
