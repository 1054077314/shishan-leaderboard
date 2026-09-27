import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { KillLineRecord, RankedKillLineRecord, StatusType } from "../../../types";
import { Badge } from "../../ui/Badge";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  ChevronsUpDown,
  RefreshCw,
} from "lucide-react";

export interface KillLineTableProps {
  data: RankedKillLineRecord[];
  /** 数据版本，变化时说明榜单已重算 */
  dataVersion?: string;
  /** 数据文件重建（同步）时间 */
  updatedAt?: string;
  /** toy 官方数据源地址 */
  sourceUrl?: string;
  /** 挑战榜席位数（= data.length） */
  ladderCount?: number;
  /** 考核榜份数 */
  kaoheCount?: number;
  /** 赛事积分榜队伍数 */
  standingsCount?: number;
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
  sourceUrl,
  ladderCount,
  kaoheCount,
  standingsCount,
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
        <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_3px_8px_rgba(4,120,87,0.16)] shrink-0" />
          <span className="font-medium tracking-tight">{text}</span>
        </div>
      );
    }
    if (status === "warn") {
      return (
        <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_3px_8px_rgba(180,83,9,0.16)] shrink-0" />
          <span className="font-medium tracking-tight">{text}</span>
        </div>
      );
    }
    if (status === "fail") {
      return (
        <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-rose-700/90">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80 shrink-0" />
          <span className="tracking-tight">{text}</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 font-mono-code text-xs text-ink-subtle">
        <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
        <span className="text-ink-subtle">无记录</span>
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
      <span className="font-mono-code text-sm font-bold text-ink tabular-nums">
        {row.rank}
      </span>
      {row.rankDelta !== 0 && (
        <span
          className={`font-mono-code text-[10px] tabular-nums ${
            row.rankDelta > 0 ? "text-rose-700" : "text-ink-subtle"
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
      T0: "text-rose-700 font-bold",
      T1: "text-amber-800 font-bold",
      T2: "text-blue-700 font-semibold",
      T3: "text-emerald-700 font-semibold",
    };
    return (
      <span className={`font-mono-code text-xs tracking-wider shrink-0 ${colorMap[tier] || "text-ink-subtle"}`}>
        {tier}
      </span>
    );
  };

  return (
    <section id="kill-line-matrix" className="mb-20 sm:mb-28 scroll-mt-24">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-stone-200 pb-4 mb-4 gap-3">
        <div>
          <h2 className="font-serif-title italic text-3xl sm:text-4xl text-ink font-normal leading-tight">
            The Kill-Line Matrix
          </h2>
          <span className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase block mt-1">
            王者绝壁斩杀线 · 点击任意行展开黄金线与实测证言
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Quick Filter Segmented Pills */}
          <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 p-0.5 rounded-lg">
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
                    ? "bg-stone-900 text-white font-semibold shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Expand / Collapse All Toggle */}
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1 font-mono-code text-xs text-ink-muted hover:text-ink transition-colors py-1.5 px-2.5 rounded bg-stone-50 border border-stone-200 cursor-pointer"
            title="全部展开或收起明细"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            <span>{isAllExpanded ? "全部折叠" : "全部展开"}</span>
          </button>
        </div>
      </div>

      {/* 数据同步状态：名次 = toy 官方挑战榜名次，分数 = 官方考核分，无伪造 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 font-mono-code text-[11px] text-ink-subtle">
        {!dataVersion && <span className="text-ink-subtle">正在同步排名数据…</span>}
        {!!dataVersion && (
          <>
            <span>
              挑战榜 <span className="text-ink-muted">{ladderCount ?? data.length}</span> 席
              · 考核榜 <span className="text-ink-muted">{kaoheCount ?? "—"}</span> 份
              · 赛事积分 <span className="text-ink-muted">{standingsCount ?? "—"}</span> 队
            </span>
            <span className="text-ink-subtle">·</span>
            <span>
              数据版本 <span className="text-ink-muted">{dataVersion}</span>
            </span>
            <span className="text-ink-subtle">·</span>
            <span>
              同步于{" "}
              <span className="text-ink-muted" title="最近一次重建数据文件的时刻">
                {formatUpdatedAt(updatedAt, false)}
              </span>
            </span>
            <span className="text-ink-subtle">·</span>
            <span title={sourceUrl ?? ""}>来源：屎山英雄榜（toy 官方）</span>
            {usingFallback && (
              <>
                <span className="text-ink-subtle">·</span>
                <span className="text-amber-800">线上数据不可用，展示内置兜底数据</span>
              </>
            )}
          </>
        )}
        <button
          onClick={onRefresh}
          disabled={syncing}
          className="inline-flex items-center gap-1 text-ink-muted hover:text-ink transition-colors disabled:opacity-50 cursor-pointer"
          title="立即拉取最新排名数据并重排"
        >
          <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "同步中" : "检查更新"}</span>
        </button>
      </div>

      {/* Modern High-Density Table */}
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-surface shadow-[0_12px_30px_rgba(28,25,23,0.08)] relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-200 text-[11px] font-mono-code text-ink-subtle tracking-wider uppercase bg-surface-soft">
              <th className="py-3 px-2 sm:px-3 w-12 text-center font-normal">
                <span className="sr-only">展开</span>
              </th>
              <th
                onClick={() => handleSortChange("score")}
                className="py-3 px-2 sm:px-3 w-14 text-center font-normal hover:text-ink transition-colors cursor-pointer select-none"
                title="官方挑战榜名次"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>#</span>
                  <ArrowUpDown className="w-3 h-3 text-ink-subtle" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("name")}
                className="py-3 px-3 sm:px-4 font-normal hover:text-ink transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>MODEL / TIER</span>
                  <ArrowUpDown className="w-3 h-3 text-ink-subtle" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("diamond")}
                className="py-3 px-3 sm:px-4 font-normal hover:text-ink transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>DIAMOND CUT-OFF</span>
                  <ArrowUpDown className="w-3 h-3 text-ink-subtle" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("king")}
                className="py-3 px-3 sm:px-4 font-normal hover:text-ink transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>KING CUT-OFF (王者绝壁)</span>
                  <ArrowUpDown className="w-3 h-3 text-ink-subtle" />
                </div>
              </th>
              <th
                onClick={() => handleSortChange("score")}
                className="py-3 px-4 sm:px-6 font-normal text-right hover:text-ink transition-colors cursor-pointer select-none"
                title="官方考核分（total/18×100），无考核记录为生涯推导分"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>考核分</span>
                  <ArrowUpDown className="w-3 h-3 text-ink-subtle" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isTransitioning ? (
              // Fast Skeleton state
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-2 sm:px-3 text-center">
                    <div className="w-4 h-4 bg-stone-50 rounded mx-auto" />
                  </td>
                  <td className="py-4 px-2 sm:px-3 text-center">
                    <div className="w-5 h-4 bg-stone-50 rounded mx-auto" />
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <div className="h-4 bg-stone-100 rounded w-32 mb-1.5" />
                    <div className="h-3 bg-stone-50 rounded w-16" />
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <div className="h-4 bg-stone-100 rounded w-28" />
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <div className="h-4 bg-stone-100 rounded w-36" />
                  </td>
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="h-4 bg-stone-100 rounded w-12 ml-auto" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-subtle font-mono-code text-xs">
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
                          ? "bg-stone-50"
                          : isExpanded
                          ? "bg-surface-soft"
                          : "hover:bg-surface-soft"
                      }`}
                    >
                      {/* Expand / Collapse Caret */}
                      <td className="py-3.5 px-2 sm:px-3 text-center align-middle">
                        <button
                          onClick={(e) => toggleExpand(row.id, e)}
                          className="p-1 rounded hover:bg-stone-100 text-ink-subtle group-hover:text-ink-muted transition-colors"
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
                          <span className="font-mono-code text-xs text-ink font-medium group-hover:text-rose-700 transition-colors">
                            {row.model}
                          </span>
                          {renderTier(row.tier)}
                        </div>
                        <div className="text-[11px] text-ink-subtle font-light truncate max-w-xs mt-0.5">
                          {row.quote}
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

                      {/* 官方考核分（total/18×100），无考核记录为生涯推导分 */}
                      <td className="py-3.5 px-4 sm:px-6 text-right font-mono-code text-xs text-ink align-middle">
                        <span className="font-bold text-sm tracking-tight">{row.score}</span>
                        <span className="block text-[10px] text-ink-subtle font-normal">
                          {(row as any).toy?.assessmentTotal != null
                            ? `考核 ${(row as any).toy.assessmentTotal}/18`
                            : "生涯推导"}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Drawer Detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr className="bg-stone-100 border-b border-stone-200">
                          <td colSpan={6} className="p-0">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-6 py-4 sm:px-10 sm:py-5 space-y-3 bg-gradient-to-r from-white/80 via-transparent to-transparent">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono-code">
                                  {/* Gold Line Status */}
                                  <div className="p-3 rounded-lg bg-surface-soft border border-stone-100">
                                    <div className="text-ink-subtle text-[10px] uppercase mb-1 flex items-center gap-1">
                                      <span>黄金线表现 (入门考核)</span>
                                      <HelpCircle className="w-2.5 h-2.5 opacity-60" />
                                    </div>
                                    <div className="text-ink font-medium">{row.gold}</div>
                                  </div>

                                  {/* Diamond Line Status */}
                                  <div className="p-3 rounded-lg bg-surface-soft border border-stone-100">
                                    <div className="text-ink-subtle text-[10px] uppercase mb-1">
                                      钻石分水岭 (进阶并发死锁)
                                    </div>
                                    <div className="text-ink font-medium">{row.diamond}</div>
                                  </div>

                                  {/* King Line Status */}
                                  <div className="p-3 rounded-lg bg-surface-soft border border-stone-100">
                                    <div className="text-ink-subtle text-[10px] uppercase mb-1">
                                      王者绝壁线 (极限业务攻坚)
                                    </div>
                                    <div className="text-ink font-medium">{row.king}</div>
                                  </div>
                                </div>

                                {/* Authentic Testimonial Quote */}
                                {row.quote && (
                                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs italic font-serif leading-relaxed">
                                    “{row.quote}”
                                  </div>
                                )}

                                {/* Actions footer inside expansion */}
                                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono-code">
                                  <div className="flex items-center gap-3">
                                    <span className="text-ink-subtle text-[11px]">
                                      考核分: <strong className="text-ink font-bold">{row.score}</strong> 分
                                      {(row as any).toy?.assessmentTotal != null
                                        ? `（官方考核 ${(row as any).toy.assessmentTotal}/18）`
                                        : "（生涯推导分，该模型暂无官方考核记录）"}
                                    </span>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenDetailModal(row);
                                    }}
                                    className="inline-flex items-center gap-1 text-rose-700 hover:text-rose-700 transition-colors cursor-pointer"
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
