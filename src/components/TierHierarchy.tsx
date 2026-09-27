import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Eye, Crown, Target, Sparkles, TrendingUp } from "lucide-react";

interface TierHierarchyProps {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface TierPyramidItem {
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  badge: string;
  badgeTag: string;
  maxWidth: string;
  colorName: string;
  textAccent: string;
  borderClass: string;
  hoverBorderClass: string;
  bgGradient: string;
  hoverBg: string;
  glowShadow: string;
  avgScore: number;
  scoreRange: string;
  models: { name: string; score: number; highlightNote: string }[];
  passSummary: string;
  desc: string;
}

const PYRAMID_TIERS: TierPyramidItem[] = [
  {
    tier: "T0",
    badge: "金字塔尖 · 唯一断层登顶",
    badgeTag: "三关全一轮秒杀",
    maxWidth: "max-w-lg",
    colorName: "rose",
    textAccent: "text-rose-700",
    borderClass: "border-rose-300",
    hoverBorderClass: "hover:border-rose-400",
    bgGradient: "bg-gradient-to-b from-rose-50 via-rose-50 to-white",
    hoverBg: "group-hover:from-rose-100 group-hover:to-white",
    glowShadow: "shadow-[0_8px_24px_rgba(190,18,60,0.08)] hover:shadow-[0_12px_28px_rgba(190,18,60,0.14)]",
    avgScore: 99.5,
    scoreRange: "98.0 ~ 100.0 分",
    passSummary: "王者: 100% 一轮秒杀 · 钻石: 100% 一轮秒杀",
    desc: "黄金 / 钻石 / 王者三轮均直接一轮秒杀。全场唯一全关卡断层第一，恶劣工况代码收敛无争议登顶。",
    models: [
      { name: "GPT-6 Astra", score: 99.5, highlightNote: "全场唯一钻石+王者全一轮秒杀" },
    ],
  },
  {
    tier: "T1",
    badge: "突围旗舰 · 王者常客",
    badgeTag: "王者线突破者",
    maxWidth: "max-w-2xl",
    colorName: "amber",
    textAccent: "text-amber-800",
    borderClass: "border-amber-300",
    hoverBorderClass: "hover:border-amber-400",
    bgGradient: "bg-gradient-to-b from-amber-50 to-white",
    hoverBg: "group-hover:from-amber-100 group-hover:to-white",
    glowShadow: "shadow-[0_6px_18px_rgba(180,83,9,0.07)] hover:shadow-[0_10px_24px_rgba(180,83,9,0.13)]",
    avgScore: 91.0,
    scoreRange: "88.0 ~ 93.0 分",
    passSummary: "王者: 曾2~3轮突破 (67%) · 钻石: 100% 稳过",
    desc: "王者绝壁曾成功做对；钻石线发挥优异，高算力长思考模式能顶住代码幻觉与逻辑陷阱。",
    models: [
      { name: "Grok 4.6", score: 93.0, highlightNote: "王者曾两轮做对入选 T1" },
      { name: "Claude Fable 5.1", score: 92.0, highlightNote: "钻石一轮秒、王者需三轮" },
      { name: "DeepSeek V4 Pro", score: 88.0, highlightNote: "王者曾两轮解出，钻石偶有波动" },
    ],
  },
  {
    tier: "T2",
    badge: "性价比之王 · 钻石杀手",
    badgeTag: "一轮秒杀钻石",
    maxWidth: "max-w-3xl",
    colorName: "blue",
    textAccent: "text-blue-700",
    borderClass: "border-blue-300",
    hoverBorderClass: "hover:border-blue-400",
    bgGradient: "bg-gradient-to-b from-blue-50 to-white",
    hoverBg: "group-hover:from-blue-100 group-hover:to-white",
    glowShadow: "shadow-[0_6px_18px_rgba(37,99,235,0.06)] hover:shadow-[0_10px_24px_rgba(37,99,235,0.12)]",
    avgScore: 84.0,
    scoreRange: "80.0 ~ 87.0 分",
    passSummary: "钻石: 100% 一轮秒杀 (¥6.10) · 王者: 未突破",
    desc: "狂烧 1.17 亿词元，以极低总价 (¥6.10) 一轮秒杀钻石难题，是四家 Flash 级中唯一冲过钻石分水岭的模型。",
    models: [
      { name: "DeepSeek V4.1 Flash", score: 84.0, highlightNote: "狂烧 1.17 亿 Token 仅 ¥6.10 秒杀钻石" },
    ],
  },
  {
    tier: "T3",
    badge: "效率平替 · 钻石折戟",
    badgeTag: "Token 极限省流 / 钻石卡死",
    maxWidth: "max-w-4xl",
    colorName: "emerald",
    textAccent: "text-emerald-700",
    borderClass: "border-emerald-200",
    hoverBorderClass: "hover:border-emerald-400",
    bgGradient: "bg-gradient-to-b from-emerald-50 to-white",
    hoverBg: "group-hover:from-emerald-100 group-hover:to-white",
    glowShadow: "hover:shadow-[0_10px_24px_rgba(4,120,87,0.12)]",
    avgScore: 68.0,
    scoreRange: "65.0 ~ 72.0 分",
    passSummary: "黄金: 100% 稳过 · 钻石: 卡死长考未破",
    desc: "GLM 单期消耗仅 ~¥2，Token 效率极高；Qwen 开启深度长考。但两者最终均无法突破钻石分水岭，王者级全灭。",
    models: [
      { name: "GLM 5.3 Flash", score: 69.0, highlightNote: "极高能效 ~¥2/期，但钻石长时间卡住" },
      { name: "Qwen 3.8 Flash", score: 67.0, highlightNote: "长考近2小时仍未能突破钻石难题" },
    ],
  },
  {
    tier: "T4",
    badge: "工程基座 · 恶劣折损区",
    badgeTag: "恶劣代码收敛困难",
    maxWidth: "max-w-5xl",
    colorName: "zinc",
    textAccent: "text-ink-subtle",
    borderClass: "border-stone-200",
    hoverBorderClass: "hover:border-stone-400",
    bgGradient: "bg-surface-soft",
    hoverBg: "group-hover:bg-stone-50",
    glowShadow: "hover:shadow-[0_8px_20px_rgba(28,25,23,0.08)]",
    avgScore: 45.0,
    scoreRange: "40.0 ~ 50.0 分",
    passSummary: "黄金: 勉强收敛 · 钻石与王者: 跨12期从未做对",
    desc: "在恶劣工程代码工况下收敛困难，跨 12 期钻石与王者难题从未做对（注：仅指代代码 Debug 场景，不代表通用问答水平）。",
    models: [
      { name: "Gemini 3.8", score: 46.0, highlightNote: "黄金全对，钻石以上 12 期从未做对" },
      { name: "Opus 4.8", score: 44.0, highlightNote: "恶劣工况下逻辑高频震荡翻车" },
    ],
  },
];

export const TierHierarchy: React.FC<TierHierarchyProps> = ({
  onMouseEnter,
  onMouseLeave,
}) => {
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Generate high-resolution Pyramid Infographic Poster on HTML5 Canvas
  const generatePosterImage = (): string => {
    const canvas = document.createElement("canvas");
    const dpr = 2; // 2x Retina quality
    const width = 1200;
    const height = 1100;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#f7f4ef";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(120, 113, 108, 0.16)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Header Badge
    ctx.fillStyle = "rgba(254, 228, 228, 0.8)";
    ctx.strokeStyle = "rgba(190, 18, 60, 0.35)";
    ctx.beginPath();
    ctx.roundRect(width / 2 - 130, 40, 260, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#be123c";
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("▲ 屎山论剑全 12 期 · 战力金字塔", width / 2, 58);

    // Main Title
    ctx.fillStyle = "#1c1917";
    ctx.font = "italic 700 42px 'Playfair Display', serif";
    ctx.fillText("The Battle Pyramid", width / 2, 115);

    ctx.fillStyle = "#78716c";
    ctx.font = "400 14px 'JetBrains Mono', sans-serif";
    ctx.fillText("20+ 款模型极限斩杀线与实测定位 · 6,075 条弹幕交叉验证", width / 2, 144);

    // Draw Pyramid Levels
    let startY = 185;
    const gap = 16;
    const levelWidths: Record<string, number> = {
      T0: 480,
      T1: 650,
      T2: 800,
      T3: 940,
      T4: 1060,
    };

    PYRAMID_TIERS.forEach((item) => {
      const w = levelWidths[item.tier];
      const h = 110;
      const left = (width - w) / 2;

      // Glow effect for T0
      if (item.tier === "T0") {
        ctx.shadowColor = "rgba(190, 18, 60, 0.18)";
        ctx.shadowBlur = 25;
      } else {
        ctx.shadowBlur = 0;
      }

      // Box
      ctx.fillStyle = item.tier === "T0" ? "rgba(254, 228, 228, 0.8)" : "rgba(255, 255, 255, 0.78)";
      ctx.strokeStyle = item.tier === "T0" ? "#be123c" : "rgba(120, 113, 108, 0.35)";
      ctx.lineWidth = item.tier === "T0" ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(left, startY, w, h, 12);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Content inside Level
      ctx.textAlign = "left";

      // Tier title
      ctx.fillStyle = item.tier === "T0" ? "#be123c" : item.tier === "T1" ? "#b45309" : item.tier === "T2" ? "#2563eb" : item.tier === "T3" ? "#047857" : "#57534e";
      ctx.font = "italic 700 36px 'Playfair Display', serif";
      ctx.fillText(item.tier, left + 24, startY + 50);

      // Badge
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillText(item.badge, left + 92, startY + 36);

      // Score
      ctx.fillStyle = "#1c1917";
      ctx.font = "700 14px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`均分 ${item.avgScore} (${item.scoreRange})`, left + w - 24, startY + 36);

      // Models
      ctx.textAlign = "left";
      ctx.fillStyle = "#1c1917";
      ctx.font = "600 17px 'Inter', sans-serif";
      const modelNames = item.models.map((m) => m.name).join(" · ");
      ctx.fillText(modelNames, left + 92, startY + 65);

      // Desc
      ctx.fillStyle = "#57534e";
      ctx.font = "300 12px 'Inter', sans-serif";
      ctx.fillText(item.desc, left + 92, startY + 92);

      startY += h + gap;
    });

    // Footer
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a837d";
    ctx.font = "400 11px 'JetBrains Mono', monospace";
    ctx.fillText(
      "CONFIDENTIAL BENCHMARK AUDIT · BILIBILI @TOKEN就是词元 ｜ ZERO HALLUCINATION",
      width / 2,
      height - 35
    );

    return canvas.toDataURL("image/png");
  };

  const handleDownloadPoster = () => {
    setIsExporting(true);
    try {
      const dataUrl = generatePosterImage();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "shishan-pyramid-hierarchy.png";
      a.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewPoster = () => {
    const dataUrl = generatePosterImage();
    setPreviewImage(dataUrl);
  };

  return (
    <section className="mb-20 sm:mb-28">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between border-b border-stone-200 pb-4 mb-8 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 font-mono-code text-[11px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              <Crown className="w-3 h-3" />
              <span>THE PYRAMID · 实战金字塔</span>
            </span>
          </div>
          <h2 className="font-serif-title italic text-3xl sm:text-4xl text-ink font-normal leading-tight">
            The Battle Pyramid
          </h2>
          <span className="font-mono-code text-[11px] text-ink-subtle tracking-wider uppercase block mt-1">
            鼠标悬停探查各梯队战力均分区间 · 点击可导出高清金字塔长图
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 font-mono-code text-xs">
          <button
            onClick={handlePreviewPoster}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-50 hover:bg-stone-100 border border-stone-300 text-ink-muted hover:text-ink transition-colors"
            title="在线预览高清战力海报"
          >
            <Eye className="w-3.5 h-3.5 text-ink-muted" />
            <span>预览海报</span>
          </button>

          <button
            onClick={handleDownloadPoster}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-rose-100 hover:bg-rose-500/30 border border-rose-300 text-rose-700 hover:text-rose-900 transition-colors font-medium shadow-[0_8px_20px_rgba(190,18,60,0.12)]"
            title="一键导出高清金字塔长图"
          >
            <Download className="w-3.5 h-3.5 text-rose-700" />
            <span>{isExporting ? "出图中..." : "导出金字塔图"}</span>
          </button>
        </div>
      </div>

      {/* Visual Pyramid Container */}
      <div className="relative py-6 px-2 sm:px-4 flex flex-col items-center gap-3.5 select-none">
        {/* Pyramid Apex Light Ray Beam */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-rose-50 blur-3xl pointer-events-none" />

        {PYRAMID_TIERS.map((tierItem, index) => {
          const isT0 = tierItem.tier === "T0";
          const isHovered = hoveredTier === tierItem.tier;
          const isOtherHovered = hoveredTier !== null && !isHovered;

          return (
            <React.Fragment key={tierItem.tier}>
              {/* Level Card with Hover Interactions */}
              <div
                onMouseEnter={() => {
                  setHoveredTier(tierItem.tier);
                  if (onMouseEnter) onMouseEnter();
                }}
                onMouseLeave={() => {
                  setHoveredTier(null);
                  if (onMouseLeave) onMouseLeave();
                }}
                className={`w-full ${tierItem.maxWidth} relative group transition-all duration-300 ${
                  isHovered
                    ? "scale-[1.025] z-30"
                    : isOtherHovered
                    ? "opacity-60 scale-[0.99] z-10"
                    : "z-10"
                }`}
              >
                {/* Apex Crown Indicator for T0 */}
                {isT0 && (
                  <div className="flex justify-center -mb-2.5 relative z-20">
                    <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-rose-700 text-white font-mono-code text-[10px] font-semibold tracking-wider uppercase shadow-[0_6px_16px_rgba(190,18,60,0.14)] animate-pulse">
                      <Crown className="w-3 h-3 text-white" />
                      <span>金字塔尖 · 唯一断层登顶</span>
                    </span>
                  </div>
                )}

                {/* Main Tier Block */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative backdrop-blur-sm ${
                    tierItem.bgGradient
                  } ${tierItem.borderClass} ${tierItem.hoverBorderClass} ${tierItem.glowShadow} ${
                    isHovered ? "ring-1 ring-stone-300" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Tier Pillar & Content */}
                    <div className="flex items-start gap-3.5 sm:gap-4 flex-1">
                      <span
                        className={`font-serif-title italic text-4xl sm:text-5xl font-bold leading-none shrink-0 ${
                          tierItem.textAccent
                        } ${isHovered ? "shadow-[0_5px_14px_rgba(28,25,23,0.12)]" : ""}`}
                      >
                        {tierItem.tier}
                      </span>

                      <div className="flex-1">
                        {/* Tier Title & Highlight Badge */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono-code text-[11px] text-ink-muted">
                            {tierItem.badge}
                          </span>
                          <span
                            className={`font-mono-code text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              isHovered
                                ? "bg-stone-900 text-white font-semibold border-stone-700"
                                : "bg-stone-50 text-ink-muted border-stone-200"
                            }`}
                          >
                            {tierItem.badgeTag}
                          </span>
                        </div>

                        {/* Model Names: HIGH-CONTRAST HIGHLIGHT on Hover */}
                        <div className="flex items-center gap-2 flex-wrap my-1.5">
                          {tierItem.models.map((model) => (
                            <span
                              key={model.name}
                              className={`text-base sm:text-lg font-semibold tracking-tight transition-all duration-200 px-2 py-0.5 rounded ${
                                isHovered
                                  ? "bg-stone-100 text-ink shadow-[0_8px_20px_rgba(28,25,23,0.08)] font-bold scale-[1.03]"
                                  : "text-ink"
                              }`}
                            >
                              {model.name}
                            </span>
                          ))}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-ink-muted font-light mt-1.5 leading-relaxed">
                          {tierItem.desc}
                        </p>
                      </div>
                    </div>

                    {/* Right: Score Column */}
                    <div className="text-right font-mono-code shrink-0">
                      <div className="text-[10px] text-ink-subtle uppercase">综合战力均分</div>
                      <div
                        className={`text-2xl sm:text-3xl font-bold transition-transform duration-200 ${
                          tierItem.textAccent
                        } ${isHovered ? "scale-110 shadow-[0_5px_14px_rgba(28,25,23,0.12)]" : ""}`}
                      >
                        {tierItem.avgScore}
                      </div>
                      <div className="text-[10px] text-ink-muted mt-0.5 font-sans">
                        {tierItem.scoreRange}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ---------------- FLOATING TRANSLUCENT POPOVER CARD ON HOVER ---------------- */}
                {isHovered && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[92%] sm:w-auto sm:min-w-[360px] max-w-lg p-3.5 rounded-xl bg-white/95 border-stone-200 shadow-[0_12px_32px_rgba(28,25,23,0.14)] animate-fadeIn font-mono-code text-xs">
                    {/* Popover Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-200">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        <Target className="w-3.5 h-3.5 text-rose-700" />
                        <span>{tierItem.tier} 梯队实战区间档案</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-ink-muted">
                        战力区间: {tierItem.scoreRange}
                      </span>
                    </div>

                    {/* Pass Breakdown & Models detail */}
                    <div className="space-y-1.5 text-ink-muted text-[11px]">
                      <div className="flex justify-between items-center text-ink-muted">
                        <span>通关胜率画像：</span>
                        <span className="text-ink font-medium">{tierItem.passSummary}</span>
                      </div>

                      <div className="pt-1.5 border-t border-stone-200 text-[11px] text-ink-muted">
                        <div className="text-[10px] text-ink-subtle mb-1 uppercase">
                          已高亮入围模型细分：
                        </div>
                        <div className="space-y-1">
                          {tierItem.models.map((m) => (
                            <div key={m.name} className="flex justify-between items-center">
                              <span className="text-ink font-medium">• {m.name}</span>
                              <span className="text-ink-muted text-[10px]">{m.highlightNote}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Downward Connecting Notch */}
              {index < PYRAMID_TIERS.length - 1 && (
                <div
                  className={`text-ink-subtle font-mono text-xs transition-opacity duration-200 ${
                    hoveredTier ? "opacity-30" : "opacity-60"
                  }`}
                >
                  ▼
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Footnote */}
      <div className="mt-6 p-3 rounded-lg bg-surface-soft border border-stone-200 text-[11px] font-mono-code text-ink-subtle flex items-center justify-between flex-wrap gap-2">
        <span>▲ 鼠标悬停可即时查看各梯队的分数区间与通关画像；阶梯宽度依模型淘汰漏斗成形。</span>
        <button
          onClick={handleDownloadPoster}
          className="text-rose-700 hover:text-rose-700 transition-colors inline-flex items-center gap-1"
        >
          <Download className="w-3 h-3" />
          <span>导出金字塔高清图</span>
        </button>
      </div>

      {/* High-Resolution Poster Modal */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-0 bg-stone-950/50 backdrop-blur-md"
              onClick={() => setPreviewImage(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-surface border border-stone-300 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-[0_25px_70px_rgba(28,25,23,0.18)] flex flex-col z-10 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-300 mb-4 font-mono-code text-xs">
                <span className="text-ink font-medium flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-rose-700" />
                  <span>屎山论剑实战金字塔 · 高清图预览</span>
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={previewImage}
                    download="shishan-pyramid-hierarchy.png"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-rose-700 text-white font-medium text-xs hover:bg-rose-600 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载原图</span>
                  </a>
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="text-ink-muted hover:text-ink text-base font-mono-code p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden border border-stone-300 shadow-2xl bg-[#f7f4ef]">
                <img
                  src={previewImage}
                  alt="战力金字塔高清图"
                  className="w-full h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="mt-3 text-center text-ink-subtle font-mono-code text-[11px]">
                右键图片可直接复制或保存为高清 PNG 随时分享
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
