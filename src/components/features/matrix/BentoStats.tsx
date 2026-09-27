import React from "react";
import { Trophy, ClipboardCheck, Swords, Crown } from "lucide-react";
import { RankingPayload } from "../../../types";

export interface BentoStatsProps {
  payload: RankingPayload | null;
  onSelectHighlight: (type: "ASTRA" | "DS_FLASH" | "DIAMOND" | "KING") => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/** 顶览四卡：全部取自 payload.boards（toy 官方），无官方考核的模型不编造分数 */
export const BentoStats: React.FC<BentoStatsProps> = ({
  payload,
  onSelectHighlight,
  onMouseEnter,
  onMouseLeave,
}) => {
  const boards = payload?.boards;
  const ladder = boards?.ladder ?? [];
  const kaohe = boards?.kaohe ?? [];
  const total = boards?.standingsTotal ?? [];
  const champ = ladder[0];
  const kaoheTop = kaohe[0];
  const ptsTop = total[0];

  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-100 border border-stone-200 rounded-xl overflow-hidden mb-12 sm:mb-16">
      {/* Card 1: 挑战榜榜首 */}
      <div
        onClick={() => onSelectHighlight("ASTRA")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-rose-700 font-medium">CHALLENGE #1</span>
            <Trophy className="w-3.5 h-3.5 text-ink-subtle group-hover:text-rose-700 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-ink mb-1">
            {champ?.name ?? "—"}
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          挑战榜第 1 名 · 官方名次即排名
        </p>
      </div>

      {/* Card 2: 考核榜榜首 */}
      <div
        onClick={() => onSelectHighlight("DS_FLASH")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-emerald-700 font-medium">KAOHE TOP</span>
            <ClipboardCheck className="w-3.5 h-3.5 text-ink-subtle group-hover:text-emerald-700 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-emerald-700 mb-1">
            {kaoheTop ? `${kaoheTop.total}/18` : "—"}
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          考核榜榜首<strong className="text-ink">{kaoheTop?.name ?? "—"}</strong> · 官方 total/18
        </p>
      </div>

      {/* Card 3: 赛事积分榜首 */}
      <div
        onClick={() => onSelectHighlight("DIAMOND")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-amber-800 font-medium">STANDINGS #1</span>
            <Swords className="w-3.5 h-3.5 text-ink-subtle group-hover:text-amber-800 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-ink mb-1">
            {ptsTop?.name ?? "—"}
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          赛事积分榜首 · <strong className="text-ink">{ptsTop ? `${ptsTop.pts} 分（${ptsTop.wdl}）` : "—"}</strong>
        </p>
      </div>

      {/* Card 4: 三榜规模 */}
      <div
        onClick={() => onSelectHighlight("KING")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-rose-700 font-medium">BOARDS</span>
            <Crown className="w-3.5 h-3.5 text-ink-subtle group-hover:text-rose-700 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-ink mb-1">
            {ladder.length}/{kaohe.length}/{total.length}
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          挑战榜 / 考核榜 / 赛事积分 · 来源屎山英雄榜 toy 官方
        </p>
      </div>
    </section>
  );
};
