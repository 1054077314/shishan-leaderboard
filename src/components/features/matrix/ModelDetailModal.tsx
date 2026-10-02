import React from "react";
import { KillLineRecord, StatusType } from "../../../types";
import { Modal } from "../../ui/Modal";
import { Badge } from "../../ui/Badge";
import {
  Trophy,
  Lightbulb,
  ShieldAlert,
  Award,
} from "lucide-react";

export interface ModelDetailModalProps {
  model: KillLineRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCompare: (model: KillLineRecord) => void;
}

export const ModelDetailModal: React.FC<ModelDetailModalProps> = ({
  model,
  isOpen,
  onClose,
  onAddToCompare,
}) => {
  if (!model) return null;

  const renderBadge = (status: StatusType, text: string) => {
    if (status === "pass") return <Badge variant="emerald">{text}</Badge>;
    if (status === "warn") return <Badge variant="amber">{text}</Badge>;
    if (status === "fail") return <Badge variant="rose">{text}</Badge>;
    return <Badge variant="zinc">{text}</Badge>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-ink">{model.model}</span>
          <Badge
            variant={
              model.tier === "T0"
                ? "rose"
                : model.tier === "T1"
                ? "amber"
                : model.tier === "T2"
                ? "blue"
                : "emerald"
            }
          >
            {model.tier} 阶梯
          </Badge>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-3">
          <span>
            考核分:{" "}
            <strong className="text-ink">
              {model.score != null ? `${model.score} / 100` : "—"}
            </strong>
            {model.toy?.assessmentTotal != null
              ? `（官方考核 ${model.toy.assessmentTotal}/18）`
              : "（暂无官方考核记录）"}
          </span>
          {model.toy?.rank != null && (
            <span className="text-ink-muted">挑战榜第 {model.toy.rank} 名</span>
          )}
          {model.toy?.assessmentDisputed && (
            <span
              className="text-amber-700"
              title={model.toy.assessmentDisputed}
            >
              ⚠ 该考核成绩官方标注存疑
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {model.toy?.assessmentDisputed && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-900 font-mono-code">
            {model.toy.assessmentDisputed}
          </p>
        )}
        {/* Core Kill-Line Performance */}
        <div>
          <h4 className="text-xs font-mono-code text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-rose-700" />
            <span>三大天梯考核线表现</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-surface-soft border border-stone-200 space-y-1">
              <div className="text-[10px] font-mono-code text-ink-subtle uppercase">
                黄金线 (基础语法/单文件)
              </div>
              <div>{renderBadge(model.goldStatus, model.gold)}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-soft border border-stone-200 space-y-1">
              <div className="text-[10px] font-mono-code text-ink-subtle uppercase">
                钻石线 (并发死锁/多模块)
              </div>
              <div>{renderBadge(model.diamondStatus, model.diamond)}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-soft border border-stone-200 space-y-1">
              <div className="text-[10px] font-mono-code text-ink-subtle uppercase">
                王者线 (绝壁攻坚/一票否决)
              </div>
              <div>{renderBadge(model.kingStatus, model.king)}</div>
            </div>
          </div>
        </div>

        {/* Authentic Quote */}
        {model.quote && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-[11px] font-mono-code text-amber-800 font-semibold mb-1 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              <span>UP 主实测原话证言:</span>
            </div>
            <p className="text-xs font-serif italic text-amber-800 leading-relaxed">
              “{model.quote}”
            </p>
          </div>
        )}

        {/* Detailed Assessment */}
        {model.detailNote && (
          <div className="space-y-2">
            <h4 className="text-xs font-mono-code text-ink-muted uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-ink-muted" />
              <span>硬核工况与诊断记录</span>
            </h4>
            <div className="p-4 rounded-xl bg-stone-100 border border-stone-200 text-xs font-mono-code text-ink-muted leading-relaxed space-y-2">
              <p>{model.detailNote}</p>
            </div>
          </div>
        )}

        {/* 出战场次（toy player-data，口径由 statsScope 声明） */}
        {model.volumeLabel && (
          <div>
            <h4 className="text-xs font-mono-code text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-emerald-700" />
              <span>出战场次</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-surface-soft border border-stone-200 font-mono-code text-xs text-ink">
              {model.volumeLabel}
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-4 border-t border-stone-200 flex items-center justify-between flex-wrap gap-3">
          <span className="font-mono-code text-[11px] text-ink-subtle">
            来源：屎山英雄榜（toy 官方）
            {model.toy?.org ? ` · ${model.toy.org}` : ""}
            {model.toy?.version
              ? ` · 斩杀线取${model.toy.statsScope === "version" ? "本版" : "家族"}战绩（${model.toy.version}）`
              : ""}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => {
                onAddToCompare(model);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-ink hover:text-ink border border-stone-300 font-mono-code text-xs transition-colors cursor-pointer"
            >
              加入双雄对照
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white font-semibold font-mono-code text-xs hover:bg-stone-700 transition-colors cursor-pointer"
            >
              完成阅读
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
