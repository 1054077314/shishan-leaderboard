import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { KillLineRecord, RankedKillLineRecord, RankingEpisode, StatusType } from "../../../types";
import { Badge } from "../../ui/Badge";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  ChevronsUpDown,
  Tv,
  RefreshCw,
} from "lucide-react";

export interface KillLineTableProps {
  data: RankedKillLineRecord[];
  /** 数据版本，变化时说明榜单已重算 */
  dataVersion?: string;
  /** 数据文件重建（同步）时间 */
  updatedAt?: string;
  /** UP主最新一条相关视频的发布时间 */
  latestContentAt?: string;
  /** 榜单已录入结果的最新一期发布时间 */
  latestRecordedAt?: string;
  /** 已发布但结果未录入的期数 */
  pendingEpisodes?: RankingEpisode[];
  /** 已录入结果的正片期数 */
  episodesCovered?: number;
  /** 采集到的全部相关视频条数（正片 + 未进合集的） */
  videosFound?: number;
  syncing?: boolean;
  usingFallback?: boolean;
  lastSyncedAt?: number | null;
  onRefresh?: () => void;
  selectedModel: KillLineRecord;
  onSelectModel: (model: KillLineRecord) => void;
  selectedForCompare?: KillLineRecord[];
  onToggleCompare?: (model: KillLineRecord) => void;
  onOpenDetailModal: (model: KillLineRecord) => void;
  filterTier: string;
  onFilterTierChange: (t: string) => void;
  sortBy: "score" | "name" | "diamond" | "king";
  onSortByChange: (s: "score" | "name" | "diamond" | "king") => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const KillLineTable: React.FC<KillLineTableProps> = ({
  data,
  dataVersion,
  updatedAt,
  latestContentAt,
  latestRecordedAt,
  pendingEpisodes = [],
  episodesCovered,
  videosFound,
  syncing,
  usingFallback,
  lastSyncedAt,
  onRefresh,
  selectedModel,
  onSelectModel,
  onOpenDetailModal,
  filterTier,
  onFilterTierChange,
  sortBy,
  onSortByChange,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const handleFilterChange = (tabId: string) => {
    if (tabId === filterTier) return;
    setIsTransitioning(true);
    onFilterTierChange(tabId);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 240);
  };

  const handleSortChange = (newSort: "score" | "name" | "diamond" | "king") => {
    if (newSort === sortBy) return;
    setIsTransitioning(true);
    onSortByChange(newSort);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 240);
  };

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isAllExpanded = data.length > 0 && data.every((row) => expandedIds[row.id]);
  const toggleAll = () => {
    if (isAllExpanded) {
      setExpandedIds({});
    } else {
      const next: Record<string, boolean> = {};
      data.forEach((r) => {
        next[r.id] = true;
      });
      setExpandedIds(next);
    }
  };

  const renderStatus = (status: StatusType, text: string) => {
    if (status === "pass") {
      return (
        <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
          <span className="font-medium tracking-tight">{text}</span>
        </div>
      );
    }
    if (status === "warn") {
      return (
        <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] shrink-0" />
          <span className="font-medium tracking-tight">{text}</span>
        </div>
      );
    }
    if (status === "fail") {
      return (
        <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-rose-400/90">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80 shrink-0" />
          <span className="tracking-tight">{text}</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-zinc-600">
        <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0" />
        <span className="text-zinc-600">无记录</span>
      </div>
    );
  };

  /**
   * 时间格式化。三个时间必须分开显示：
   * 「同步于」是跑脚本的时刻，跟 UP主有没有更新、结果有没有录进去都没关系
   */
  const formatUpdatedAt = (iso?: string, withYear = true) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = withYear
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const renderRank = (row: RankedKillLineRecord) => (
    <div className="flex flex-col items-center leading-none gap-1">
      <span className="font-mono-code text-sm font-bold text-white tabular-nums">
        {row.rank}
      </span>
      {row.rankDelta !== 0 && (
        <span
          className={`font-mono-code text-[10px] tabular-nums ${
            row.rankDelta > 0 ? "text-rose-400" : "text-zinc-500"
          }`}
          title={
            row.rankDelta > 0
              ? `较上一版上升 ${row.rankDelta} 位`
              : `较上一版下降 ${Math.abs(row.rankDelta)} 位`
          }
        >
          {row.rankDelta > 0 ? `↑${row.rankDelta}` : `↓${Math.abs(row.rankDelta)}`}
        </span>
      )}
    </div>
  );

  const renderTier = (tier: string) => {
    const colorMap: Record<string, string> = {
      T0: "text-rose-400 font-bold",
      T1: "text-amber-400 font-bold",
      T2: "text-blue-400 font-semibold",
      T3: "text-emerald-400 font-semibold",
    };
    return (
      <span className={`font-mono-code text-xs tracking-wider shrink-0 ${colorMap[tier] || "text-zinc-500"}`}>
        {tier}
      </span>
    );
  };

  return (
    <section id="kill-line-matrix" className="mb-20 sm:mb-28 scroll-mt-24">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-white/[0.08] pb-4 mb-4 gap-3">
        <div>
          <h2 className="font-serif-title italic text-3xl sm:text-4xl text-white font-normal leading-tight">
            The Kill-Line Matrix
          </h2>
          <span className="font-mono-code text-[11px] text-zinc-500 tracking-wider uppercase block mt-1">
            王者绝壁斩杀线 · 点击任意行展开黄金线与实测证言
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Quick Filter Segmented Pills */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] p-0.5 rounded-lg">
            {[
              { id: "ALL", label: "全部实测" },
              { id: "TOP", label: "王者突围 (T0/T1)" },
              { id: "FLASH", label: "轻量 Flash" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`font-mono-code text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  filterTier === tab.id
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Expand / Collapse All Toggle */}
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1 font-mono-code text-xs text-zinc-400 hover:text-white transition-colors py-1.5 px-2.5 rounded bg-white/[0.03] border border-white/[0.08] cursor-pointer"
            title="全部展开或收起明细"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            <span>{isAllExpanded ? "全部折叠" : "全部展开"}</span>
          </button>
        </div>
      </div>

      {/* 数据同步状态：数据版本一变，榜单即自动重排 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 font-mono-code text-[11px] text-zinc-500">
        {!dataVersion && <span className="text-zinc-500">正在同步排名数据…</span>}
        {!!dataVersion && (
          <>
            <span>
              已录 <span className="text-zinc-300">{episodesCovered}</span> 期正片 / 共发现{" "}
              <span className="text-zinc-300">{videosFound}</span> 条
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              内容最新{" "}
              <span
                className={
                  latestContentAt && latestRecordedAt && latestContentAt > latestRecordedAt
                    ? "text-amber-400"
                    : "text-zinc-300"
                }
                title="UP主最新一条相关视频的发布时间"
              >
                {formatUpdatedAt(latestContentAt, false)}
              </span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              已录至{" "}
              <span className="text-zinc-300" title="榜单已录入实测结果的最新一期发布时间">
                {formatUpdatedAt(latestRecordedAt, false)}
              </span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              数据版本 <span className="text-zinc-300">{dataVersion}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              同步于{" "}
              <span className="text-zinc-400" title="最近一次重建数据文件的时刻，不等于内容更新时间">
                {formatUpdatedAt(updatedAt, false)}
              </span>
            </span>
            {pendingEpisodes.length > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span
                  className="text-amber-400"
                  title={pendingEpisodes
                    .map(
                      (p) =>
                        `${
                          p.pubdate
                            ? new Date(p.pubdate * 1000).toLocaleDateString("zh-CN")
                            : "—"
                        }  ${p.title}`
                    )
                    .join("\n")}
                >
                  {pendingEpisodes.length} 个新视频待录入实测结果
                </span>
              </>
            )}
            {usingFallback && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-amber-500">线上数据不可用，展示内置兜底数据</span>
              </>
            )}
          </>
        )}
        <button
          onClick={onRefresh}
          disabled={syncing}
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          title="立即拉取最新排名数据并重排"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "同步中" : "检查更新"}</span>
        </button>
      </div>

      {/* Modern High-Density Table */}
      <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#050505] shadow-2xl relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08] text-[11px] font-mono-code text-zinc-500 tracking-wider uppercase bg-white/[0.02]">
              <th className="py-3 px-2 sm:px-3 w-12 text-center font-normal">
                <span className="sr-only">展开</span>
              </th>
              <th
                onClick={() => handleSortChange("score")}
                className="py-3 px-2 sm:px-3 w-14 text-center font-normal hover:text-zinc-200 transition-colors cursor-pointer select-none"
                title="全榜名次，按战力指数排序"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>#</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("name")}
                className="py-3 px-3 sm:px-4 font-normal hover:text-zinc-200 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>MODEL / TIER</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("diamond")}
                className="py-3 px-3 sm:px-4 font-normal hover:text-zinc-200 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>DIAMOND CUT-OFF</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("king")}
                className="py-3 px-3 sm:px-4 font-normal hover:text-zinc-200 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>KING CUT-OFF (王者绝壁)</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("score")}
                className="py-3 px-4 sm:px-6 font-normal text-right hover:text-zinc-200 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>SCORE</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-600" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {isTransitioning ? (
              // Fast Skeleton state
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-2 sm:px-3 text-center">
                    <div className="w-4 h-4 bg-white/[0.05] rounded mx-auto" />
                  </td>
                  <td className="py-4 px-2 sm:px-3 text-center">
                    <div className="w-5 h-4 bg-white/[0.05] rounded mx-auto" />
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <div className="h-4 bg-white/[0.08] rounded w-32 mb-1.5" />
                    <div className="h-3 bg-white/[0.04] rounded w-16" />
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <div className="h-4 bg-white/[0.06] rounded w-28" />
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <div className="h-4 bg-white/[0.06] rounded w-36" />
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="h-4 bg-white/[0.08] rounded w-12 ml-auto" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500 font-mono-code text-xs">
                  未找到符合筛选条件的模型
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const isSelected = selectedModel.id === row.id;
                const isExpanded = !!expandedIds[row.id];

                return (
                  <React.Fragment key={row.id}>
                    {/* Main Row */}
                    <tr
                      onClick={() => {
                        onSelectModel(row);
                        toggleExpand(row.id);
                      }}
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                      className={`group transition-colors cursor-pointer select-none ${
                        isSelected
                          ? "bg-white/[0.04]"
                          : isExpanded
                          ? "bg-white/[0.02]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      {/* Expand / Collapse Caret */}
                      <td className="py-3.5 px-2 sm:px-3 text-center align-middle">
                        <button
                          onClick={(e) => toggleExpand(row.id, e)}
                          className="p-1 rounded hover:bg-white/[0.08] text-zinc-500 group-hover:text-zinc-300 transition-colors"
                          aria-label={isExpanded ? "收起明细" : "展开明细"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* 全榜名次与升降 */}
                      <td className="py-3.5 px-2 sm:px-3 text-center align-middle">
                        {renderRank(row)}
                      </td>

                      {/* Model & Tier */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code text-xs text-white font-medium group-hover:text-rose-200 transition-colors">
                            {row.model}
                          </span>
                          {renderTier(row.tier)}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-light truncate max-w-xs mt-0.5">
                          {row.keyHighlight || row.quote}
                        </div>
                      </td>

                      {/* Diamond Cut-off */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle">
                        {renderStatus(row.diamondStatus, row.diamond)}
                      </td>

                      {/* King Cut-off */}
                      <td className="py-3.5 px-3 sm:px-4 align-middle">
                        {renderStatus(row.kingStatus, row.king)}
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4 sm:px-6 text-right font-mono-code text-xs text-white align-middle">
                        <span className="font-bold text-sm tracking-tight">{row.score}</span>
                      </td>
                    </tr>

                    {/* Expandable Drawer Detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr className="bg-black/40 border-b border-white/[0.06]">
                          <td colSpan={6} className="p-0">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 py-4 sm:px-10 sm:py-5 space-y-3 bg-gradient-to-r from-white/[0.015] via-transparent to-transparent">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono-code">
                                  {/* Gold Line Status */}
                                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <div className="text-zinc-500 text-[10px] uppercase mb-1 flex items-center gap-1">
                                      <span>黄金线表现 (入门考核)</span>
                                      <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                                    </div>
                                    <div className="text-zinc-200 font-medium">{row.gold}</div>
                                  </div>

                                  {/* Diamond Line Status */}
                                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <div className="text-zinc-500 text-[10px] uppercase mb-1">
                                      钻石分水岭 (进阶并发死锁)
                                    </div>
                                    <div className="text-zinc-200 font-medium">{row.diamond}</div>
                                  </div>

                                  {/* King Line Status */}
                                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                    <div className="text-zinc-500 text-[10px] uppercase mb-1">
                                      王者绝壁线 (极限业务攻坚)
                                    </div>
                                    <div className="text-zinc-200 font-medium">{row.king}</div>
                                  </div>
                                </div>

                                {/* Authentic Testimonial Quote */}
                                {row.quote && (
                                  <div className="p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/20 text-amber-200/90 text-xs italic font-serif leading-relaxed">
                                    “{row.quote}”
                                  </div>
                                )}

                                {/* Actions footer inside expansion */}
                                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-code">
                                  <div className="flex items-center gap-3">
                                    <span className="text-zinc-500 text-[11px]">
                                      战力指数: <strong className="text-white font-bold">{row.score}</strong> 分
                                    </span>
                                    {row.sourceEpisodeTitle && (
                                      <a
                                        href={
                                          row.bilibiliBvid
                                            ? `https://www.bilibili.com/video/${row.bilibiliBvid}`
                                            : "https://space.bilibili.com/3546747185924773"
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 text-[11px] text-[#00aeec] hover:text-[#00aeec]/80 hover:underline transition-colors"
                                      >
                                        <Tv className="w-3 h-3" />
                                        <span>B站实测: {row.sourceEpisodeTitle}</span>
                                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                      </a>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenDetailModal(row);
                                    }}
                                    className="inline-flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                                  >
                                    <span>深入战损档案</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
