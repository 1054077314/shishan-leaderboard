export type StatusType = "pass" | "warn" | "fail" | "none";

/** 单条斩杀线的实测结果：通过轮次 / 未通过 / 无记录 */
export type RoundResult = number | "fail" | "none";

export interface RoundTriple {
  gold: RoundResult;
  diamond: RoundResult;
  king: RoundResult;
}

/** 自动识别给出的一条证据（命中花名册的结尾板行），已换算到 0-100 */
export interface AutoEvidence {
  score: number;
  /** hero=英雄榜分数/18；group=小组胜率 */
  kind: "hero" | "group";
  bvid: string;
  raw: string;
}

/** 种子数据：原始记录 + 可计算的结构化轮次 + 人工分数 */
export interface KillLineSeedRecord extends KillLineRecord {
  rounds: RoundTriple;
  curatedScore: number;
  /** 结尾板自动识别折算的分数，存在时直接生效（覆盖 curatedScore） */
  autoScore?: number;
  autoEvidence?: AutoEvidence[];
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
  /** season = 合集正片；search:xxx = 靠关键词搜索兜底捞到的 */
  source?: string;
  /** 视频结尾官方结算板的自动识别结果（extractEndingScores.py），仅供人工确认参考 */
  autoResults?: AutoResults;
}

/** 结尾板式的解析产物，识别不出的行留在 raw */
export interface AutoResults {
  extractedAt: string;
  quality: string;
  confidence: "high" | "low" | "none";
  boards: {
    /** draw=分组抽签板（POT 档位，无评分），结算板则不带 kind */
    kind?: "draw";
    hero?: { name: string; score: number; status?: string | null; matchedModel?: string }[];
    versus?: { a: string; b: string; scoreA?: string | null; scoreB?: string | null }[];
    group?: { name?: string; w?: number; d?: number; l?: number; raw: string; matchedModel?: string }[];
    draw?: { group?: string | null; name: string; pot: number; matchedModel?: string }[];
    raw?: string[];
  };
  matchedModels: string[];
}

export interface RankingPayload {
  schemaVersion: number;
  scoreMode: ScoreMode;
  dataVersion: string;
  /** 数据文件重建时间 */
  updatedAt: string;
  /** UP主最新一条相关视频的发布时间 */
  latestContentAt?: string;
  /** 榜单已录入结果的最新一期发布时间 */
  latestRecordedAt?: string;
  scoring: {
    weights: { gold: number; diamond: number; king: number };
    decay: number;
  };
  source: {
    upName: string;
    mid: string;
    seasonId: string;
    /** toy 主源标记：origin === "toy" 时 episodes/videos 为空，榜单来自英雄榜 */
    origin?: string;
    sourceUrl?: string;
    fetchedAt?: string;
  };
  episodes: RankingEpisode[];
  /** 正片 + 搜索命中到的全部视频 */
  videos?: RankingEpisode[];
  /** 已发布但结果尚未录入的期数，需要人工补录 rounds */
  pendingEpisodes: RankingEpisode[];
  /** toy 三榜全量（挑战榜/考核榜/小组/总积分），直供前端多榜展示 */
  boards?: {
    ladder: Array<{ rank: number; name: string; org: string; note: string; trend: string; delta: number }>;
    kaohe?: Array<{ name: string; total: number; rank: number | null; byTier: Record<string, number> | null; unlock: { baseScore: number; diamondUnlocked: boolean; kingUnlocked: boolean; reached: string } | null }>;
    standingsGroups: Array<{ group: string; state: string; members: Array<{ name: string; wdl: string; pts: number }> }>;
    standingsTotal: Array<{ rank: number; name: string; org: string; wdl: string; pts: number }>;
    latestBoutDate: string;
  };
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
