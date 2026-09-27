import React from "react";
import { RankingPayload } from "../../../types";

export interface ToyBoardsProps {
  payload: RankingPayload | null;
}

/** 考核榜 + 赛事积分榜：全部直取 payload.boards（toy 官方原样透出） */
export const ToyBoards: React.FC<ToyBoardsProps> = ({ payload }) => {
  const boards = payload?.boards;
  if (!boards) return null;
  const kaohe = boards.kaohe ?? [];
  const groups = boards.standingsGroups ?? [];
  const total = boards.standingsTotal ?? [];

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 考核榜 */}
        <div className="border border-stone-200 rounded-xl overflow-hidden bg-surface">
          <div className="px-4 py-3 bg-surface-soft border-b border-stone-200 font-mono-code text-xs text-ink font-semibold">
            考核榜 · {kaohe.length} 份（total/18）
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-mono-code text-ink-subtle uppercase border-b border-stone-100">
                <th className="py-2 px-4 font-normal w-12 text-center">#</th>
                <th className="py-2 px-2 font-normal">模型</th>
                <th className="py-2 px-4 font-normal text-right">total/18</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {kaohe.map((k, i) => (
                <tr key={k.name} className="font-mono-code text-xs">
                  <td className="py-2 px-4 text-center text-ink-subtle">{i + 1}</td>
                  <td className="py-2 px-2 text-ink">{k.name}</td>
                  <td className="py-2 px-4 text-right font-bold text-ink">{k.total}/18</td>
                </tr>
              ))}
              {kaohe.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-ink-subtle font-mono-code text-xs">
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
          {/* 小组赛况 */}
          {groups.length > 0 && (
            <div className="px-4 py-3 border-t border-stone-200 grid gap-3 sm:grid-cols-2">
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
          )}
        </div>
      </div>
    </section>
  );
};
