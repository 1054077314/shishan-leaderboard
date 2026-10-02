/**
 * 重建运行时排名数据 public/rankingData.json。
 *
 * 主数据源：B站 toy 官方「屎山英雄榜」
 *   https://www.bilibili.com/toy/shishan/index.html?spm_id_from=333.1387.0.0
 *   采集：python scripts/sync_toy.py -> scripts/.cache/toy.json
 *
 * toy 页是纯静态 Astro 页，无 XHR 接口，数据以两种形式直出：
 *   1. 内嵌 <script type="application/json">：player-data（家族+逐版本战绩）、
 *      assessment-data（考核逐题 verdicts + total/18 + disputed）、topic-data（题库）
 *   2. 服务端直出 HTML 三榜：ladder（论剑挑战榜名次/升降/战报）、
 *      kaohe（与 assessment-data 同源）、standings（小组 WDL + 总积分榜）
 *
 * 映射约定（用户已确认）：
 *   - KillLine 主排名 = ladder 挑战榜（名次只靠挑战易位，原样采用，不重算）；
 *     前端排序一律按 toy.rank（官方名次），不再按 score 排序；
 *     score/curatedScore 只用官方真实分：有考核记录 = total/18 × 100，
 *     无官方考核的一律 null，前端显示 —，绝不按名次线性伪造、不做生涯推导
 *   - 五档折三档：青铜+白银+黄金合并为 gold（ok/total 相加），钻石/王者不变
 *   - byHardness 的 [ok, total] 是「一轮就通过的场次 / 该档位出战场次」，
 *     三档折算口径见 scripts/lib/toyResolve.mjs 的 foldRounds；
 *     格子文案统一带「首轮」字样，不得写成「多轮通过」
 *   - 小组积分（standingsTotal）与挑战榜行名写法不一致，只认 norm 相等 +
 *     STANDINGS_ALIASES 登记；对不上的行积分记 null，并在构建期列名告警
 *
 * 版本口径（本文件曾经的 P0 错误，改动前请先读）：
 *   挑战榜每一行都是一个具体版本，所以斩杀线只取
 *   players[slug].byVersion[版本 label]，绝不取 players[slug].career
 *   （那是整条产品线的生涯累计，会让 GLM5.3 与 GLM5.3Flash 显示同一列数据）。
 *   官方考核分同理只认精确/去后缀/别名三级匹配，不做 token 交集，
 *   否则 Grok4.7 会蹭到 Grok 4.5 的考核分。匹配不上就如实记 null。
 *   每条记录的取数口径写在 toy.statsScope 里，前端与测试都能校验。
 *   Qwen3.8Max 的多候选（正式版 / Preview）已查实为正式版：考核场视频标题
 *   《屎山考核｜Qwen3.8Max正式版｜再战祖传代码！》（BV1NDMy6xE6i），
 *   但代码仍保留告警 —— 上游若改名，这条实锤就失效了。
 *
 * 输出 public/rankingData.json（RankingPayload，schemaVersion=1）。
 * episodes/videos 在 toy 体系下无视频合集概念，填 [] 并在 source 注明；
 * 前端表格的期数文案退化为显示榜单规模，不再展示“已录 N 期”。
 *
 * schemaVersion 仍标 1：字段名相对 bilibili 版有删改（costEstimate/tokensConsumed
 * 合并成 volumeLabel），但那些都是成本遗留字段且 UI 零消费；出战场次的真实
 * 口径由 toy.statsScope 声明，前端标签不得再写「生涯」（14/14 行都是 version）。
 *
 * 运行： python scripts/sync_toy.py && node scripts/rebuildRanking.mjs
 * buildPayload 会被 tests/toyResolve.test.mjs 作为纯函数 import，故 main 只在直接执行时跑。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import {
  foldRounds,
  indexByNorm,
  indexPlayersByName,
  norm,
  pickStats,
  resolveAssessment,
  resolveStandings,
  resolveVersion,
} from "./lib/toyResolve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const toyCacheFile = resolve(root, "scripts/.cache/toy.json");
const outFile = resolve(root, "public/rankingData.json");

const scoreMode =
  process.env.RANKING_SCORE_MODE === "computed" ? "computed" : "curated";

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

function slugify(name, index) {
  const slug = norm(name).replace(/[^a-z0-9]/g, "").slice(0, 24);
  return slug || `toy-${index}`;
}

/**
 * 积分榜席位名的官方写法是「家族名 + 版本 short」（如 "Claude Opus"+"5.5"、
 * "GPT"+"6 Astra"）。用它探座：探得到 → 只是写法漂移，该登记别名；
 * 探不到 → 这个版本确实没参加小组赛，积分只能是 null。
 * 只做 norm 相等判断，不做近似匹配。
 */
function seatByShort(player, versionLabel, standingsIndex) {
  const ver = (player?.versions ?? []).find((v) => v.label === versionLabel);
  if (!ver?.short) return null;
  return standingsIndex[norm(`${player.name ?? ""}${ver.short}`)]?.name ?? null;
}

/**
 * toy 缓存 -> RankingPayload。纯函数（不读文件、不读环境变量），
 * 便于 tests/ 用合成 fixture 断言每一行的取数口径。
 * 返回 { payload, warnings }，warnings 记下没对上版本或没有官方考核的行。
 */
export function buildPayload(toy, { mode = scoreMode } = {}) {
  const warnings = [];
  const versionIndex = toy.versionIndex ?? {};
  const players = toy.players ?? {};
  const assessments = toy.assessments ?? {};
  const playersByName = indexPlayersByName(players);
  const assessIndex = indexByNorm(Object.values(assessments));
  const standingsTotal = toy.standingsTotal ?? [];
  const standingsIndex = indexByNorm(standingsTotal);
  const drift = []; // 积分榜有席位，只是写法不同 —— 该登记别名
  const absentSeat = []; // 积分榜确实没这一版 —— 记 null 是对的

  const models = (toy.ladder ?? []).map((row, i) => {
    const rank = row.rank ?? i + 1;
    const hit = resolveVersion(row.name, versionIndex);
    if (!hit) {
      warnings.push(
        `#${rank} ${row.name}：player-data 找不到对应版本，斩杀线记为无记录`
      );
    } else if (hit.ambiguous) {
      warnings.push(
        `#${rank} ${row.name}：名字对应到多个版本候选 [${hit.candidates.join(" / ")}]，` +
          `按「非 preview 优先」取了 ${hit.version}，请人工确认`
      );
    }

    const playerEntry = hit ? playersByName.get(norm(hit.family)) : null;
    const stats = pickStats(playerEntry?.player, hit?.version);
    if (hit && stats.scope === "none") {
      warnings.push(
        `#${rank} ${row.name}：player-data 缺 byVersion[${hit.version}]，斩杀线记为无记录`
      );
    }
    const folded = foldRounds(stats.byHardness ?? undefined);

    const assessHit = resolveAssessment(row.name, assessIndex);
    const assess = assessHit?.assess ?? null;
    if (!assess) warnings.push(`#${rank} ${row.name}：无官方考核记录，分数记为 null`);
    const groupHit = resolveStandings(row.name, standingsIndex);
    const groupEntry = groupHit?.entry ?? null;
    if (!groupEntry) {
      const seat = seatByShort(playerEntry?.player, hit?.version, standingsIndex);
      (seat ? drift : absentSeat).push(
        seat ? `#${rank} ${row.name}（积分榜写作「${seat}」）` : `#${rank} ${row.name}`
      );
    }
    // 版本名有歧义时，积分榜同名行也跟着歧义 —— 积分可能挂到另一个发布形态上
    if (groupEntry && hit?.ambiguous) {
      warnings.push(
        `#${rank} ${row.name}：积分榜按行名对上了「${groupEntry.name}」，` +
          `但本版是 ${hit.version}（候选含 ${hit.candidates.join(" / ")}），积分归属需人工确认`
      );
    }

    // 真实分：有官方考核 = total/18 × 100；无官方考核的一律 null（前端显示 —）
    const rounds = {
      gold: folded.gold.round,
      diamond: folded.diamond.round,
      king: folded.king.round,
    };
    const curatedScore = assess
      ? Math.round(((assess.total / 18) * 100) * 10) / 10
      : null;
    const hasRealAssess = !!assess;

    const autoEvidence = [];
    if (assess) {
      autoEvidence.push({
        score: curatedScore,
        kind: "hero",
        bvid: "toy:kaohe",
        raw: `${assess.name} ${assess.total}/18`,
      });
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
      volumeLabel:
        stats.scope === "version"
          ? `本版 ${stats.volume ?? 0} 场`
          : stats.scope === "family"
            ? `家族 ${stats.volume ?? 0} 场`
            : "",
      analysis: row.note || "",
      strengths: [],
      weaknesses: [],
      bestFor: "",
      score: curatedScore,
      sourceEpisodeTitle: `屎山英雄榜 · ${row.note ?? ""}`.slice(0, 120),
      rounds,
      curatedScore,
      autoEvidence,
      // toy 扩展字段（前端按需取用，不影响旧接口）：
      toy: {
        rank,
        org: row.org ?? hit?.org ?? "",
        trend: row.trend ?? "hold",
        delta: row.delta ?? 0,
        family: hit?.family ?? null,
        version: hit?.version ?? null,
        // 斩杀线取数口径：version=本版战绩（唯一正确口径），none=没对上
        statsScope: stats.scope,
        versionVolume: stats.volume,
        assessmentTotal: assess?.total ?? null,
        assessmentName: assess?.name ?? null,
        hasRealAssess,
        // 官方对这一场的存疑声明（如疑似作弊），非空即不可作为可靠参照
        assessmentDisputed: assess?.disputed ?? null,
        groupWdl: groupEntry?.wdl ?? null,
        groupPts: groupEntry?.pts ?? null,
        // 两榜名字漂移，这里记对齐口径：exact / alias / null=未对上
        groupMatch: groupHit?.method ?? null,
      },
    };
  });

  // 两榜名字漂移是数据缺口不是能力差异，必须在构建期可见，且要分清
  // "写法不同没登记"（可修）和"这版真没参加小组赛"（不该修）
  if (drift.length)
    warnings.push(
      `小组积分有 ${drift.length} 行只是写法不同，请核对后登记 STANDINGS_ALIASES：${drift.join("、")}`
    );
  if (absentSeat.length)
    warnings.push(
      `小组积分有 ${absentSeat.length} 行在积分榜查无席位（按「家族名+版本 short」探座未果），积分记 null：${absentSeat.join("、")}`
    );

  const hash = (value) =>
    createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);
  // 考核榜：assessment-data 原样透出，按 total 降序排即官方考核榜顺序。
  // disputed/highlights 必须带上 —— 官方对 Grok 4.5 那场标了「疑似作弊」，
  // 不透出就等于把一份官方自己都不认的成绩当成可信参照展示给用户。
  const kaohe = Object.values(assessments)
    .map((a) => ({
      name: a.name,
      total: a.total,
      rank: a.rank ?? null,
      date: a.date ?? null,
      duration: a.duration ?? null,
      byTier: a.byTier ?? null,
      unlock: a.unlock ?? null,
      disputed: a.disputed ?? null,
      highlights: a.highlights ?? [],
    }))
    .sort(
      (x, y) =>
        (y.total ?? 0) - (x.total ?? 0) || String(x.name).localeCompare(String(y.name))
    );

  const boards = {
    ladder: toy.ladder ?? [],
    kaohe,
    standingsGroups: toy.standingsGroups ?? [],
    standingsTotal,
    latestBoutDate: toy.latestBoutDate ?? "",
  };

  const payload = {
    schemaVersion: 1,
    scoreMode: mode,
    // dataVersion 覆盖前端会展示的全部内容：三榜任何一张变了都要推进快照，
    // 早期只 hash models+ladder，考核榜/积分榜变动会被前端判成「数据没变」。
    dataVersion: hash({ models, boards }),
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
      sourceUrl:
        toy.sourceUrl ??
        "https://www.bilibili.com/toy/shishan/index.html?spm_id_from=333.1387.0.0",
      fetchedAt: toy.fetchedAt ?? "",
    },
    episodes: [],
    videos: [],
    pendingEpisodes: [],
    // toy 三榜全量，直供前端多榜展示：
    boards,
    models,
  };

  return { payload, warnings };
}

function main() {
  if (!existsSync(toyCacheFile)) {
    throw new Error(`toy 缓存缺失，请先跑 python scripts/sync_toy.py：${toyCacheFile}`);
  }
  const toy = JSON.parse(readFileSync(toyCacheFile, "utf8"));
  const { payload, warnings } = buildPayload(toy);

  writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const scoped = payload.models.filter((m) => m.toy.statsScope === "version");
  const assessed = payload.models.filter((m) => m.toy.hasRealAssess);
  console.log(
    `[rebuildRanking] toy 主源：挑战榜 ${payload.models.length} 位（本版战绩 ${scoped.length} 位）/ ` +
      `考核 ${payload.boards.kaohe.length} 份 / 小组 ${payload.boards.standingsGroups.length} 个 / ` +
      `有官方分 ${assessed.length} 位 · dataVersion=${payload.dataVersion} (${payload.scoreMode})`
  );
  payload.models.forEach((m) =>
    console.log(
      `  #${String(m.toy.rank).padStart(2)} ${m.model.padEnd(20)} ` +
        `${String(m.toy.version ?? "未解析").padEnd(20)} [${m.toy.statsScope.padEnd(7)}] ` +
        `${String(m.curatedScore ?? "—").padStart(5)} ` +
        `${(m.toy.assessmentName ?? "无考核").padEnd(18)} ` +
        `[${m.gold}/${m.diamond}/${m.king}]`
    )
  );
  const unscoped = warnings.filter((w) => !w.includes("无官方考核记录"));
  if (unscoped.length) {
    console.warn(`[rebuildRanking] ${unscoped.length} 条取数待确认：`);
    unscoped.forEach((w) => console.warn(`  ! ${w}`));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
