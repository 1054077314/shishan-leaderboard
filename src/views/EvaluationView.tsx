import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { EvaluationEntry } from "../types/evaluation";
import { useEvaluationData } from "../services/evaluationSource";
import { SuiteTabs } from "../components/evaluations/SuiteTabs";
import { SuiteLeaderboard } from "../components/evaluations/SuiteLeaderboard";
import { MethodologyPanel } from "../components/evaluations/MethodologyPanel";
import { AnswerViewer } from "../components/evaluations/AnswerViewer";

export default function EvaluationView() {
  const { data, loading, error, refresh } = useEvaluationData();
  const [activeSuiteId, setActiveSuiteId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<EvaluationEntry | null>(null);

  const activeSuite = useMemo(() => {
    if (!data) return null;
    return data.suites.find((suite) => suite.id === activeSuiteId) ?? data.suites[0] ?? null;
  }, [data, activeSuiteId]);

  useEffect(() => {
    setSelectedEntry(null);
  }, [activeSuite?.id]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 antialiased">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="border-b border-stone-300 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-600">
                Answer evaluation archive
              </div>
              <h1 className="mt-3 font-serif text-4xl leading-none text-stone-950 sm:text-5xl">题答评测</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
                0824 题答集的五套人工/自动评测快照。与「屎山论剑」视频斩杀线榜相互独立：不合并分数、不计算跨榜综合名次。
              </p>
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <span className="font-mono text-[10px] text-stone-500">
                  {data.dataVersion.slice(0, 18)}…
                </span>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 font-mono text-[11px] text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                {loading ? "加载中" : "刷新快照"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm leading-6 text-rose-950">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">
              Snapshot unavailable
            </div>
            <p className="mt-2">
              无法加载 evaluationData.json：{error}。请在 20260914 目录执行 npm run evaluation:rebuild 生成快照后重试。
            </p>
          </div>
        )}

        {!error && loading && !data && (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-10 text-center font-mono text-xs text-stone-500">
            正在加载评测快照…
          </div>
        )}

        {!error && data && activeSuite && (
          <>
            <div className="mt-8">
              <SuiteTabs
                suites={data.suites}
                activeSuiteId={activeSuite.id}
                onSelect={(id) => {
                  setActiveSuiteId(id);
                  setSelectedEntry(null);
                }}
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                <SuiteLeaderboard
                  suite={activeSuite}
                  selectedEntryId={selectedEntry?.id ?? null}
                  onSelectEntry={setSelectedEntry}
                />
                {selectedEntry ? (
                  <AnswerViewer entry={selectedEntry} suite={activeSuite} />
                ) : (
                  activeSuite.leaderboardMode === "single-result" && (
                    <AnswerViewer entry={activeSuite.entries[0]} suite={activeSuite} />
                  )
                )}
              </div>
              <MethodologyPanel suite={activeSuite} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
