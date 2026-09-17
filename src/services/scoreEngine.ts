import {
  KillLineSeedRecord,
  RankedKillLineRecord,
  RoundResult,
  RoundTriple,
  ScoreMode,
} from "../types";

export interface ScoringWeights {
  gold: number;
  diamond: number;
  king: number;
}

export interface ScoringConfig {
  mode: ScoreMode;
  weights: ScoringWeights;
  /** 每多一轮的分数衰减系数，越小代表轮次惩罚越重 */
  decay: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  // curated：沿用人工分数，保证改版前后榜单展示一致
  // 改成 "computed" 即切换为完全由 rounds 推导，UP主更新后可全自动重排
  mode: "curated",
  weights: { gold: 0.2, diamond: 0.35, king: 0.45 },
  decay: 0.7,
};

/**
 * 单条斩杀线得分：
 * - none 返回 null，表示不计入分母（未参测不惩罚）
 * - fail 记 0 分，照常计入分母
 * - 数字代表通过轮次，每多一轮按 decay 衰减
 */
export function roundScore(round: RoundResult, decay: number): number | null {
  if (round === "none") return null;
  if (round === "fail") return 0;
  return 100 * Math.pow(decay, round - 1);
}

/**
 * 由结构化轮次推导综合战力分（0-100，保留一位小数）
 */
export function computeScore(rounds: RoundTriple, config: ScoringConfig): number {
  const levels: Array<{ weight: number; round: RoundResult }> = [
    { weight: config.weights.gold, round: rounds.gold },
    { weight: config.weights.diamond, round: rounds.diamond },
    { weight: config.weights.king, round: rounds.king },
  ];

  let weighted = 0;
  let total = 0;

  levels.forEach(({ weight, round }) => {
    const s = roundScore(round, config.decay);
    if (s === null) return;
    weighted += weight * s;
    total += weight;
  });

  if (total === 0) return 0;
  return Math.round((weighted / total) * 10) / 10;
}

/**
 * 把种子记录补齐成分数记录：
 * curated 模式沿用人工分数，computed 模式用推导分数
 */
export function withScores(
  models: KillLineSeedRecord[],
  config: ScoringConfig = DEFAULT_SCORING
): Array<RankedKillLineRecord & { rank: number; rankDelta: number }> {
  return models.map((m) => {
    const computedScore = computeScore(m.rounds, config);
    return {
      ...m,
      computedScore,
      score: config.mode === "computed" ? computedScore : m.curatedScore,
      rank: 0,
      rankDelta: 0,
    };
  });
}

/**
 * 名次比较器：分数降序 → 王者轮次升序 → 钻石轮次升序 → 名称
 * 轮次越小越好，同为 "fail"/"none" 时按固定权重兜底，保证排序稳定可复现
 */
function roundRank(round: RoundResult): number {
  if (round === "none") return 99;
  if (round === "fail") return 50;
  return round;
}

export function compareForRank(
  a: RankedKillLineRecord,
  b: RankedKillLineRecord
): number {
  if (b.score !== a.score) return b.score - a.score;
  const king = roundRank(a.rounds.king) - roundRank(b.rounds.king);
  if (king !== 0) return king;
  const diamond = roundRank(a.rounds.diamond) - roundRank(b.rounds.diamond);
  if (diamond !== 0) return diamond;
  const gold = roundRank(a.rounds.gold) - roundRank(b.rounds.gold);
  if (gold !== 0) return gold;
  return a.model.localeCompare(b.model);
}

export type RankMap = Record<string, number>;

/**
 * 名次实体化：在全量榜上生成 rank，并与上一次快照 diff 出 rankDelta。
 * 名次不受筛选影响，因此筛选后看到的仍是全局名次。
 */
export function applyRanking(
  models: KillLineSeedRecord[],
  previous: RankMap | null,
  config: ScoringConfig = DEFAULT_SCORING
): { ranked: RankedKillLineRecord[]; ranks: RankMap } {
  const scored = withScores(models, config);
  scored.sort(compareForRank);

  const ranks: RankMap = {};
  const ranked = scored.map((m, index) => {
    const rank = index + 1;
    ranks[m.id] = rank;
    const prev = previous?.[m.id];
    return {
      ...m,
      rank,
      rankDelta: prev === undefined ? 0 : prev - rank,
    };
  });

  return { ranked, ranks };
}
