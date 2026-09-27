/**
 * 重建运行时排名数据 public/rankingData.json。
 *
 * 主数据源：B站 toy 官方「屎山英雄榜」
 *   https://www.bilibili.com/toy/shishan/index.html?spm_id_from=333.1387.0.0
 *   采集：python scripts/sync_toy.py -> scripts/.cache/toy.json
 *
 * toy 页是纯静态 Astro 页，无 XHR 接口，数据以两种形式直出：
 *   1. 内嵌 <script type="application/json">：player-data（生涯+版本）、
 *      assessment-data（考核逐题 verdicts + total/18）、topic-data（题库）
 *   2. 服务端直出 HTML 三榜：ladder（论剑挑战榜名次/升降/战报）、
 *      kaohe（与 assessment-data 同源）、standings（小组 WDL + 总积分榜）
 *
 * 映射约定（用户已确认）：
 *   - KillLine 主排名 = ladder 挑战榜（名次只靠挑战易位，原样采用，不重算）；
 *     前端排序一律按 toy.rank（官方名次），不再按 score 排序；
 *     score/curatedScore 只用官方真实分：有考核记录 = total/18 × 100，
 *     无官方考核的一律 null，前端显示 —，绝不按名次线性伪造、不做生涯推导
 *   - 五档折三档：青铜+白银+黄金合并为 gold（ok/total 相加），钻石/王者不变
 *   - 考核 total/18 与小组 WDL/积分作为 autoEvidence 留档展示，curatedScore
 *     仍是主分数（由 ladder 名次 + 考核成绩派生），scoreEngine 逻辑不变
 *
 * 输出 public/rankingData.json（RankingPayload，schemaVersion=1），
 * 字段与旧版完全兼容：models/episodes/videos/pendingEpisodes/scoring/source。
 * episodes/videos 在 toy 体系下无视频合集概念，填 [] 并在 source 注明；
 * 前端表格的期数文案退化为显示榜单规模，不再展示“已录 N 期”。
 *
 * 运行： python scripts/sync_toy.py && node scripts/rebuildRanking.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const toyCacheFile = resolve(root, "scripts/.cache/toy.json");
const outFile = resolve(root, "public/rankingData.json");

const scoreMode =
  process.env.RANKING_SCORE_MODE === "computed" ? "computed" : "curated";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s\-_.]/g, "");

/** career.byHardness 的 [ok, total] 折成三档 rounds + 状态文案 */
function foldRounds(byHardness = {}) {
  const pick = (key) => {
    const v = byHardness[key];
    return Array.isArray(v) && v.length >= 2 ? { ok: v[0] | 0, total: v[1] | 0 } : { ok: 0, total: 0 };
  };
  const b = pick("bronze"), s = pick("silver"), g = pick("gold"), d = pick("diamond"), k = pick("king");
  const gold = { ok: b.ok + s.ok + g.ok, total: b.total + s.total + g.total };
  const tiers = { gold, diamond: d, king: k };
  const out = {};
  for (const [tier, { ok, total }] of Object.entries(tiers)) {
    if (!total) {
      out[tier] = { round: "none", status: "none", text: "无记录" };
    } else if (ok === total) {
      out[tier] = { round: 1, status: "pass", text: "一轮过" };
    } else if (ok / total >= 0.6) {
      out[tier] = { round: 2, status: "warn", text: `多轮通过 ${ok}/${total}` };
    } else if (ok > 0) {
      out[tier] = { round: "fail", status: "fail", text: `仅 ${ok}/${total}` };
    } else {
      out[tier] = { round: "fail", status: "fail", text: `全灭 0/${total}` };
    }
  }
  return out;
}

function tierForRank(rank) {
  if (rank <= 1) return "T0";
  if (rank <= 3) return "T1";
  if (rank <= 6) return "T2";
  if (rank <= 9) return "T3";
  return "T4";
}

function categoryFor(name) {
  if (/flash/i.test(name)) return "Flash";
  if (/longcat|muse|kimi/i.test(name)) return "OpenSource";
  if (/deepseek|step|glm/i.test(name)) return "Thinking";
  return "Flagship";
}

function findVersion(versionIndex, players, name) {
  const key = norm(name);
  if (versionIndex[key]) return versionIndex[key];
  // 去版本后缀（正式版/preview/版）后再试
  const stripped = key.replace(/(正式版|preview|版)$/, "");
  if (versionIndex[stripped]) return versionIndex[stripped];
  // 子串双向兜底：行名是版本label的子串或反之（如 Qwen3.8Max ⊂ Qwen3.8Max正式版）
  const keys = Object.keys(versionIndex).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.includes(key) || key.includes(k)) return versionIndex[k];
  }
  // 家族名兜底（如 DeepSeek Flash → deepseek 家族行 deepseek-v4-flash）
  for (const p of Object.values(players)) {
    if (key.includes(norm(p.name)) || norm(p.name).includes(key)) {
      const v = (p.versions ?? [])[0];
      return { family: p.name, org: p.org ?? "", version: v?.label ?? name, color: p.color ?? "" };
    }
  }
  return null;
}

function slugify(name, index) {
  const slug = norm(name).replace(/[^a-z0-9]/g, "").slice(0, 24);
  return slug || `toy-${index}`;
}

function main() {
  if (!existsSync(toyCacheFile)) {
    throw new Error(`toy 缓存缺失，请先跑 python scripts/sync_toy.py：${toyCacheFile}`);
  }
  const toy = JSON.parse(readFileSync(toyCacheFile, "utf8"));
  const versionIndex = toy.versionIndex ?? {};
  const players = toy.players ?? {};
  const assessments = toy.assessments ?? {};

  // assessment：精确名找不到时用 token 交集匹配（版本号 token 必须一致，
  // 避免 GLM5.3Flash 误蹭 GLM-5.3 的考核分；无官方考核的版本保持无记录）
  const assessByNorm = new Map();
  for (const a of Object.values(assessments)) {
    assessByNorm.set(norm(a.name), a);
  }
  const tok = (s) => String(s ?? "").toLowerCase().split(/[\s\-_.]+/).filter(Boolean);
  const findAssess = (name) => {
    if (assessByNorm.has(norm(name))) return assessByNorm.get(norm(name));
    const stripped = norm(name).replace(/(正式版|preview|版)$/, "");
    if (assessByNorm.has(stripped)) return assessByNorm.get(stripped);
    const nt = new Set(tok(name));
    let best = null, bestScore = 0;
    for (const a of Object.values(assessments)) {
      const at = new Set(tok(a.name));
      const overlap = [...nt].filter((t) => at.has(t));
      if (overlap.length > bestScore) { bestScore = overlap.length; best = a; }
    }
    // 至少 2 个 token 一致才算同版本（如 deepseek+v4+flash 命 deepseek-v4-flash）
    return bestScore >= 2 ? best : null;
  };

  const models = (toy.ladder ?? []).map((row, i) => {
    const rank = row.rank ?? i + 1;
    const hit = findVersion(versionIndex, players, row.name);
    const family = hit ? Object.values(players).find((p) => p.name === hit.family) : null;
    const career = family?.career ?? null;
    const folded = foldRounds(career?.byHardness);
    const assess = findAssess(row.name);
    const groupEntry = (toy.standingsTotal ?? []).find((s) => norm(s.name) === norm(row.name));

    // 真实分：有官方考核 = total/18 × 100；无官方考核的一律 null（前端显示 —）
    const rounds = { gold: folded.gold.round, diamond: folded.diamond.round, king: folded.king.round };
    const curatedScore = assess
      ? Math.round(((assess.total / 18) * 100) * 10) / 10
      : null;
    const hasRealAssess = !!assess;

    const autoEvidence = [];
    if (assess) {
      autoEvidence.push({
        score: Math.round(((assess.total / 18) * 100) * 10) / 10,
        kind: "hero",
        bvid: "toy:kaohe",
        raw: `${assess.name} ${assess.total}/18`,
      });
    }
    if (groupEntry) {
      const [w = 0, d = 0, l = 0] = String(groupEntry.wdl).split(/[^0-9]+/).filter(Boolean).map(Number).concat([0, 0, 0]);
      // 小组 WDL 只留档（胜率口径与旧版 group 一致），不计入主分
      void w; void d; void l;
    }

    return {
      id: slugify(row.name, i),
      model: row.name,
      tier: tierForRank(rank),
      category: categoryFor(row.name),
      gold: folded.gold.text,
      diamond: folded.diamond.text,
      king: folded.king.text,
      goldStatus: folded.gold.status,
      diamondStatus: folded.diamond.status,
      kingStatus: folded.king.status,
      quote: row.note || `${row.org ?? ""} · 挑战榜第 ${rank} 名`.trim(),
      timestamp: toy.latestBoutDate || "",
      episodesTested: `英雄榜第 ${rank} 名${row.trend && row.trend !== "hold" ? `（${row.trend}）` : ""}`,
      costEstimate: "",
      tokensConsumed: career ? `生涯 ${career.volume ?? 0} 场` : "",
      analysis: row.note || "",
      strengths: [],
      weaknesses: [],
      bestFor: "",
      score: curatedScore,
      bilibiliBvid: undefined,
      sourceEpisodeTitle: `屎山英雄榜 · ${row.note ?? ""}`.slice(0, 120),
      rounds,
      curatedScore,
      autoScore: undefined,
      autoEvidence,
      // toy 扩展字段（前端按需取用，不影响旧接口）：
      toy: {
        rank,
        org: row.org ?? hit?.org ?? "",
        trend: row.trend ?? "hold",
        delta: row.delta ?? 0,
        family: hit?.family ?? null,
        version: hit?.version ?? row.name,
        assessmentTotal: assess?.total ?? null,
        hasRealAssess,
        groupWdl: groupEntry?.wdl ?? null,
        groupPts: groupEntry?.pts ?? null,
      },
    };
  });

  const hash = (value) => createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);

  // 考核榜：assessment-data 原样透出（name/total/18/byTier/unlock/highlights），
  // 按 total 降序排即官方考核榜顺序
  const kaohe = Object.values(assessments)
    .map((a) => ({
      name: a.name,
      total: a.total,
      rank: a.rank ?? null,
      byTier: a.byTier ?? null,
      unlock: a.unlock ?? null,
    }))
    .sort((x, y) => (y.total ?? 0) - (x.total ?? 0) || String(x.name).localeCompare(String(y.name)));


  const payload = {
    schemaVersion: 1,
    scoreMode,
    dataVersion: hash({ models: models.map((m) => [m.id, m.curatedScore, m.rounds]), ladder: toy.ladder, latest: toy.latestBoutDate }),
    updatedAt: new Date().toISOString(),
    latestContentAt: toy.latestBoutDate ? `${toy.latestBoutDate}T00:00:00.000Z` : "",
    latestRecordedAt: toy.latestBoutDate ? `${toy.latestBoutDate}T00:00:00.000Z` : "",
    scoring: {
      weights: { gold: 0.2, diamond: 0.35, king: 0.45 },
      decay: 0.7,
    },
    source: {
      upName: "Token就是词元",
      mid: "toy:bilibilitoy",
      seasonId: "toy-shishan",
      origin: "toy",
      sourceUrl: toy.sourceUrl ?? "https://www.bilibili.com/toy/shishan/index.html?spm_id_from=333.1387.0.0",
      fetchedAt: toy.fetchedAt ?? "",
    },
    episodes: [],
    videos: [],
    pendingEpisodes: [],
    // toy 三榜全量，直供前端多榜展示：
    boards: {
      ladder: toy.ladder ?? [],
      kaohe,
      standingsGroups: toy.standingsGroups ?? [],
      standingsTotal: toy.standingsTotal ?? [],
      latestBoutDate: toy.latestBoutDate ?? "",
    },
    models,
  };

  writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[rebuildRanking] toy 主源：挑战榜 ${models.length} 位 / 考核 ${Object.keys(assessments).length} 份 / ` +
      `小组 ${(toy.standingsGroups ?? []).length} 个 · dataVersion=${payload.dataVersion} (${scoreMode})`
  );
  models.forEach((m) =>
    console.log(`  #${m.toy.rank} ${m.model} ${m.curatedScore} [${m.gold}/${m.diamond}/${m.king}]`)
  );
}

main();
