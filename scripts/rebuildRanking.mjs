/**
 * 重建运行时排名数据 public/rankingData.json。
 *
 * 输入：
 *  1. src/data/killLineSeed.json      —— 模型结果（含结构化 rounds）
 *  2. scripts/.cache/bilibili_season.json —— B站采集缓存（可选，来自 sync_bilibili.py）
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

const scoreMode = process.env.RANKING_SCORE_MODE === "computed" ? "computed" : "curated";

const seed = JSON.parse(readFileSync(seedFile, "utf8"));

let episodes = seed.episodes ?? [];
if (existsSync(seasonCacheFile)) {
  const cache = JSON.parse(readFileSync(seasonCacheFile, "utf8"));
  if (Array.isArray(cache.episodes) && cache.episodes.length > 0) {
    // 以 B站实际发布为准，缺失的 pubdate 不覆盖已有数据
    episodes = cache.episodes.map((ep) => ({
      ...episodes.find((e) => e.bvid === ep.bvid),
      ...ep,
    }));
  }
}

// 已发布但种子里还没有对应结果的期数 -> 需要人工补录 rounds
const knownBvids = new Set(
  seed.models.flatMap((m) => (m.bilibiliBvid ? [m.bilibiliBvid] : []))
);
const pendingEpisodes = episodes.filter((ep) => !knownBvids.has(ep.bvid));

const hash = (value) =>
  createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);

const payload = {
  schemaVersion: 1,
  scoreMode,
  dataVersion: hash({ models: seed.models, episodes }),
  updatedAt: new Date().toISOString(),
  scoring: {
    weights: { gold: 0.2, diamond: 0.35, king: 0.45 },
    decay: 0.7,
  },
  source: seed.source,
  episodes,
  pendingEpisodes,
  models: seed.models,
};

writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(
  `[rebuildRanking] ${payload.models.length} 条模型 / ${episodes.length} 期 / ` +
    `待补录 ${pendingEpisodes.length} 期 · dataVersion=${payload.dataVersion} (${scoreMode})`
);
if (pendingEpisodes.length > 0) {
  pendingEpisodes.forEach((ep) =>
    console.log(`  待补录: 第${String(ep.ep).padStart(2, "0")}期 ${ep.bvid} ${ep.title}`)
  );
}
