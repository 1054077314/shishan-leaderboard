import React, { useState } from "react";
import { ModelService } from "../../../services/modelService";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export interface CostVisualizerProps {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const CostVisualizer: React.FC<CostVisualizerProps> = ({
  onMouseEnter,
  onMouseLeave,
}) => {
  const [showAll, setShowAll] = useState(false);

  // Top 3 primary official settlement benchmarks (Episode 09-12 canonical audit)
  const costData = ModelService.getCostData();
  const primaryCosts = costData.slice(0, 3);
  // Additional historical & reference benchmarks
  const secondaryCosts = costData.slice(3);

  return (
    <section className="mb-20 sm:mb-28">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-stone-200 pb-4 mb-6 gap-2">
        <div>
          <h2 className="font-serif-title italic text-3xl sm:text-4xl text-ink font-normal leading-tight">
            The Cost of Truth
          </h2>
          <span className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase block mt-1">
            确切 Token 账单与官方花费结算 · 真实能效对照
          </span>
        </div>

        {/* Toggle more records */}
        <button
          onClick={() => setShowAll((prev) => !prev)}
          className="inline-flex items-center gap-1.5 font-mono-code text-xs text-ink-muted hover:text-ink transition-colors self-start sm:self-auto py-1 px-2.5 rounded bg-stone-50 border border-stone-200 cursor-pointer"
        >
          <span>{showAll ? "收起扩展明细" : "展开更多实战账单"}</span>
          {showAll ? (
            <ChevronUp className="w-3 h-3 text-ink-subtle" />
          ) : (
            <ChevronDown className="w-3 h-3 text-ink-subtle" />
          )}
        </button>
      </div>

      {/* Main Canonical 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        {primaryCosts.map((item) => {
          const isValueKing = item.id === "ds-v41-flash";
          const isExpensive = item.id === "gemini-38" || item.badge === "EXPENSIVE";

          return (
            <div
              key={item.id}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              className={`p-6 rounded-xl border transition-all flex flex-col justify-between ${
                isValueKing
                  ? "border-emerald-300 bg-emerald-50 shadow-[0_10px_24px_rgba(4,120,87,0.08)]"
                  : isExpensive
                  ? "border-amber-200 bg-amber-50"
                  : "border-stone-200 bg-surface hover:border-stone-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 font-mono-code text-xs">
                  <span className="text-ink-muted font-semibold">{item.model}</span>
                  {isValueKing ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> 极致性价比王
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-stone-50 text-ink-muted text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mb-4">
                  <div
                    className={`font-serif-title text-4xl font-normal ${
                      isValueKing ? "text-emerald-700 font-bold" : "text-ink"
                    }`}
                  >
                    {item.cost}
                  </div>
                  <span className="font-mono-code text-xs text-ink-subtle">
                    {item.source}
                  </span>
                </div>

                <div className="space-y-2 border-t border-stone-200 pt-4 font-mono-code text-xs">
                  <div className="flex justify-between text-ink-muted">
                    <span>消耗 Token:</span>
                    <span className="text-ink font-bold">{item.tokens}</span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>实测能效评级:</span>
                    <span className="text-ink-muted font-bold">{item.efficiencyRating} 级</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-stone-100 text-[11px] text-ink-subtle italic">
                {item.verdict}
              </div>
            </div>
          );
        })}
      </div>

      {/* Extended Cost Records (Collapsible) */}
      {showAll && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 animate-fadeIn">
          {secondaryCosts.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-stone-200 bg-surface-soft hover:border-stone-300 transition-all font-mono-code text-xs"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-ink">{item.model}</span>
                <span className="text-ink-subtle text-[10px]">{item.badge}</span>
              </div>
              <div className="text-lg font-serif-title text-ink mb-2">
                {item.cost}
                <span className="text-xs font-mono-code text-ink-subtle ml-1.5">
                  ({item.source})
                </span>
              </div>
              <div className="text-ink-muted text-[11px] space-y-1">
                <div>Token 吞吐: {item.tokens}</div>
                <div>战果评价: {item.verdict}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
