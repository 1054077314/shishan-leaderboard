import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, FileSearch, ShieldAlert } from "lucide-react";
import type {
  EvaluationEntry,
  EvaluationScore,
  EvaluationSuite,
} from "../../types/evaluation";

interface SuiteLeaderboardProps {
  suite: EvaluationSuite;
  selectedEntryId: string | null;
  onSelectEntry: (entry: EvaluationEntry) => void;
}

function scoreFor(entry: EvaluationEntry, judgeId: string): EvaluationScore | undefined {
  return entry.scores.find((score) => score.judgeId === judgeId);
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function SuiteLeaderboard({ suite, selectedEntryId, onSelectEntry }: SuiteLeaderboardProps) {
  const defaultJudge = suite.primaryJudgeId ?? suite.judges[0]?.id ?? "human-v1";
  const [judgeId, setJudgeId] = useState(defaultJudge);
  const activeJudgeId = suite.judges.some((judge) => judge.id === judgeId) ? judgeId : defaultJudge;

  useEffect(() => {
    setJudgeId(defaultJudge);
  }, [defaultJudge]);
  const groups = useMemo(() => {
    const byGroup = new Map<string, EvaluationEntry[]>();
    for (const entry of suite.entries) {
      const list = byGroup.get(entry.groupId) ?? [];
      list.push(entry);
      byGroup.set(entry.groupId, list);
    }
    return suite.groups
      .map((group) => ({
        ...group,
        entries: (byGroup.get(group.id) ?? []).sort((a, b) => a.sourceOrder - b.sourceOrder),
      }))
      .filter((group) => group.entries.length > 0);
  }, [suite]);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_12px_30px_rgba(28,25,23,0.05)] sm:p-7">
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">
            Evaluation board
          </div>
          <h2 className="mt-2 font-serif text-3xl leading-none text-stone-950">评测样本总览</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            每套题保留自己的评分口径和分组；不与视频斩杀线榜混合计算。
          </p>
        </div>
        {suite.judges.length > 1 && (
          <label className="flex items-center gap-2 self-start rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[11px] text-stone-600 sm:self-auto">
            <span className="uppercase tracking-[0.12em]">评审</span>
            <select
              value={activeJudgeId}
              onChange={(event) => setJudgeId(event.target.value)}
              className="max-w-[180px] border-0 bg-transparent font-medium text-stone-900 outline-none"
            >
              {suite.judges.map((judge) => (
                <option key={judge.id} value={judge.id}>
                  {judge.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {activeJudgeId === "jev" && (
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Jev 结果是自动复核信号，低置信度样本仍需人工确认；这里不把它当作独立排行榜。</span>
        </div>
      )}

      <div className="mt-6 space-y-7">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-stone-800">
                {group.label}
              </h3>
              {group.note && <span className="text-xs text-stone-500">{group.note}</span>}
            </div>
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-stone-50 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">来源 / 样本</th>
                    {suite.leaderboardMode === "source-order" && <th className="px-4 py-3 font-medium">原报告名次</th>}
                    <th className="px-4 py-3 text-right font-medium">总分</th>
                    <th className="px-4 py-3 text-right font-medium">查看</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {group.entries.map((entry) => {
                    const score = scoreFor(entry, activeJudgeId);
                    const selected = selectedEntryId === entry.id;
                    return (
                      <tr
                        key={entry.id}
                        className={`cursor-pointer transition-colors ${
                          selected ? "bg-rose-50" : "hover:bg-stone-50"
                        }`}
                        onClick={() => onSelectEntry(entry)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 font-medium text-stone-900">
                            <span>{entry.displayName}</span>
                            {score?.reviewStatus === "needs-review" && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label="需要复核" />
                            )}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-stone-500">{entry.answerRef.path}</div>
                        </td>
                        {suite.leaderboardMode === "source-order" && (
                          <td className="px-4 py-3.5 font-mono text-xs text-stone-600">
                            {entry.sourceRank ? `#${entry.sourceRank}` : "—"}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-right font-mono text-base font-semibold text-stone-950">
                          {score ? formatScore(score.total) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChevronRight className={`ml-auto h-4 w-4 ${selected ? "text-rose-600" : "text-stone-400"}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {suite.leaderboardMode === "tiers" && (
        <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-stone-500">
          <FileSearch className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>一档内部差距小于重测噪声，档内不排序；分数仅代表这一轮成品质量。</span>
        </div>
      )}
    </section>
  );
}
