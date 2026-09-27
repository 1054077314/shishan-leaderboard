import React from "react";
import { Zap, Coins, ShieldCheck, Skull } from "lucide-react";

export interface BentoStatsProps {
  onSelectHighlight: (type: "ASTRA" | "DS_FLASH" | "DIAMOND" | "KING") => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const BentoStats: React.FC<BentoStatsProps> = ({
  onSelectHighlight,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-stone-100 border border-stone-200 rounded-xl overflow-hidden mb-12 sm:mb-16">
      {/* Card 1: GPT-6 Astra */}
      <div
        onClick={() => onSelectHighlight("ASTRA")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-rose-700 font-medium">ABSOLUTE T0</span>
            <Zap className="w-3.5 h-3.5 text-ink-subtle group-hover:text-rose-700 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-ink mb-1">
            GPT-6 Astra
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          黄金 / 钻石 / 王者全<strong className="text-ink">一轮秒杀</strong>，全场唯一断层第一。
        </p>
      </div>

      {/* Card 2: DS V4.1 Flash */}
      <div
        onClick={() => onSelectHighlight("DS_FLASH")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-emerald-700 font-medium">VALUE KING</span>
            <Coins className="w-3.5 h-3.5 text-ink-subtle group-hover:text-emerald-700 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-emerald-700 mb-1">
            ¥6.10
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          狂烧 1.17 亿词元，极低总价<strong className="text-ink">一轮秒杀钻石</strong>。
        </p>
      </div>

      {/* Card 3: 钻石分水岭 */}
      <div
        onClick={() => onSelectHighlight("DIAMOND")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-amber-800 font-medium">DIAMOND CUT-OFF</span>
            <ShieldCheck className="w-3.5 h-3.5 text-ink-subtle group-hover:text-amber-800 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-ink mb-1">
            钻石分水岭
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          并发死锁、跨文件引用与上下文遗忘，<strong className="text-ink">半数模型倒在第 2 轮</strong>。
        </p>
      </div>

      {/* Card 4: 王者绝壁 */}
      <div
        onClick={() => onSelectHighlight("KING")}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="bg-surface p-5 sm:p-6 flex flex-col justify-between group hover:bg-surface-soft transition-colors cursor-pointer"
      >
        <div>
          <div className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase mb-3 flex items-center justify-between">
            <span className="text-rose-700 font-medium">THE EXECUTIONER</span>
            <Skull className="w-3.5 h-3.5 text-ink-subtle group-hover:text-rose-700 transition-colors" />
          </div>
          <div className="font-serif-title text-2xl sm:text-3xl text-ink mb-1">
            王者绝壁
          </div>
        </div>
        <p className="text-xs text-ink-muted font-light border-t border-stone-200 pt-3 mt-4">
          一票否决级题目，<strong className="text-ink">仅 3 款模型</strong>曾攻破（Astra / Grok / V4 Pro）。
        </p>
      </div>
    </section>
  );
};
