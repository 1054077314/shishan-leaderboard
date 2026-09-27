import React, { useState, useMemo } from "react";
import { RealBilibiliComment } from "../../../data/realBilibiliComments";
import { CommentService } from "../../../services/commentService";
import {
  MessageSquare,
  ThumbsUp,
  ExternalLink,
  Search,
  Filter,
  Flame,
  Crown,
  Code2,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Tv,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface RealBilibiliCommentsPanelProps {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const RealBilibiliCommentsPanel: React.FC<RealBilibiliCommentsPanelProps> = ({
  onMouseEnter,
  onMouseLeave,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEpisode, setSelectedEpisode] = useState<number | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "hot" | "up" | "tech">("all");
  const [sortBy, setSortBy] = useState<"like" | "episode" | "recent">("like");
  const [visibleCount, setVisibleCount] = useState(15);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy comment text
  const handleCopy = (comment: RealBilibiliComment, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(
      `【B站 @${comment.userName} 在《${comment.episodeTitle}》的评论】：\n${comment.message}`
    );
    setCopiedId(comment.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter & sort comments through CommentService
  const filteredComments = useMemo(() => {
    return CommentService.filterAndSort({
      searchQuery,
      selectedEpisode,
      categoryFilter,
      sortBy,
    });
  }, [searchQuery, selectedEpisode, categoryFilter, sortBy]);

  const displayedComments = filteredComments.slice(0, visibleCount);

  // Statistics from CommentService
  const stats = useMemo(() => {
    return CommentService.getStats();
  }, []);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="space-y-6"
    >
      {/* Top Banner with Stats & Up-to-date Badges */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-bilibili/10 via-bilibili/5 to-transparent border border-bilibili/20 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-bilibili/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-bilibili text-white text-xs font-mono-code font-bold tracking-tight inline-flex items-center gap-1 shadow-sm shadow-bilibili/30">
                <Tv className="w-3 h-3" />
                <span>B 站原生数据源</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono-code">
                ✓ 真实全量抓取 404 条原评
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono-code">
                🔥 最高 1,775 赞神评
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink tracking-tight flex items-center gap-2">
              <span>《屎山论剑》B 站原生评论区与开发者实战讨论</span>
            </h3>
            <p className="text-xs text-ink-muted font-mono-code leading-relaxed max-w-3xl">
              真实收录全 12 期视频评论区中高赞热评、楼中楼争鸣与 UP 主「Token就是词元」亲自回复。
              在这里可直接阅读国内一线工程师针对 Agent 提示词工程、子代理编排、死锁排查与各家模型实战特性的最真实反馈。
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://space.bilibili.com/3546747185924773"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-bilibili hover:bg-bilibili/90 text-white text-xs font-mono-code font-medium transition-all shadow-lg shadow-bilibili/20 hover:shadow-bilibili/40 flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>前往 UP 主 B 站空间</span>
            </a>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-stone-200">
          <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200">
            <div className="text-[11px] text-ink-muted font-mono-code">真实抓取总数</div>
            <div className="text-lg font-bold font-mono-code text-ink mt-0.5">
              {stats.total}{" "}
              <span className="text-xs font-normal text-ink-subtle">条</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200">
            <div className="text-[11px] text-ink-muted font-mono-code">覆盖实测视频</div>
            <div className="text-lg font-bold font-mono-code text-bilibili mt-0.5">
              12 / 12{" "}
              <span className="text-xs font-normal text-ink-subtle">期</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200">
            <div className="text-[11px] text-ink-muted font-mono-code">最高点赞神评</div>
            <div className="text-lg font-bold font-mono-code text-amber-800 mt-0.5">
              {stats.maxLike.toLocaleString()}{" "}
              <span className="text-xs font-normal text-ink-subtle">赞</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-100 border border-stone-200">
            <div className="text-[11px] text-ink-muted font-mono-code">UP 主亲临互动</div>
            <div className="text-lg font-bold font-mono-code text-pink-700 mt-0.5">
              {stats.upInteractCount}{" "}
              <span className="text-xs font-normal text-ink-subtle">处</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-2xl bg-surface-soft border border-stone-200 space-y-3.5">
        {/* Row 1: Search & Category Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索评论内容、关键词（如 todo, prompt, deepseek, 梁神, agent）或用户名..."
              className="w-full pl-10 pr-4 py-2 bg-stone-100 border border-stone-300 rounded-xl text-xs font-mono-code text-ink placeholder-ink-subtle focus:outline-none focus:border-bilibili/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-subtle hover:text-ink-muted font-mono-code"
              >
                清除
              </button>
            )}
          </div>

          {/* Category Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-colors cursor-pointer whitespace-nowrap ${
                categoryFilter === "all"
                  ? "bg-bilibili text-white font-medium"
                  : "bg-stone-50 text-ink-muted hover:bg-stone-100 hover:text-ink"
              }`}
            >
              全部原评 ({stats.total})
            </button>
            <button
              onClick={() => setCategoryFilter("hot")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                categoryFilter === "hot"
                  ? "bg-amber-700 text-white font-medium"
                  : "bg-stone-50 text-ink-muted hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <Flame className="w-3 h-3 text-amber-800" />
              <span>高赞热评 (&ge;50赞)</span>
            </button>
            <button
              onClick={() => setCategoryFilter("up")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                categoryFilter === "up"
                  ? "bg-pink-700 text-white font-medium"
                  : "bg-stone-50 text-ink-muted hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <Crown className="w-3 h-3 text-pink-700" />
              <span>UP 主互动 ({stats.upInteractCount})</span>
            </button>
            <button
              onClick={() => setCategoryFilter("tech")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-code transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                categoryFilter === "tech"
                  ? "bg-emerald-700 text-white font-medium"
                  : "bg-stone-50 text-ink-muted hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <Code2 className="w-3 h-3 text-emerald-700" />
              <span>技术干货/调优</span>
            </button>
          </div>
        </div>

        {/* Row 2: Episode Selector Pills & Sort */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-stone-200">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] text-ink-subtle font-mono-code shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>期数筛选:</span>
            </span>
            <button
              onClick={() => setSelectedEpisode("ALL")}
              className={`px-2 py-1 rounded text-[11px] font-mono-code transition-colors shrink-0 cursor-pointer ${
                selectedEpisode === "ALL"
                  ? "bg-stone-900 text-white font-semibold"
                  : "bg-stone-50 text-ink-muted hover:text-ink"
              }`}
            >
              全部期数
            </button>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((ep) => (
              <button
                key={ep}
                onClick={() => setSelectedEpisode(ep)}
                className={`px-2 py-1 rounded text-[11px] font-mono-code transition-colors shrink-0 cursor-pointer ${
                  selectedEpisode === ep
                    ? "bg-bilibili text-white font-semibold"
                    : "bg-stone-50 text-ink-muted hover:text-ink"
                }`}
              >
                E{ep < 10 ? `0${ep}` : ep}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono-code text-ink-muted">
            <span>排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-stone-50 border border-stone-300 rounded-lg px-2.5 py-1 text-xs text-ink-muted focus:outline-none focus:border-bilibili/50"
            >
              <option value="like">获赞最多</option>
              <option value="episode">期数倒序</option>
              <option value="recent">原生顺序</option>
            </select>
          </div>
        </div>
      </div>

      {/* Comment Cards Stream */}
      <div className="space-y-3">
        {displayedComments.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-surface-soft border border-stone-200">
            <MessageSquare className="w-8 h-8 text-ink-subtle mx-auto mb-2" />
            <div className="text-sm text-ink-muted font-mono-code">未找到匹配的真实评论</div>
            <div className="text-xs text-ink-subtle font-mono-code mt-1">
              可尝试清空搜索词或切换期数分类
            </div>
          </div>
        ) : (
          displayedComments.map((c) => {
            const isTopLiked = c.likeCount >= 200;
            const isTech = CommentService.isTechComment(c.message);

            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  c.isUpAuthor
                    ? "bg-pink-50 border-pink-200 shadow-[0_6px_16px_rgba(236,72,153,0.08)]"
                    : isTopLiked
                    ? "bg-amber-50 border-amber-200 shadow-[0_6px_16px_rgba(217,119,6,0.08)]"
                    : "bg-surface-soft border-stone-200 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={c.userAvatar}
                      alt={c.userName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border border-stone-300 bg-stone-200 object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    {c.isUpAuthor && (
                      <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-pink-700 text-white">
                        <Crown className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Comment Body */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-semibold text-xs tracking-tight ${
                            c.isUpAuthor ? "text-pink-700 font-bold" : "text-ink"
                          }`}
                        >
                          {c.userName}
                        </span>

                        {c.isUpAuthor && (
                          <span className="px-1.5 py-0.2 rounded bg-pink-50 border border-pink-500/40 text-pink-700 text-[10px] font-mono-code font-bold">
                            UP 主
                          </span>
                        )}

                        {c.userLevel > 0 && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-stone-100 text-ink-subtle font-mono-code">
                            Lv.{c.userLevel}
                          </span>
                        )}

                        {c.isUpTop && (
                          <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[10px] font-mono-code font-bold">
                            UP 主置顶
                          </span>
                        )}

                        {c.isUpLike && !c.isUpAuthor && (
                          <span className="px-1.5 py-0.2 rounded bg-pink-50 text-pink-700 text-[10px] font-mono-code">
                            UP 主觉得很赞
                          </span>
                        )}

                        {isTech && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono-code flex items-center gap-0.5">
                            <Code2 className="w-2.5 h-2.5" /> 实操干货
                          </span>
                        )}
                      </div>

                      {/* Source Episode Tag */}
                      <a
                        href={`https://www.bilibili.com/video/${c.bvid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-stone-50 hover:bg-bilibili/20 text-ink-muted hover:text-bilibili border border-stone-200 hover:border-bilibili/40 transition-colors flex items-center gap-1 shrink-0"
                        title={c.episodeTitle}
                      >
                        <span>E{c.episode < 10 ? `0${c.episode}` : c.episode}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    {/* Message Content */}
                    <p className="text-ink text-xs sm:text-[13px] leading-relaxed font-sans whitespace-pre-wrap selection:bg-bilibili/30 selection:text-ink">
                      {c.message}
                    </p>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-stone-100 text-xs font-mono-code text-ink-subtle">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-ink-muted">
                          <ThumbsUp className="w-3 h-3 text-amber-800" />
                          <span className="font-semibold text-ink-muted">
                            {c.likeCount.toLocaleString()}
                          </span>
                        </span>

                        {c.replyCount > 0 && (
                          <span className="flex items-center gap-1 text-ink-subtle">
                            <MessageSquare className="w-3 h-3" />
                            <span>{c.replyCount} 条回复</span>
                          </span>
                        )}

                        <span className="text-[11px] text-ink-subtle">{c.timeDesc}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleCopy(c, e)}
                          className="px-2 py-1 rounded bg-stone-50 hover:bg-stone-100 text-ink-muted hover:text-ink transition-colors text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === c.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-700" />
                              <span className="text-emerald-700">已复制</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>复制内容</span>
                            </>
                          )}
                        </button>

                        <a
                          href={`https://www.bilibili.com/video/${c.bvid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded bg-bilibili/10 hover:bg-bilibili/20 text-bilibili transition-colors text-[11px] flex items-center gap-1"
                        >
                          <span>查看视频</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Load More Button */}
      {visibleCount < filteredComments.length && (
        <div className="text-center pt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + 20)}
            className="px-6 py-2.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-ink-muted hover:text-ink border border-stone-200 font-mono-code text-xs transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <span>加载更多评论 (剩余 {filteredComments.length - visibleCount} 条)</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
