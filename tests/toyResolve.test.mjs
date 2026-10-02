/**
 * 数据管线的取数口径断言。运行： npm test（= node --test tests/）
 *
 * 这里守的是三类真实踩过的坑，不是随手写的样例：
 *  1. 家族生涯 vs 本版战绩（player-data 有三层，用错层会让同家族两行显示同一列数据）
 *  2. 版本名解析（同名不同发布形态：正式版 / Preview，选错整行战绩就错）
 *  3. 官方考核挂靠（模糊 token 匹配会把别的版本、甚至官方标注存疑的场次挂上来）
 * 另有 tests 直读 scripts/.cache/toy.json 的线上数据不变量检查（缓存缺失则跳过）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildPayload } from "../scripts/rebuildRanking.mjs";
import {
  STANDINGS_ALIASES,
  foldRounds,
  indexByNorm,
  norm,
  resolveAssessment,
  resolveStandings,
  resolveVersion,
  stripChannel,
} from "../scripts/lib/toyResolve.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 与 sync_toy.py 的 build_version_index 同构：版本 label 归一化 -> 所属版本 */
function buildVersionIndex(players) {
  const index = {};
  for (const p of Object.values(players)) {
    for (const v of p.versions ?? []) {
      index[norm(v.label)] = {
        family: p.name,
        org: p.org ?? "",
        version: v.label,
        color: p.color ?? "",
      };
    }
  }
  return index;
}

function fixture() {
  const players = {
    glm: {
      name: "GLM",
      org: "智谱",
      // 家族生涯累计：三档全一轮过。任何一行若用了它，就会被下面的断言抓到。
      career: { volume: 999, byHardness: { gold: [9, 9], diamond: [9, 9], king: [9, 9] } },
      versions: [
        { label: "GLM5.3", short: "5.3" },
        { label: "GLM5.3Flash", short: "5.3 Flash" },
      ],
      byVersion: {
        "GLM5.3": {
          volume: 30,
          byHardness: { bronze: [4, 4], silver: [5, 5], gold: [5, 6], diamond: [3, 8], king: [1, 7] },
        },
        "GLM5.3Flash": {
          volume: 22,
          byHardness: { silver: [2, 3], gold: [3, 4], diamond: [2, 9], king: [0, 6] },
        },
      },
    },
    "qwen-max": {
      name: "Qwen 千问",
      org: "阿里巴巴",
      career: { volume: 89, byHardness: { gold: [39, 55], diamond: [5, 28], king: [0, 6] } },
      versions: [{ label: "Qwen3.8Max正式版" }, { label: "Qwen3.8Max Preview" }],
      byVersion: {
        "Qwen3.8Max正式版": {
          volume: 25,
          byHardness: { bronze: [4, 4], silver: [5, 6], gold: [5, 8], diamond: [1, 7] },
        },
        "Qwen3.8Max Preview": {
          volume: 8,
          byHardness: { bronze: [1, 1], silver: [1, 1], gold: [0, 2], diamond: [1, 4] },
        },
      },
    },
    grok: {
      name: "Grok",
      org: "xAI",
      career: { volume: 38, byHardness: { gold: [18, 19], diamond: [5, 10], king: [2, 9] } },
      versions: [{ label: "Grok4.7" }, { label: "Grok4.5" }],
      byVersion: {
        "Grok4.7": { volume: 5, byHardness: { gold: [1, 1], diamond: [1, 1], king: [1, 3] } },
        "Grok4.5": { volume: 6, byHardness: { gold: [2, 3], diamond: [0, 4], king: [0, 2] } },
      },
    },
  };
  return {
    latestBoutDate: "2026-09-20",
    ladder: [
      { rank: 1, name: "GLM5.3", org: "智谱", note: "", trend: "hold", delta: 0 },
      { rank: 2, name: "GLM5.3Flash", org: "智谱", note: "", trend: "up", delta: 1 },
      { rank: 3, name: "Qwen3.8Max", org: "阿里巴巴", note: "", trend: "hold", delta: 0 },
      // 故意带空格：名字写法漂移时，绝不许把 Grok 4.5 的（还标注存疑的）考核分挂过来
      { rank: 4, name: "Grok 4.7", org: "xAI", note: "", trend: "down", delta: 1 },
      { rank: 5, name: "Grok4.5", org: "xAI", note: "", trend: "hold", delta: 0 },
      { rank: 6, name: "Ghost Model 9", org: "未知", note: "", trend: "hold", delta: 0 },
    ],
    players,
    versionIndex: buildVersionIndex(players),
    assessments: {
      a1: { name: "GLM-5.3", total: 12, rank: 1, highlights: ["史上第一位打穿钻石"], disputed: null },
      a2: { name: "Grok 4.5", total: 11, rank: 2, highlights: [], disputed: "本场成绩存疑：疑似作弊" },
      a3: { name: "Qwen3.8-Max", total: 9, rank: 4, highlights: [], disputed: null },
    },
    standingsGroups: [],
    // 故意混入三种情形：norm 相等、登记别名、疑似同厂不同产品线（必须不连）
    standingsTotal: [
      { rank: 1, name: "GLM 5.3", org: "智谱", wdl: "2胜 0平 0负", pts: 6 },
      { rank: 2, name: "Qwen3.8-Max", org: "阿里巴巴", wdl: "1胜 0平 1负", pts: 3 },
      { rank: 3, name: "MiMo 2.6 Pro", org: "小米", wdl: "0胜 0平 1负", pts: 0 },
    ],
  };
}

const byModel = (models) => new Map(models.map((m) => [m.model, m]));

test("斩杀线取本版战绩，不取家族生涯", () => {
  const { payload } = buildPayload(fixture());
  const m = byModel(payload.models);
  const glm = m.get("GLM5.3");
  assert.equal(glm.toy.statsScope, "version");
  assert.equal(glm.toy.version, "GLM5.3");
  // 家族生涯三档全 [9,9] → 会显示 "一轮过/一轮过/一轮过"；本版应为下面这组
  assert.deepEqual(
    [glm.gold, glm.diamond, glm.king],
    ["首轮通过 14/15", "首轮仅过 3/8", "首轮仅过 1/7"]
  );
  assert.equal(glm.volumeLabel, "本版 30 场");
});

test("同家族不同版本，三档文案不得完全相同", () => {
  const { payload } = buildPayload(fixture());
  const m = byModel(payload.models);
  const a = m.get("GLM5.3");
  const b = m.get("GLM5.3Flash");
  const triple = (x) => [x.gold, x.diamond, x.king].join("|");
  assert.notEqual(triple(a), triple(b), "GLM5.3 与 GLM5.3Flash 拿到了同一列数据 → 用到了家族生涯");
  assert.deepEqual(
    [b.gold, b.diamond, b.king],
    ["首轮通过 5/7", "首轮仅过 2/9", "首轮全灭 0/6"]
  );
});

test("版本名解析：正式版优先于 Preview，并标记为需人工确认", () => {
  const { payload, warnings } = buildPayload(fixture());
  const qwen = byModel(payload.models).get("Qwen3.8Max");
  assert.equal(qwen.toy.version, "Qwen3.8Max正式版");
  assert.equal(qwen.toy.statsScope, "version");
  assert.equal(qwen.king, "无记录", "正式版没打过王者档，不得继承家族/Preview 的记录");
  assert.ok(
    warnings.some((w) => w.includes("Qwen3.8Max") && w.includes("Qwen3.8Max Preview")),
    "多候选必须告警"
  );
  assert.ok(
    warnings.some((w) => w.includes("Qwen3.8Max") && w.includes("积分归属")),
    "版本歧义会连带积分榜归属歧义，必须一起告警"
  );
});

test("官方考核挂靠：精确与别名可挂，跨版本一律 null", () => {
  const { payload } = buildPayload(fixture());
  const m = byModel(payload.models);
  assert.equal(m.get("GLM5.3").score, 66.7);
  assert.equal(m.get("GLM5.3").toy.assessmentName, "GLM-5.3");
  assert.equal(m.get("Qwen3.8Max").score, 50);
  // Flash 版与带空格的 Grok4.7 都没有自己的考核场 → 只能是 null
  assert.equal(m.get("GLM5.3Flash").score, null);
  assert.equal(m.get("GLM5.3Flash").toy.hasRealAssess, false);
  assert.equal(m.get("Grok 4.7").score, null, "Grok 4.7 蹭到了 Grok 4.5 的考核分");
  // 只有 Grok4.5 自己才挂得到那场（且带着官方存疑声明）
  assert.equal(m.get("Grok4.5").score, 61.1);
  assert.equal(m.get("Grok4.5").toy.assessmentDisputed, "本场成绩存疑：疑似作弊");
});

test("解析不到的行：记为无记录并告警，绝不拿家族数据顶上", () => {
  const { payload, warnings } = buildPayload(fixture());
  const ghost = byModel(payload.models).get("Ghost Model 9");
  assert.equal(ghost.toy.version, null);
  assert.equal(ghost.toy.statsScope, "none");
  assert.deepEqual([ghost.gold, ghost.diamond, ghost.king], ["无记录", "无记录", "无记录"]);
  assert.equal(ghost.volumeLabel, "");
  assert.ok(warnings.some((w) => w.includes("Ghost Model 9")));
});

test("disputed / highlights 必须透到考核榜", () => {
  const { payload } = buildPayload(fixture());
  const grok = payload.boards.kaohe.find((k) => k.name === "Grok 4.5");
  assert.equal(grok.disputed, "本场成绩存疑：疑似作弊");
  assert.deepEqual(payload.boards.kaohe.map((k) => k.total), [12, 11, 9], "考核榜应按 total 降序");
  assert.ok(payload.boards.kaohe[0].highlights.length === 1);
});

test("dataVersion 覆盖三榜：只有考核榜变化也要能被发现", () => {
  const before = buildPayload(fixture()).payload.dataVersion;
  const after = fixture();
  after.assessments.a1.total = 13;
  const v2 = buildPayload(after).payload.dataVersion;
  assert.notEqual(before, v2, "考核榜变化未进 dataVersion，前端会漏报名次/数据变动");

  const sameLadder = fixture();
  sameLadder.standingsTotal = [{ rank: 1, name: "GLM5.3", org: "智谱", wdl: "2-0-0", pts: 6 }];
  assert.notEqual(before, buildPayload(sameLadder).payload.dataVersion);
});

test("名次沿用官方挑战榜顺序", () => {
  const { payload } = buildPayload(fixture());
  assert.deepEqual(payload.models.map((m) => m.toy.rank), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(payload.models.map((m) => m.id)).size, payload.models.length, "id 撞车");
});

test("resolveVersion 分级：精确 > 去发布形态后缀 > 不猜", () => {
  const { versionIndex } = fixture();
  assert.equal(resolveVersion("GLM5.3", versionIndex).method, "v4");
  assert.equal(resolveVersion("Qwen3.8Max", versionIndex).version, "Qwen3.8Max正式版");
  assert.equal(resolveVersion("不存在的东西", versionIndex), null);
  assert.equal(stripChannel(norm("Qwen3.8Max正式版")), norm("Qwen3.8Max"));
  assert.equal(stripChannel(norm("Grok 4 Preview")), "grok4");
});

test("resolveAssessment 不做 token 交集", () => {
  const idx = indexByNorm(Object.values(fixture().assessments));
  assert.equal(resolveAssessment("GLM5.3Flash", idx), null);
  assert.equal(resolveAssessment("Grok 4.7", idx), null);
  assert.equal(resolveAssessment("Claude Opus 5.5", idx), null);
  assert.equal(resolveAssessment("GLM5.3", idx).method, "exact");
});

test("小组积分对齐：norm 相等与登记别名可配，疑似不同产品线一律 null", () => {
  const idx = indexByNorm([
    { name: "GLM 5.3", wdl: "2-0-0", pts: 6 }, // norm 相等（挑战榜写作 GLM5.3）
    { name: "Claude Opus 5.5", wdl: "2-0-0", pts: 4 }, // 需登记别名
    { name: "MiMo 2.6 Pro", wdl: "0-0-1", pts: 0 }, // 挑战榜只有 MiMo2.6Flash，不许连
  ]);
  assert.equal(resolveStandings("GLM5.3", idx).method, "exact");
  assert.equal(resolveStandings("Opus5.5", idx).method, "alias");
  assert.equal(resolveStandings("MiMo2.6Flash", idx), null, "把 Pro 场次的积分连给了 Flash 版");
  assert.equal(resolveStandings("Qwen3.8Max", idx), null);

  const fx = fixture();
  fx.standingsTotal = [
    { rank: 1, name: "GLM 5.3", org: "智谱", wdl: "2胜 0平 0负", pts: 6 },
    { rank: 2, name: "Qwen3.8-Max", org: "阿里巴巴", wdl: "1胜 1平 0负", pts: 4 },
    { rank: 3, name: "MiMo 2.6 Pro", org: "小米", wdl: "0胜 0平 1负", pts: 0 },
  ];
  // 再造一行「积分榜写法 = 家族名 + 版本 short」的合成选手，验证 drift 告警
  fx.players.testfam = {
    name: "Test Family",
    org: "测试",
    versions: [{ label: "TF9", short: "9 Nova" }],
    byVersion: { TF9: { volume: 3, byHardness: { gold: [2, 3] } } },
  };
  fx.versionIndex[norm("TF9")] = { family: "Test Family", org: "测试", version: "TF9", color: "" };
  fx.ladder.push({ rank: 7, name: "TF9", org: "测试", note: "", trend: "hold", delta: 0 });
  fx.standingsTotal.push({ rank: 9, name: "Test Family 9 Nova", org: "测试", wdl: "1胜 0平 0负", pts: 2 });

  const { payload, warnings } = buildPayload(fx);
  const m = byModel(payload.models);
  assert.equal(m.get("GLM5.3").toy.groupPts, 6);
  assert.equal(m.get("GLM5.3").toy.groupMatch, "exact");
  assert.equal(m.get("Qwen3.8Max").toy.groupPts, 4);
  assert.equal(m.get("GLM5.3Flash").toy.groupPts, null);
  assert.equal(m.get("GLM5.3Flash").toy.groupMatch, null);
  assert.equal(m.get("TF9").toy.groupPts, null, "未登记的写法漂移不许自动连线");
  assert.ok(
    warnings.some((w) => w.includes("写法不同") && w.includes("STANDINGS_ALIASES") && w.includes("TF9")),
    "积分榜能按「家族名+short」探到席位时，必须指路别名表"
  );
  assert.ok(
    warnings.some((w) => w.includes("查无席位") && w.includes("GLM5.3Flash")),
    "真没参加小组赛的行要说清是查无席位，不是漏登记"
  );
});

test("foldRounds：一轮通过率折算三档", () => {
  const folded = foldRounds({ bronze: [4, 4], silver: [5, 5], gold: [5, 6], diamond: [3, 8], king: [1, 7] });
  assert.deepEqual(
    [folded.gold, folded.diamond, folded.king].map((x) => x.text),
    ["首轮通过 14/15", "首轮仅过 3/8", "首轮仅过 1/7"]
  );
  assert.equal(folded.gold.round, 2);
  assert.equal(folded.diamond.round, "fail");
  assert.deepEqual(Object.values(foldRounds({})).map((x) => x.status), ["none", "none", "none"]);
});

const cacheFile = resolve(root, "scripts/.cache/toy.json");
test("线上 toy 缓存：每一行都是本版战绩，且无同家族重复列", { skip: !existsSync(cacheFile) }, () => {
  const toy = JSON.parse(readFileSync(cacheFile, "utf8"));
  const { payload } = buildPayload(toy);
  assert.ok(payload.models.length >= 10, "挑战榜行数异常");

  for (const m of payload.models) {
    assert.equal(
      m.toy.statsScope,
      "version",
      `${m.model} 的斩杀线不是本版战绩（${m.toy.statsScope}）`
    );
    // 场次标签必须与 statsScope 同口径：前端这一格曾被标成「生涯」，值是本版
    if (m.volumeLabel) {
      assert.ok(
        /^本版 \d+ 场$/.test(m.volumeLabel),
        `${m.model} 的场次标签与 version 口径不符：${m.volumeLabel}`
      );
      assert.equal(
        Number(m.volumeLabel.match(/\d+/)[0]),
        m.toy.versionVolume,
        `${m.model} 的场次标签与 versionVolume 对不上`
      );
    }
    if (m.toy.hasRealAssess) {
      const inBoard = payload.boards.kaohe.find((k) => k.name === m.toy.assessmentName);
      assert.ok(inBoard, `${m.model} 挂靠的 ${m.toy.assessmentName} 不在考核榜里`);
      assert.equal(inBoard.total, m.toy.assessmentTotal);
      assert.equal(m.score, Math.round(((m.toy.assessmentTotal / 18) * 100) * 10) / 10);
    } else {
      assert.equal(m.score, null);
    }
  }

  // 两榜积分对齐必须可审计：带出分数的行，其积分榜名字要么 norm 相等，要么是登记过的别名
  const totalByNorm = new Map(payload.boards.standingsTotal.map((s) => [norm(s.name), s]));
  let aligned = 0;
  for (const m of payload.models) {
    if (m.toy.groupPts == null) continue;
    aligned++;
    const key = norm(m.model);
    const src = totalByNorm.get(key) ?? totalByNorm.get(STANDINGS_ALIASES[key]);
    assert.ok(src, `${m.model} 的积分来自未登记的行（groupMatch=${m.toy.groupMatch}）`);
    assert.equal(src.wdl, m.toy.groupWdl);
    assert.equal(src.pts, m.toy.groupPts);
    assert.ok(["exact", "alias"].includes(m.toy.groupMatch));
  }
  assert.ok(aligned >= 8, `两榜对齐行数退化为 ${aligned}，挑战榜 ${payload.models.length} 行`);

  // 同家族不同版本必须能区分开
  const families = new Map();
  for (const m of payload.models) {
    const key = m.toy.family ?? m.model;
    const triple = [m.gold, m.diamond, m.king].join("|");
    const seen = families.get(key) ?? new Set();
    assert.ok(!seen.has(triple), `${key} 家族下 ${m.model} 的三档与同家族另一行完全相同`);
    seen.add(triple);
    families.set(key, seen);
  }
});
