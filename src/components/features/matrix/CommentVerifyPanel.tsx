import React from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import type {
  CommentClaim,
  CommentClaimStatus,
  CommentsVerification,
  CommentTrust,
} from "../../../types";

const STATUS_STYLE: Record<CommentClaimStatus, { label: string; cls: string }> = {
  confirmed: { label: "一致", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  conflict: { label: "冲突", cls: "text-rose-700 bg-rose-50 border-rose-200" },
  unverifiable: { label: "官方无此项", cls: "text-stone-500 bg-stone-50 border-stone-200" },
  ambiguous: { label: "指向不明", cls: "text-amber-800 bg-amber-50 border-amber-200" },
};

const TRUST_LABEL: Record<CommentTrust, string> = {
  official: "UP主",
  endorsed: "UP主背书",
  community: "热评",
};

const KIND_LABEL: Record<CommentClaim["kind"], string> = {
  kaoheTotal: "考核分",
  ladderRank: "名次",
  wdl: "小组战绩",
  standingsPts: "积分",
};

function commentUrl(c: { bvid: string; rpid: string }): string {
  return `https://www.bilibili.com/video/${c.bvid}#reply${c.rpid}`;
}

const ClaimRow: React.FC<{ claim: CommentClaim }> = ({ claim }) => {
  const st = STATUS_STYLE[claim.status];
  return (
    <div className="px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap font-mono-code text-xs">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold ${st.cls}`}>
          {st.label}
        </span>
        <span className="text-ink font-semibold">
          {claim.model ?? `「${claim.mentionKey}」`}
        </span>
        <span className="text-ink-subtle">{KIND_LABEL[claim.kind]}</span>
        <span className="text-ink">
          评论称 <strong>{claim.claimed}</strong>
        </span>
        {claim.expected != null && (
          <span className="text-ink-subtle">官方 {claim.expected}</span>
        )}
        <span className="ml-auto flex items-center gap-2 text-[10px] text-ink-subtle">
          <span>{TRUST_LABEL[claim.trust]}</span>
          <span>ep{claim.ep}</span>
          {claim.like > 0 && <span>{claim.like} 赞</span>}
          <a
            href={commentUrl(claim)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-rose-700 hover:underline"
          >
            原评论 <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </span>
      </div>
      <div className="text-[11px] font-mono-code text-ink-subtle leading-relaxed border-l-2 border-stone-200 pl-2">
        {claim.uname}：{claim.excerpt}
      </div>
    </div>
  );
};

/** 评论区第二信源核实：评论断言与官方三榜的交叉核对结果 */
export const CommentVerifyPanel: React.FC<{ comments: CommentsVerification }> = ({
  comments,
}) => {
  const { stats, claims, notices } = comments;
  const order: CommentClaimStatus[] = ["conflict", "confirmed", "unverifiable", "ambiguous"];
  const sorted = [...claims].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  );

  return (
    <section className="mb-20 sm:mb-28">
      <div className="border-b border-stone-200 pb-4 mb-6 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif-title italic text-3xl sm:text-4xl text-ink font-normal leading-tight">
            Comment Cross-Check
          </h2>
          <span className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase block mt-1">
            评论区第二信源 · 与官方榜交叉核实 · 冲突项人工复核
          </span>
        </div>
        <span className="font-mono-code text-[11px] text-ink-subtle">
          采集于 {comments.fetchedAt ? comments.fetchedAt.slice(0, 10) : "—"}
          {comments.authenticated ? " · 登录态" : " · 匿名态（仅置顶+热评）"}
        </span>
      </div>

      <div className="border border-stone-200 rounded-xl overflow-hidden bg-surface">
        <div className="px-4 py-3 bg-surface-soft border-b border-stone-200 font-mono-code text-xs text-ink font-semibold flex items-center gap-2 flex-wrap">
          <ShieldCheck className="w-3.5 h-3.5 text-ink-subtle" />
          <span>
            扫描 {stats.scanned} 条评论 → {stats.claims} 条可核对断言：
          </span>
          <span className="text-emerald-700">一致 {stats.confirmed}</span>
          <span className={stats.conflict > 0 ? "text-rose-700 font-bold" : "text-ink-subtle"}>
            冲突 {stats.conflict}
          </span>
          <span className="text-ink-subtle">无法核对 {stats.unverifiable}</span>
          <span className="text-ink-subtle">指向不明 {stats.ambiguous}</span>
        </div>

        {stats.claims === 0 && (
          <div className="px-4 py-6 text-center font-mono-code text-xs text-ink-subtle">
            本批评论里没有可核对的结构化断言
            {!comments.authenticated && "（匿名态只拿到置顶+热评前几名，覆盖面有限）"}
          </div>
        )}

        <div className="divide-y divide-stone-100">
          {sorted.map((c) => (
            <ClaimRow key={`${c.rpid}-${c.kind}-${c.claimed}`} claim={c} />
          ))}
        </div>

        {notices.length > 0 && (
          <div className="border-t border-stone-200">
            <div className="px-4 py-2 bg-surface-soft font-mono-code text-[11px] text-ink-subtle uppercase tracking-wider">
              UP主动态（勘误 / 声明）
            </div>
            <div className="divide-y divide-stone-100">
              {notices.map((n) => (
                <div key={n.rpid} className="px-4 py-3 text-[11px] font-mono-code">
                  <span className="text-ink-muted">{n.uname} · ep{n.ep}：</span>
                  <span className="text-ink leading-relaxed">{n.excerpt}</span>
                  <a
                    href={commentUrl(n)}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-0.5 text-rose-700 hover:underline"
                  >
                    原评论 <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
