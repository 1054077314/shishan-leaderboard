import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RankingPayload } from "../../../types";

export interface ToyBoardsProps {
  payload: RankingPayload | null;
}

/** 官方五档配色（byTier 键序即青铜→王者），空格位用 line-soft */
const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "king"] as const;
const TIER_STYLE: Record<(typeof TIER_ORDER)[number], string> = {
  bronze: "bg-amber-700",
  silver: "bg-stone-400",
  gold: "bg-amber-400",
  diamond: "bg-sky-500",
  king: "bg-violet-500",
};
const TIER_LABEL: Record<(typeof TIER_ORDER)[number], string> = {
  bronze: "青铜",
  silver: "白银",
  gold: "黄金",
  diamond: "钻石",
  king: "王者",
};

/** total/18 细分进度条：按官方五档分段着色，data 里没有 byTier 时整体用中性色 */
function TierBar({ byTier, total }: { byTier: Record<string, number> | null; total: number }) {
  const cells: string[] = [];
  if (byTier) {
    TIER_ORDER.forEach((t) => {
      for (let i = 0; i < (byTier[t] ?? 0); i++) cells.push(TIER_STYLE[t]);
    });
  }
  while (cells.length < total) cells.push("bg-line-soft");

  return (
    <span className="inline-flex gap-[2px] align-middle" aria-hidden="true">
      {cells.slice(0, total).map((cls, i) => (
        <span key={i} className={`h-3 w-[5px] rounded-[1px] ${cls}`} />
      ))}
    </span>
  );
}

/** 考核榜 + 赛事积分榜：全部直取 payload.boards（toy 官方原样透出） */
export const ToyBoards: React.FC<ToyBoardsProps> = ({ payload }) => {
  const boards = payload?.boards;
  const [expandedKaohe, setExpandedKaohe] = useState<Record<string, boolean>>({});
  if (!boards) return null;
  const kaohe = boards.kaohe ?? [];
  const groups = boards.standingsGroups ?? [];
  const total = boards.standingsTotal ?? [];

  const toggleKaohe = (name: string) =>
    setExpandedKaohe((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <section className="mb-20 sm:mb-28">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <h2 className="font-serif-title italic text-3xl sm:text-4xl text-ink font-normal leading-tight">
          Kaohe &amp; Standings
        </h2>
        <span className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase block mt-1">
          考核榜（官方 total/18） · 赛事积分榜（小组 WDL + 总积分） · 来源：屎山英雄榜 toy 官方
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* 考核榜 */}
        <div className="border border-stone-200 rounded-xl overflow-hidden bg-surface">
          <div className="px-4 py-3 bg-surface-soft border-b border-stone-200 font-mono-code text-xs text-ink font-semibold flex items-center justify-between gap-2">
            <span>考核榜 · {kaohe.length} 份（total/18）</span>
            <span className="hidden sm:flex items-center gap-2.5 text-[10px] font-normal text-ink-subtle">
              {TIER_ORDER.map((t) => (
                <span key={t} className="inline-flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-[1px] ${TIER_STYLE[t]}`} />
                  {TIER_LABEL[t]}
                </span>
              ))}
            </span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-mono-code text-ink-subtle uppercase border-b border-stone-100">
                <th className="py-2 px-4 font-normal w-12 text-center">#</th>
                <th className="py-2 px-2 font-normal">模型</th>
                <th className="py-2 px-2 font-normal whitespace-nowrap">日期</th>
                <th className="py-2 px-4 font-normal text-right">total/18</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {kaohe.map((k, i) => {
                const highlights = k.highlights ?? [];
                const canExpand = highlights.length > 0;
                const isExpanded = canExpand && !!expandedKaohe[k.name];
                return (
                  <React.Fragment key={k.name}>
                    <tr
                      onClick={canExpand ? () => toggleKaohe(k.name) : undefined}
                      aria-expanded={canExpand ? isExpanded : undefined}
                      className={`font-mono-code text-xs align-top ${
                        canExpand ? "cursor-pointer select-none hover:bg-surface-soft transition-colors" : ""
                      }`}
                    >
                      <td className="py-2 px-4 text-center text-ink-subtle">{i + 1}</td>
                      <td className="py-2 px-2 text-ink">
                        <div>
                          {k.name}
                          {k.disputed && (
                            <span className="ml-1.5 text-amber-700" title={k.disputed}>
                              ⚠ 成绩存疑
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <TierBar byTier={k.byTier} total={18} />
                          {k.duration && (
                            <span className="text-[10px] text-ink-subtle">{k.duration}</span>
                          )}
                        </div>
                        {k.disputed && (
                          <span className="block text-[10px] leading-relaxed text-amber-800 mt-0.5">
                            {k.disputed}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-ink-muted whitespace-nowrap">
                        {k.date ?? "—"}
                      </td>
                      <td className="py-2 px-4 text-right font-bold text-ink whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {k.total}/18
                          {canExpand &&
                            (isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-ink-subtle" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-ink-subtle" />
                            ))}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-soft">
                        <td colSpan={4} className="px-4 pb-3 pt-1">
                          <div className="text-[10px] font-mono-code text-ink-subtle uppercase tracking-wider mb-1">
                            官方战报 · {k.name}
                          </div>
                          <ul className="list-disc pl-4 space-y-1 text-[11px] font-mono-code leading-relaxed text-ink-muted marker:text-ink-subtle">
                            {highlights.map((h, hi) => (
                              <li key={hi}>{h}</li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {kaohe.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-ink-subtle font-mono-code text-xs">
                    暂无考核数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 赛事积分榜 */}
        <div className="border border-stone-200 rounded-xl overflow-hidden bg-surface">
          <div className="px-4 py-3 bg-surface-soft border-b border-stone-200 font-mono-code text-xs text-ink font-semibold">
            赛事总积分榜 · {total.length} 队
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-mono-code text-ink-subtle uppercase border-b border-stone-100">
                <th className="py-2 px-4 font-normal w-12 text-center">#</th>
                <th className="py-2 px-2 font-normal">队伍</th>
                <th className="py-2 px-2 font-normal text-center">WDL</th>
                <th className="py-2 px-4 font-normal text-right">积分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {total.map((t) => (
                <tr key={`${t.rank}-${t.name}`} className="font-mono-code text-xs">
                  <td className="py-2 px-4 text-center text-ink-subtle">{t.rank}</td>
                  <td className="py-2 px-2 text-ink">{t.name}</td>
                  <td className="py-2 px-2 text-center text-ink-muted">{t.wdl}</td>
                  <td className="py-2 px-4 text-right font-bold text-ink">{t.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 小组赛况：独立全宽一行，A–D 四组各占一列 */}
      {groups.length > 0 && (
        <div className="mt-6 border border-stone-200 rounded-xl overflow-hidden bg-surface">
          <div className="px-4 py-3 bg-surface-soft border-b border-stone-200 font-mono-code text-xs text-ink font-semibold">
            小组赛况 · {groups.length} 组
          </div>
          <div className="px-4 py-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {groups.map((g) => (
              <div key={g.group} className="text-[11px] font-mono-code">
                <div className="text-ink font-semibold mb-1">
                  {g.group} · {g.state}
                </div>
                {g.members.map((m) => (
                  <div key={m.name} className="flex justify-between text-ink-muted py-0.5">
                    <span className="truncate mr-2">{m.name}</span>
                    <span className="shrink-0">
                      {m.wdl} · {m.pts}分
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
