/**
 * 一次性种子生成器：把 src/data/shishanData.ts 里的硬编码常量
 * 转成结构化种子 JSON（src/data/killLineSeed.json）。
 *
 * 为什么要这一步：
 * 原来 score 是手写字面量，无法自动重算。种子里额外补了 rounds
 * （黄金/钻石/王者各自的通过轮次），score 之后由 scoreEngine 推导。
 *
 * 运行： npx tsx scripts/generateSeed.ts
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { KILL_LINE_DATA } from "../src/data/shishanData";
import { BILIBILI_EPISODES, BILIBILI_UP_INFO } from "../src/data/bilibiliData";

export type RoundResult = number | "fail" | "none";

export interface RoundTriple {
  gold: RoundResult;
  diamond: RoundResult;
  king: RoundResult;
}

/**
 * 各模型三道斩杀线的实际通过轮次。
 * 依据 shishanData.ts 中 gold / diamond / king 的中文实测描述人工录入，
 * 只在建种子时需要，之后新一期结果由 scripts/sync_bilibili.py 的
 * pendingEpisodes 清单提示人工补录。
 */
const ROUNDS: Record<string, RoundTriple> = {
  "gpt-6-astra": { gold: 1, diamond: 1, king: 1 },
  "grok-46": { gold: 1, diamond: 1, king: 2 },
  "claude-fable-51": { gold: 1, diamond: 1.5, king: 3 },
  "deepseek-v4-pro": { gold: "none", diamond: "fail", king: 2 },
  "deepseek-v41-flash": { gold: 1, diamond: 1, king: "fail" },
  "glm-53-flash": { gold: 1, diamond: "fail", king: "fail" },
  "qwen-38-flash": { gold: 1, diamond: "fail", king: "fail" },
  "gemini-38": { gold: 3, diamond: "fail", king: "fail" },
  "glm-53-full": { gold: "none", diamond: "fail", king: "fail" },
  "kimi-k3": { gold: "none", diamond: "fail", king: "none" },
  "opus-48": { gold: "none", diamond: "fail", king: "fail" },
  "longcat-20": { gold: 1, diamond: 2, king: "fail" },
  "qwen-38-max": { gold: 1, diamond: 1, king: 3 },
  "grok-45": { gold: 1, diamond: 2, king: "fail" },
  "musespark-12": { gold: 2, diamond: "fail", king: "fail" },
};

const here = dirname(fileURLToPath(import.meta.url));
const outFile = resolve(here, "../src/data/killLineSeed.json");

const models = KILL_LINE_DATA.map((m) => {
  const rounds = ROUNDS[m.id];
  if (!rounds) {
    throw new Error(`缺少 ${m.id} 的 rounds 结构化结果，请先在 generateSeed.ts 中补录`);
  }
  return {
    ...m,
    rounds,
    // 保留原始人工分数，curated 模式下直接使用，保证改版前后展示一致
    curatedScore: m.score,
  };
});

const episodes = BILIBILI_EPISODES.map((ep) => ({
  ep: ep.episodeIndex,
  bvid: ep.bvid,
  title: ep.title,
}));

const seed = {
  source: {
    upName: BILIBILI_UP_INFO.name,
    mid: BILIBILI_UP_INFO.mid,
    seasonId: "8474061",
  },
  episodes,
  models,
};

writeFileSync(outFile, JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(
  `[generateSeed] 写出 ${models.length} 条模型种子 + ${episodes.length} 期视频 -> ${outFile}`
);
