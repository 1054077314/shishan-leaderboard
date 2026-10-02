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

/** 种子数据：原始记录 + 可计算的结构化轮次 + 官方考核分（无官方考核为 null） */
export interface KillLineSeedRecord extends KillLineRecord {
  rounds: RoundTriple;
  curatedScore: number | null;
  /** 结尾板自动识别折算的分数，存在时直接生效（覆盖 curatedScore） */
  autoScore?: number;
  autoEvidence?: AutoEvidence[];
}

/** 排名计算后的记录：分数、名次、名次变动都已实体化 */
export interface RankedKillLineRecord extends KillLineSeedRecord {
  /** 由 rounds 推导出的分数 */
  computedScore: number;
  /** 当前生效分数（toy 主源 = 官方考核分，无考核为 null，前端显示 —） */
  score: number | null;
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
  /** 视频元信息（toy 主源下 episodes/videos 为空，仅保留类型兼容） */
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
  /** 评论区第二信源核实结果；没跑过 sync_comments.py 为 null */
  comments?: CommentsVerification | null;
  /** toy 三榜原始透出（挑战榜/考核榜/小组/总积分），字段名沿用官方口径 */
  boards?: {
    ladder: Array<{ rank: number; name: string; org: string; note: string; trend: string; delta: number }>;
    kaohe?: Array<{
      name: string;
      total: number;
      rank: number | null;
      date?: string | null;
      duration?: string | null;
      byTier: Record<string, number> | null;
      unlock: { baseScore: number; diamondUnlocked: boolean; kingUnlocked: boolean; reached: string } | null;
      /** 官方声明本场成绩存疑（如疑似作弊）时的原话，非空即不可作为可靠参照 */
      disputed?: string | null;
      highlights?: string[];
    }>;
    standingsGroups: Array<{ group: string; state: string; members: Array<{ name: string; wdl: string; pts: number }> }>;
    standingsTotal: Array<{ rank: number; name: string; org: string; wdl: string; pts: number }>;
    latestBoutDate: string;
  };
  models: KillLineSeedRecord[];
}

/**
 * 屎山英雄榜（toy 官方）逐版本扩展字段，由 scripts/rebuildRanking.mjs 直出。
 *
 * ⚠️ statsScope 是这一整块数据的取数口径声明：挑战榜每行是一个具体版本，
 * 斩杀线只能来自 players[slug].byVersion[version]（"version"）。
 * 曾经实现误用了家族生涯累计（career），导致 GLM5.3 与 GLM5.3Flash
 * 显示同一列数据；现在前端与 tests 都按该字段校验。
 */
export interface ToyModelMeta {
  /** 官方挑战榜名次，前端排序唯一依据 */
  rank: number;
  org: string;
  trend: string;
  delta: number;
  family: string | null;
  /** player-data 里的版本 label；未解析出则为 null */
  version: string | null;
  statsScope: "version" | "family" | "none";
  /** 本版出战场次（byVersion.volume），未解析为 null */
  versionVolume: number | null;
  /** 挂靠的官方考核场次名，无官方考核为 null */
  assessmentName: string | null;
  assessmentTotal: number | null;
  hasRealAssess: boolean;
  /** 官方对该考核场次的存疑声明原话，非空即成绩不可作为可靠参照 */
  assessmentDisputed: string | null;
  /** 总积分榜对齐结果：exact=两榜名一致，alias=按登记表关联，null=未对上 */
  groupMatch: "exact" | "alias" | null;
  groupWdl: string | null;
  groupPts: number | null;
}

/** 评论区核实断言的核对结果 */
export type CommentClaimStatus = "confirmed" | "conflict" | "unverifiable" | "ambiguous";

/** 断言来源信任级：official=UP主本人，endorsed=置顶/UP主点赞回复，community=热评 */
export type CommentTrust = "official" | "endorsed" | "community";

/** 一条从评论里提取并与官方榜核对过的断言 */
export interface CommentClaim {
  /** 指向的上榜模型/版本显示名；歧义断言为 null */
  model: string | null;
  modelKey: string | null;
  /** 评论里的原始叫法（norm 后），歧义时靠它呈现 */
  mentionKey: string | null;
  kind: "kaoheTotal" | "ladderRank" | "wdl" | "standingsPts";
  /** 评论里的说法，如 "12/18"、"第3名"、"2-0-0"、"积4分" */
  claimed: string;
  /** 官方榜对应值；官方没这项数据时为 null */
  expected: string | null;
  status: CommentClaimStatus;
  trust: CommentTrust;
  ep: number;
  bvid: string;
  rpid: string;
  uname: string;
  like: number;
  excerpt: string;
}

/** UP主官方声音里的勘误/声明（不参与断言核对，直接展示） */
export interface CommentNotice {
  ep: number;
  bvid: string;
  rpid: string;
  uname: string;
  trust: CommentTrust;
  excerpt: string;
}

/** 评论区第二信源核实的整体结果 */
export interface CommentsVerification {
  fetchedAt: string;
  /** false = 匿名采集（B站只给置顶+3条热评），覆盖面有限 */
  authenticated: boolean;
  stats: {
    videos: number;
    scanned: number;
    claims: number;
    confirmed: number;
    conflict: number;
    unverifiable: number;
    ambiguous: number;
  };
  notices: CommentNotice[];
  claims: CommentClaim[];
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
  /** 出战场次标签（如「本版 25 场」），口径见 toy.statsScope；无口径为空串 */
  volumeLabel: string;
  analysis: string;
  strengths: string[];
  weaknesses: string[];
  bestFor: string;
  /** 官方考核分（total/18×100）；无官方考核为 null，前端统一显示 — */
  score: number | null; // null = 无官方考核记录
  /** 屎山英雄榜逐版本扩展字段（toy 主源专有），详见 ToyModelMeta */
  toy?: ToyModelMeta;
  bilibiliAid?: string;
  bilibiliBvid?: string;
  sourceEpisodeTitle?: string;
}

