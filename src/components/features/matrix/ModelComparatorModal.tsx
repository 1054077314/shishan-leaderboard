import React from "react";
import { KillLineRecord, StatusType } from "../../../types";
import { Modal } from "../../ui/Modal";
import { Badge } from "../../ui/Badge";
import { GitCompare, Trophy, Zap } from "lucide-react";

const kaoheLabel = (m: KillLineRecord): string =>
  m.score != null ? `${m.score}分` : "—";

export interface ModelComparatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: KillLineRecord[];
  allModels: KillLineRecord[];
  onSelectModelForSlot: (slotIndex: number, model: KillLineRecord) => void;
}

export const ModelComparatorModal: React.FC<ModelComparatorModalProps> = ({
  isOpen,
  onClose,
  models,
  allModels,
  onSelectModelForSlot,
}) => {
  const modelA = models[0];
  const modelB = models[1] || models[0];

  if (!modelA || !modelB) return null;

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
      maxWidth="4xl"
      title={
        <div className="flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-rose-700" />
          <span>双雄硬核对抗 · 斩杀线指标直面剖析</span>
        </div>
      }
      subtitle="选择任意两款实测模型，全方位对比黄金线、钻石线与王者绝壁抗压表现"
    >
      <div className="space-y-6">
        {/* Model Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slot A */}
          <div className="p-4 rounded-xl bg-surface-soft border border-stone-200 space-y-2">
            <label className="text-[11px] font-mono-code text-ink-muted block uppercase">
              模型 A (左侧对照)
            </label>
            <select
              value={modelA.id}
              onChange={(e) => {
                const found = allModels.find((m) => m.id === e.target.value);
                if (found) onSelectModelForSlot(0, found);
              }}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono-code text-ink focus:outline-none focus:border-rose-400"
            >
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model} ({m.tier} · {kaoheLabel(m)})
                </option>
              ))}
            </select>
          </div>

          {/* Slot B */}
          <div className="p-4 rounded-xl bg-surface-soft border border-stone-200 space-y-2">
            <label className="text-[11px] font-mono-code text-ink-muted block uppercase">
              模型 B (右侧对照)
            </label>
            <select
              value={modelB.id}
              onChange={(e) => {
                const found = allModels.find((m) => m.id === e.target.value);
                if (found) onSelectModelForSlot(1, found);
              }}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono-code text-ink focus:outline-none focus:border-rose-400"
            >
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model} ({m.tier} · {kaoheLabel(m)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Head-to-Head Comparison Table */}
        <div className="border border-stone-200 rounded-xl overflow-hidden font-mono-code text-xs">
          {/* Row: Score */}
          <div className="grid grid-cols-3 border-b border-stone-200 bg-surface-soft">
            <div className="p-3.5 text-ink-muted flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-800" />
              <span>官方考核分（total/18）</span>
            </div>
            <div className="p-3.5 font-bold text-ink border-x border-stone-200 text-base">
              {modelA.score ?? "—"}{" "}
              <span className="text-xs text-ink-subtle font-normal">
                {modelA.score != null ? `分 (${modelA.tier})` : `(${modelA.tier})`}
              </span>
            </div>
            <div className="p-3.5 font-bold text-ink text-base">
              {modelB.score ?? "—"}{" "}
              <span className="text-xs text-ink-subtle font-normal">
                {modelB.score != null ? `分 (${modelB.tier})` : `(${modelB.tier})`}
              </span>
            </div>
          </div>

          {/* Row: Gold Line */}
          <div className="grid grid-cols-3 border-b border-stone-200">
            <div className="p-3.5 text-ink-muted">黄金线 (基础入门)</div>
            <div className="p-3.5 border-x border-stone-200">
              {renderBadge(modelA.goldStatus, modelA.gold)}
            </div>
            <div className="p-3.5">{renderBadge(modelB.goldStatus, modelB.gold)}</div>
          </div>

          {/* Row: Diamond Line */}
          <div className="grid grid-cols-3 border-b border-stone-200 bg-surface-soft">
            <div className="p-3.5 text-ink-muted">钻石分水岭 (并发/死锁)</div>
            <div className="p-3.5 border-x border-stone-200">
              {renderBadge(modelA.diamondStatus, modelA.diamond)}
            </div>
            <div className="p-3.5">{renderBadge(modelB.diamondStatus, modelB.diamond)}</div>
          </div>

          {/* Row: King Line */}
          <div className="grid grid-cols-3 border-b border-stone-200">
            <div className="p-3.5 text-ink-muted">王者绝壁线 (极限业务)</div>
            <div className="p-3.5 border-x border-stone-200">
              {renderBadge(modelA.kingStatus, modelA.king)}
            </div>
            <div className="p-3.5">{renderBadge(modelB.kingStatus, modelB.king)}</div>
          </div>

          {/* Row: 出战场次（toy player-data，口径由 statsScope 声明） */}
          <div className="grid grid-cols-3 border-b border-stone-200 bg-surface-soft">
            <div className="p-3.5 text-ink-muted flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-emerald-700" />
              <span>出战场次</span>
            </div>
            <div className="p-3.5 font-bold text-ink border-x border-stone-200">
              {modelA.volumeLabel || "—"}
            </div>
            <div className="p-3.5 font-bold text-ink">
              {modelB.volumeLabel || "—"}
            </div>
          </div>

          {/* Row: 挑战榜名次 */}
          <div className="grid grid-cols-3 border-b border-stone-200">
            <div className="p-3.5 text-ink-muted">挑战榜名次</div>
            <div className="p-3.5 border-x border-stone-200 text-ink-muted">
              {modelA.toy?.rank != null ? `第 ${modelA.toy.rank} 名` : "—"}
            </div>
            <div className="p-3.5 text-ink-muted">
              {modelB.toy?.rank != null ? `第 ${modelB.toy.rank} 名` : "—"}
            </div>
          </div>

          {/* Row: UP Testimony */}
          <div className="grid grid-cols-3 bg-surface-soft">
            <div className="p-3.5 text-ink-muted">UP 主实测证言</div>
            <div className="p-3.5 border-x border-stone-200 text-amber-800 font-serif italic text-xs leading-relaxed">
              “{modelA.quote}”
            </div>
            <div className="p-3.5 text-amber-800 font-serif italic text-xs leading-relaxed">
              “{modelB.quote}”
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white font-semibold font-mono-code text-xs hover:bg-stone-700 transition-colors cursor-pointer"
          >
            完成对比
          </button>
        </div>
      </div>
    </Modal>
  );
};
