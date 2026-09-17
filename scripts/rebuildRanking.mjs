/**
 * 重建运行时排名数据 public/rankingData.json。
 *
 * 输入：
 *  1. src/data/killLineSeed.json            —— 模型结果（含结构化 rounds）
 *  2. scripts/.cache/bilibili_season.json   —— B站采集缓存（来自 sync_bilibili.py）
 *
 * 输出：
 *  public/rankingData.json，带 dataVersion。前端靠 dataVersion 判断是否需要重排。
 *
 * 分数本身不在这一步算：payload 里带 rounds + scoreMode，
 * 由前端 scoreEngine 统一推导，保证评分逻辑只有一份实现。
 *
 * 运行： node scripts/rebuildRanking.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const seedFile = resolve(root, "src/data/killLineSeed.json");
const seasonCacheFile = resolve(root, "scripts/.cache/bilibili_season.json");
const outFile = resolve(root, "public/rankingData.json");

const scoreMode =
  process.env.RANKING_SCORE_MODE === "computed" ? "computed" : "curated";

const seed = JSON.parse(readFileSync(seedFile, "utf8"));

// 正片来自合集，extras 是 UP主没放进合集、但标题命中搜索的视频
let episodes = seed.episodes ?? [];
let extras = [];
if (existsSync(seasonCacheFile)) {
  const cache = JSON.parse(readFileSync(seasonCacheFile, "utf8"));
  if (Array.isArray(cache.episodes) && cache.episodes.length > 0) {
    episodes = cache.episodes.map((ep) => ({
      ...episodes.find((e) => e.bvid === ep.bvid),
      ...ep,
    }));
  }
  extras = Array.isArray(cache.extras) ? cache.extras : [];
}

// 所有已知视频 = 正片 + 未进合集的
const videos = [...episodes, ...extras.map((e) => ({ ...e, ep: e.ep ?? 0 }))];

// 已被榜单覆盖的视频：既有 seed 里的正片，也有模型记录里引用到的 bvid
const covered = new Set([
  ...(seed.episodes ?? []).map((e) => e.bvid),
  ...seed.models.flatMap((m) => (m.bilibiliBvid ? [m.bilibiliBvid] : [])),
]);

// 已发布但没有任何模型结果引用的 -> 需要人工补录 rounds
const pendingEpisodes = videos.filter((v) => !covered.has(v.bvid));

// 三个时间必须分开，否则"更新于"会骗人：
// 数据重建时间再新，也不代表最新一期的实测结果已经录进去了
const maxPubdate = (list) =>
  list.reduce((max, v) => Math.max(max, v.pubdate || 0), 0);
const latestContentAt = maxPubdate(videos);
const latestRecordedAt = maxPubdate(videos.filter((v) => covered.has(v.bvid)));

const hash = (value) =>
  createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);

const payload = {
  schemaVersion: 1,
  scoreMode,
  dataVersion: hash({ models: seed.models, videos }),
  /** 数据文件重建时间（跑脚本的时刻） */
  updatedAt: new Date().toISOString(),
  /** UP主最新一条相关视频的发布时间 */
  latestContentAt: latestContentAt ? new Date(latestContentAt * 1000).toISOString() : "",
  /** 榜单已录入结果的最新一期发布时间 */
  latestRecordedAt: latestRecordedAt
    ? new Date(latestRecordedAt * 1000).toISOString()
    : "",
  scoring: {
    weights: { gold: 0.2, diamond: 0.35, king: 0.45 },
    decay: 0.7,
  },
  source: seed.source,
  episodes,
  videos,
  pendingEpisodes,
  models: seed.models,
};

writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

const fmt = (iso) => (iso ? iso.slice(0, 16).replace("T", " ") + " (UTC)" : "—");
console.log(
  `[rebuildRanking] ${payload.models.length} 条模型 / 正片 ${episodes.length} 期 / ` +
    `站外 ${extras.length} 条 / 待补录 ${pendingEpisodes.length} 条 · ` +
    `dataVersion=${payload.dataVersion} (${scoreMode})`
);
console.log(
  `  UP主最新内容 ${fmt(payload.latestContentAt)} · 榜单已录至 ${fmt(
    payload.latestRecordedAt
  )} · 数据重建 ${fmt(payload.updatedAt)}`
);
if (pendingEpisodes.length > 0) {
  pendingEpisodes.forEach((ep) =>
    console.log(
      `  待补录: ${ep.bvid} ${new Date((ep.pubdate || 0) * 1000)
        .toISOString()
        .slice(0, 10)} ${ep.title}`
    )
  );
}
