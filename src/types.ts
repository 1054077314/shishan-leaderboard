export type StatusType = "pass" | "warn" | "fail" | "none";

/** 单条斩杀线的实测结果：通过轮次 / 未通过 / 无记录 */
export type RoundResult = number | "fail" | "none";

export interface RoundTriple {
  gold: RoundResult;
  diamond: RoundResult;
  king: RoundResult;
}

/** 种子数据：原始记录 + 可计算的结构化轮次 + 人工分数 */
export interface KillLineSeedRecord extends KillLineRecord {
  rounds: RoundTriple;
  curatedScore: number;
}

/** 排名计算后的记录：分数、名次、名次变动都已实体化 */
export interface RankedKillLineRecord extends KillLineSeedRecord {
  /** 由 rounds 推导出的分数 */
  computedScore: number;
  /** 当前生效分数（取决于 scoreMode） */
  score: number;
  /** 全量榜中的名次，从 1 开始 */
  rank: number;
  /** 相对上一次数据版本的名次变动，正数为上升 */
  rankDelta: number;
}

export interface RankingEpisode {
  ep: number;
  bvid: string;
  title: string;
  pubdate?: number;
}

export interface RankingPayload {
  schemaVersion: number;
  scoreMode: ScoreMode;
  dataVersion: string;
  updatedAt: string;
  scoring: {
    weights: { gold: number; diamond: number; king: number };
    decay: number;
  };
  source: {
    upName: string;
    mid: string;
    seasonId: string;
  };
  episodes: RankingEpisode[];
  /** 已发布但结果尚未录入的期数，需要人工补录 rounds */
  pendingEpisodes: RankingEpisode[];
  models: KillLineSeedRecord[];
}

export type ScoreMode = "curated" | "computed";

export interface KillLineRecord {
  id: string;
  model: string;
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  category: "Flagship" | "Flash" | "OpenSource" | "Thinking";
  gold: string;
  diamond: string;
  king: string;
  goldStatus: StatusType;
  diamondStatus: StatusType;
  kingStatus: StatusType;
  quote: string;
  timestamp: string;
  episodesTested: string;
  costEstimate: string;
  tokensConsumed: string;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
  score: number; // 0 - 100 benchmark performance score
  bilibiliAid?: string;
  bilibiliBvid?: string;
  sourceEpisodeTitle?: string;
}

export interface CostRecord {
  id: string;
  model: string;
  cost: string;
  tokens: string;
  source: string;
  verdict: string;
  badge: string;
  costColor: string;
  estimatedCostYuan: number;
  tokenMillions: number;
  efficiencyRating: "S" | "A" | "B" | "C" | "F";
}

export interface TierRecord {
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  models: string;
  desc: string;
  badgeColor: string;
  summary: string;
}
