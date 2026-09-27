import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, FileText } from "lucide-react";
import type { EvaluationEntry, EvaluationScore, EvaluationSuite } from "../../types/evaluation";

interface AnswerViewerProps {
  entry: EvaluationEntry;
  suite: EvaluationSuite;
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ScoreCard({ score, suite }: { score: EvaluationScore; suite: EvaluationSuite; key?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600">
            {score.judgeName}
          </div>
          <div className="mt-1 text-xs text-stone-500">{score.role}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold text-stone-950">{formatScore(score.total)}</div>
          <div className="font-mono text-[10px] text-stone-500">/ 100</div>
        </div>
      </div>
      {score.reviewStatus === "needs-review" && (
        <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>需要人工复核{score.meanConfidence !== undefined ? ` · 平均置信度 ${score.meanConfidence}` : ""}</span>
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {suite.dimensions.map((dimension) => {
          const value = score.dimensions[dimension.id];
          if (value === undefined) return null;
          return (
            <div key={dimension.id} className="flex items-center justify-between gap-3 border-t border-stone-200 pt-2 text-xs">
              <span className="text-stone-600">{dimension.name}</span>
              <span className="font-mono font-semibold text-stone-900">
                {formatScore(value)} / {dimension.max}
              </span>
            </div>
          );
        })}
      </div>
      {score.reviewReasons && score.reviewReasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] leading-5 text-amber-800">
          {score.reviewReasons.map((reason) => <li key={reason}>· {reason}</li>)}
        </ul>
      )}
      {score.comment && (
        <p className="mt-4 border-t border-stone-200 pt-3 text-sm leading-6 text-stone-700">{score.comment}</p>
      )}
    </div>
  );
}

export function AnswerViewer({ entry, suite }: AnswerViewerProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const scores = entry.scores.length > 0 ? entry.scores : [];

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(entry.answerText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_12px_30px_rgba(28,25,23,0.05)] sm:p-7">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600">Answer record</div>
          <h2 className="mt-2 break-words font-serif text-3xl leading-tight text-stone-950">{entry.displayName}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-stone-500">
            <span>{entry.groupLabel}</span>
            {entry.sourceRank && <span>原报告名次 #{entry.sourceRank}</span>}
            {entry.sourceNote && <span className="text-amber-700">有条件说明</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void copyAnswer()}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[11px] text-stone-600 transition-colors hover:bg-stone-100"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "已复制" : "复制原文"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {scores.map((score) => <ScoreCard key={score.judgeId} score={score} suite={suite} />)}
      </div>

      {entry.sourceNote && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{entry.sourceNote}</span>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-stone-200">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between bg-stone-50 px-4 py-3 text-left font-mono text-xs font-semibold text-stone-700"
        >
          <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" />原始答案</span>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-stone-500">
            {expanded ? "收起" : "展开"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </span>
        </button>
        {expanded && (
          <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap break-words bg-white p-5 font-sans text-sm leading-7 text-stone-700">{entry.answerText}</pre>
        )}
      </div>
    </section>
  );
}
