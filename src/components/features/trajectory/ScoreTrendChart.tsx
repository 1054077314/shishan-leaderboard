import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrajectoryService } from "../../../services/trajectoryService";
import { ModelHistoryData } from "../../../data/realBattlefieldData";
import { KillLineRecord } from "../../../types";
import { Badge } from "../../ui/Badge";
import {
  TrendingUp,
  SlidersHorizontal,
  RotateCcw,
  Layers,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Film,
  Sparkles,
} from "lucide-react";

export interface ScoreTrendChartProps {
  selectedModel?: KillLineRecord;
  onSelectModel?: (modelId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  selectedModel,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [displayMode, setDisplayMode] = useState<"REAL_ONLY" | "FULL_EXTRAPOLATED">("REAL_ONLY");
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [hoveredModelId, setHoveredModelId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<"ALL" | "FLAGSHIP" | "FLASH">("ALL");
  const [showCutoffLines] = useState<boolean>(true);
  const [showPresenceMatrix, setShowPresenceMatrix] = useState<boolean>(false);

  const modelHistories = useMemo(() => TrajectoryService.getModelHistories(), []);
  const episodesMeta = useMemo(() => TrajectoryService.getEpisodesMeta(), []);

  React.useEffect(() => {
    if (selectedModel?.id && modelHistories[selectedModel.id]) {
      setActiveModelId(selectedModel.id);
    }
  }, [selectedModel?.id, modelHistories]);

  // Models filtered by tier via TrajectoryService
  const visibleModels = useMemo(() => {
    return TrajectoryService.getFilteredModels(tierFilter);
  }, [tierFilter]);

  // Chart data generated via TrajectoryService
  const chartData = useMemo(() => {
    return TrajectoryService.generateChartData(displayMode);
  }, [displayMode]);

  const currentHighlightId = hoveredModelId || activeModelId;
  const highlightModel = currentHighlightId ? modelHistories[currentHighlightId] : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      const episodeRankings = visibleModels
        .map((m) => {
          const isTested = data[`${m.modelId}_tested`] as boolean;
          const score = data[m.modelId] as number | null;
          const result = data[`${m.modelId}_result`] as string;
          const note = data[`${m.modelId}_note`] as string;
          const bvid = data[`${m.modelId}_bvid`] as string;
          return {
            model: m,
            score,
            isTested,
            result,
            note,
            bvid,
          };
        })
        .filter((item) => item.score !== null)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      const targetModel = highlightModel || episodeRankings[0]?.model;
      const targetRecord = targetModel
        ? {
            score: data[targetModel.modelId],
            isTested: data[`${targetModel.modelId}_tested`],
            result: data[`${targetModel.modelId}_result`],
            note: data[`${targetModel.modelId}_note`],
            bvid: data[`${targetModel.modelId}_bvid`],
          }
        : null;

      return (
        <div className="bg-white/95 backdrop-blur-xl border border-stone-300 p-3.5 rounded-xl shadow-[0_12px_34px_rgba(28,25,23,0.14)] font-mono-code text-xs max-w-sm z-50 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-300 gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-ink text-[13px]">{data.title}</span>
              </div>
              <span className="text-[10px] text-ink-muted font-sans block mt-0.5">
                主题: {data.topic} · <strong className="text-amber-800/90">{data.difficulty}</strong>
              </span>
            </div>
            <a
              href={`https://www.bilibili.com/video/${data.bvid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-0.8 rounded bg-bilibili/20 hover:bg-bilibili/30 text-bilibili border border-bilibili/40 flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Film className="w-2.5 h-2.5" />
              <span>原片</span>
            </a>
          </div>

          {/* Model Rankings List in this Episode */}
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            <div className="text-[10px] text-ink-subtle uppercase flex items-center justify-between pb-1">
              <span>{displayMode === "REAL_ONLY" ? "该期真实实测模型" : "该期战力排行榜"}</span>
              <span className="text-ink-muted">实测成绩</span>
            </div>

            {episodeRankings.length === 0 ? (
              <div className="text-ink-subtle text-[11px] py-2 text-center">
                该期无所选类别的模型参测
              </div>
            ) : (
              episodeRankings.map((item, index) => {
                const isItemHighlighted = currentHighlightId === item.model.modelId;
                return (
                  <div
                    key={item.model.modelId}
                    className={`flex justify-between items-center py-1 px-2 rounded transition-colors ${
                      isItemHighlighted
                        ? "bg-stone-200 text-ink font-semibold"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[10px] text-ink-subtle w-3">{index + 1}.</span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.model.color }}
                      />
                      <span className="text-ink truncate">{item.model.modelName}</span>
                      {item.isTested ? (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold">
                          实测 {item.result}
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-stone-100 text-ink-muted">
                          推导
                        </span>
                      )}
                    </div>
                    <span className="font-bold shrink-0 ml-2" style={{ color: item.model.color }}>
                      {item.score !== null ? item.score.toFixed(1) : "--"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Contextual Battle Note */}
          {targetRecord?.note && (
            <div className="pt-2.5 mt-2.5 border-t border-stone-200 text-[11px] leading-relaxed">
              <div className="text-[10px] text-ink-muted mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: targetModel?.color }}
                  />
                  <span className="text-ink font-semibold">{targetModel?.modelName}</span>
                  <span>战况实录:</span>
                </div>
                {targetRecord.isTested ? (
                  <span className="text-[9px] text-emerald-700 font-mono-code flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> 真实出镜
                  </span>
                ) : (
                  <span className="text-[9px] text-ink-subtle font-mono-code">
                    本期未出镜
                  </span>
                )}
              </div>
              <p className="text-amber-800 font-sans pl-2.5 border-l-2 border-amber-300 text-[11px]">
                {targetRecord.note}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <section
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="mb-20 sm:mb-28"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-stone-200 pb-4 mb-6 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1 font-mono-code text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              <TrendingUp className="w-3 h-3" />
              <span>EVOLUTION · 真实实测轨迹溯源</span>
            </span>

            <Badge variant="amber">
              <AlertTriangle className="w-3 h-3 text-amber-800" />
              <span>严谨对齐：各模型并非每期都登场</span>
            </Badge>
          </div>

          <h2 className="font-serif-title italic text-3xl sm:text-4xl text-ink font-normal leading-tight">
            Battlefield Trajectory
          </h2>
          <span className="font-mono-code text-[11px] text-ink-muted tracking-wider block mt-1">
            B站《屎山论剑》12 期原片真实参测点与模型战力演变 · 拒绝虚构全勤
          </span>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-3 font-mono-code text-xs flex-wrap">
          <div className="flex items-center bg-stone-50 border border-stone-200 p-0.5 rounded-lg shadow-inner">
            <button
              onClick={() => setDisplayMode("REAL_ONLY")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                displayMode === "REAL_ONLY"
                  ? "bg-emerald-700 text-white shadow-md shadow-emerald-100"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>真实参测原轨</span>
            </button>
            <button
              onClick={() => setDisplayMode("FULL_EXTRAPOLATED")}
              className={`px-3 py-1.5 rounded-md text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                displayMode === "FULL_EXTRAPOLATED"
                  ? "bg-stone-900 text-white font-semibold shadow-md"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>全关卡战力推导</span>
            </button>
          </div>

          {/* Tier Group Filters */}
          <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 p-0.5 rounded-lg">
            {[
              { id: "ALL", label: "全部 (10款)" },
              { id: "FLAGSHIP", label: "旗舰 (T0/T1)" },
              { id: "FLASH", label: "Flash/轻量 (T2-T4)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTierFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded transition-colors text-xs cursor-pointer ${
                  tierFilter === tab.id
                    ? "bg-stone-900 text-white font-semibold shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowPresenceMatrix(!showPresenceMatrix)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs transition-colors cursor-pointer ${
              showPresenceMatrix
                ? "bg-bilibili/20 text-bilibili border-bilibili/50 font-semibold"
                : "bg-stone-50 text-ink-muted hover:text-ink border-stone-300"
            }`}
          >
            <Film className="w-3 h-3" />
            <span>12期参测矩阵</span>
          </button>

          {activeModelId && (
            <button
              onClick={() => setActiveModelId(null)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-stone-50 hover:bg-stone-100 text-ink-muted hover:text-ink border border-stone-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-ink-muted" />
              <span>全览</span>
            </button>
          )}
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="mb-6 p-4 rounded-xl bg-amber-500/[0.05] border border-amber-200 text-xs font-mono-code text-ink-muted leading-relaxed flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-800">曲线数据溯源说明：</span>
            {displayMode === "REAL_ONLY" ? (
              <span>
                当前处于 <strong>「真实参测原轨」</strong> 模式。只在各模型实际参测并有原片出镜的期数打点（例如：美团龙猫在第2期专场，DeepSeek Flash 在第8/9/10/12期，GPT-6 与 Claude 在第7/9/10/11期）。未参测期数严格留空，不假造连续折线！
              </span>
            ) : (
              <span>
                当前处于 <strong>「全关卡战力推导」</strong> 模式。由于前期部分模型尚未发布或未被抽检，此处基于 UP 主最终确立的<strong>「黄金/钻石/王者斩杀线一票否决标准」</strong>，将各模型已验证的攻坚抗压水平映射至 12 期历史题目的难度梯队中。
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setDisplayMode(displayMode === "REAL_ONLY" ? "FULL_EXTRAPOLATED" : "REAL_ONLY")}
          className="text-amber-800 hover:text-amber-800 underline underline-offset-2 shrink-0 cursor-pointer text-[11px]"
        >
          切换至{displayMode === "REAL_ONLY" ? "全关卡推导视图" : "真实参测原轨"} &rarr;
        </button>
      </div>

      {/* 12-Episode Presence Matrix Collapsible Table */}
      {showPresenceMatrix && (
        <div className="mb-6 p-4 rounded-xl bg-stone-100 border border-stone-300 font-mono-code text-xs overflow-x-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-300">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-bilibili" />
              <span>《屎山论剑》全 12 期模型真实出镜与实测矩阵</span>
            </span>
            <span className="text-[11px] text-ink-subtle">
              🟢 实测通过 · 🟡 挣扎/长考/两轮 · 🔴 全灭/卡死 · ⚪ 未参测
            </span>
          </div>

          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="text-[11px] text-ink-muted border-b border-stone-300">
                <th className="text-left py-1.5 pr-3 font-normal">模型名称</th>
                <th className="py-1.5 px-1 font-normal">首秀</th>
                {episodesMeta.map((ep) => (
                  <th key={ep.ep} className="py-1.5 px-1 font-normal text-[10px] text-ink-muted" title={ep.title}>
                    {ep.ep}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleModels.map((m) => {
                return (
                  <tr
                    key={m.modelId}
                    className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${
                      activeModelId === m.modelId ? "bg-stone-100" : ""
                    }`}
                  >
                    <td className="text-left py-2 pr-3 font-semibold text-ink flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="truncate max-w-[130px]">{m.modelName}</span>
                    </td>
                    <td className="text-[10px] text-ink-muted py-2 px-1">{m.debutEpisode}</td>
                    {episodesMeta.map((ep) => {
                      const rec = m.records[ep.ep];
                      if (!rec || !rec.tested) {
                        return (
                          <td key={ep.ep} className="py-2 px-1 text-ink-subtle text-[11px]">
                            —
                          </td>
                        );
                      }
                      const isPass = rec.roundResult.includes("一轮");
                      const isWarn = rec.roundResult.includes("两轮") || rec.roundResult.includes("三轮");
                      const colorClass = isPass
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isWarn
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : "bg-rose-100 text-rose-700 border-rose-200";

                      return (
                        <td key={ep.ep} className="py-2 px-1">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${colorClass}`}
                            title={`${ep.title}\n${rec.roundResult} (${rec.score}分)\n${rec.note}`}
                          >
                            {rec.score.toFixed(0)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Model Interactive Spotlight Switcher Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        <span className="font-mono-code text-xs text-ink-subtle shrink-0 mr-1 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" />
          <span>点击高亮:</span>
        </span>

        {(Object.values(modelHistories) as ModelHistoryData[]).map((m: ModelHistoryData) => {
          const isSelected = activeModelId === m.modelId;
          const isHovered = hoveredModelId === m.modelId;

          return (
            <button
              key={m.modelId}
              onClick={() => {
                setActiveModelId(isSelected ? null : m.modelId);
              }}
              onMouseEnter={() => setHoveredModelId(m.modelId)}
              onMouseLeave={() => setHoveredModelId(null)}
              className={`font-mono-code text-xs px-3 py-1.5 rounded-lg shrink-0 transition-all flex items-center gap-1.5 border select-none cursor-pointer ${
                isSelected
                  ? "bg-stone-900 text-white font-semibold border-stone-300 shadow-[0_8px_20px_rgba(28,25,23,0.12)] scale-[1.02]"
                  : isHovered
                  ? "bg-stone-100 text-ink border-stone-400"
                  : "bg-stone-50 hover:bg-stone-100 text-ink-muted hover:text-ink border-stone-200"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: isSelected ? "#ffffff" : m.color }}
              />
              <span>{m.modelName}</span>
              <span
                className={`text-[10px] px-1 rounded ${
                  isSelected ? "bg-white/15 text-white font-bold" : "bg-stone-100 text-ink-subtle"
                }`}
              >
                {m.testedEpisodes.length}期实测
              </span>
            </button>
          );
        })}
      </div>

      {/* Dashboard Card Container */}
      <div className="p-5 sm:p-6 rounded-2xl border border-stone-200 bg-surface-soft backdrop-blur-md relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-500 opacity-10"
          style={{ backgroundColor: highlightModel ? highlightModel.color : "#60a5fa" }}
        />

        {highlightModel ? (
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-200 font-mono-code flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full shadow-[0_4px_10px_rgba(28,25,23,0.12)]"
                style={{ backgroundColor: highlightModel.color }}
              />
              <span className="text-lg font-bold text-ink tracking-tight">
                {highlightModel.modelName}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-ink-muted font-semibold">
                {highlightModel.tier} 阶梯
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                首次登场: {highlightModel.debutEpisode}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                实测期数: {highlightModel.testedEpisodes.join(", ")} ({highlightModel.testedEpisodes.length} 期)
              </span>
            </div>

            <button
              onClick={() => setActiveModelId(null)}
              className="text-[11px] text-ink-muted hover:text-ink underline underline-offset-2 cursor-pointer"
            >
              返回全景
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-200 font-mono-code text-xs text-ink-muted flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span className="text-ink-muted">
                当前模式: <strong>{displayMode === "REAL_ONLY" ? "真实参测原轨 (未参测严格断点)" : "全关卡战力推导 (12关能力映射)"}</strong>
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">
              悬停曲线查看对应期数战绩；点击顶部标签高亮单一模型
            </span>
          </div>
        )}

        {/* Recharts Chart Area */}
        <div className="w-full h-88 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.18)" />
              <XAxis
                dataKey="episode"
                stroke="#78716c"
                tick={{ fill: "#78716c", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(120,113,108,0.26)" }}
                tickLine={false}
              />
              <YAxis
                domain={[35, 105]}
                stroke="#78716c"
                tick={{ fill: "#78716c", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(120,113,108,0.26)" }}
                tickLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              {showCutoffLines && (
                <>
                  <ReferenceLine
                    y={90}
                    stroke="#b45309"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                    label={{
                      value: "王者绝壁线 (90分)",
                      fill: "#b45309",
                      fontSize: 10,
                      position: "insideTopRight",
                      opacity: 0.8,
                    }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#0369a1"
                    strokeDasharray="4 4"
                    strokeOpacity={0.35}
                    label={{
                      value: "钻石分水岭 (80分)",
                      fill: "#0369a1",
                      fontSize: 10,
                      position: "insideTopRight",
                      opacity: 0.8,
                    }}
                  />
                </>
              )}

              {visibleModels.map((model) => {
                const isSelected = activeModelId === model.modelId;
                const isHovered = hoveredModelId === model.modelId;
                const isHighlighted = isSelected || isHovered;

                let lineOpacity = 0.8;
                let strokeWidth = 2;

                if (currentHighlightId) {
                  if (isHighlighted) {
                    lineOpacity = 1.0;
                    strokeWidth = 3.5;
                  } else {
                    lineOpacity = 0.15;
                    strokeWidth = 1.2;
                  }
                }

                return (
                  <Line
                    key={model.modelId}
                    type="monotone"
                    dataKey={model.modelId}
                    name={model.modelName}
                    stroke={model.color}
                    strokeWidth={strokeWidth}
                    strokeOpacity={lineOpacity}
                    connectNulls={false}
                    dot={
                      isHighlighted
                        ? {
                            r: 5,
                            fill: model.color,
                            stroke: "#ffffff",
                            strokeWidth: 2,
                          }
                        : {
                            r: 3.5,
                            fill: model.color,
                            stroke: "#ffffff",
                            strokeWidth: 1.5,
                          }
                    }
                    activeDot={{
                      r: 7,
                      fill: model.color,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Footnote Legend with All Model Colors */}
        <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono-code text-ink-subtle">
          <div className="flex items-center gap-3 flex-wrap">
            {visibleModels.map((m) => {
              const isHighlighted = currentHighlightId === m.modelId;
              return (
                <button
                  key={m.modelId}
                  onClick={() => setActiveModelId(activeModelId === m.modelId ? null : m.modelId)}
                  onMouseEnter={() => setHoveredModelId(m.modelId)}
                  onMouseLeave={() => setHoveredModelId(null)}
                  className={`flex items-center gap-1.5 transition-opacity cursor-pointer ${
                    currentHighlightId && !isHighlighted ? "opacity-30" : "opacity-100"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className={isHighlighted ? "text-ink font-bold" : "text-ink-muted"}>
                    {m.modelName}
                  </span>
                  <span className="text-[9px] text-ink-subtle">({m.testedEpisodes.length}期)</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-ink-muted">
              {displayMode === "REAL_ONLY"
                ? "💡 点状断线代表未参测期数留空，不假造数据"
                : "💡 连续线代表全 12 关斩杀线推导走势"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
