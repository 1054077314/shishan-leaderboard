/**
 * 评论区第二信源核实的取数口径断言。运行： npm test
 *
 * 守的是核实纪律，不是正则碰巧能跑：
 *  1. 数字必须绑对模型（最近的模型名，不跨界挂分）
 *  2. 裸叫法（千问/GPT/Grok）一律 ambiguous，不猜版本
 *  3. 官方没这项数据 → unverifiable，两边有数且不等才是 conflict
 *  4. 信任分级：UP主本人 > 置顶/点赞 > 热评；置顶≠官方（UP主会置顶观众评论）
 *  5. UP主勘误关键词进 notices，不参与断言
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSubjects,
  extractClaims,
  verifyComments,
} from "../scripts/lib/commentVerify.mjs";

function toy() {
  return {
    ladder: [
      { rank: 1, name: "GPT6", org: "OpenAI", note: "", trend: "hold", delta: 0 },
      { rank: 3, name: "Opus5.5", org: "Anthropic", note: "", trend: "hold", delta: 0 },
      { rank: 6, name: "GLM5.3", org: "智谱", note: "", trend: "hold", delta: 0 },
      { rank: 9, name: "Qwen3.8Max", org: "阿里", note: "", trend: "hold", delta: 0 },
      { rank: 10, name: "Qwen3.8Flash", org: "阿里", note: "", trend: "hold", delta: 0 },
      { rank: 8, name: "DeepSeek Flash", org: "深度求索", note: "", trend: "hold", delta: 0 },
    ],
    assessments: {
      "glm-5-3": { name: "GLM-5.3", total: 12, rank: 1 },
      "deepseek-v4-flash": { name: "DeepSeek V4 Flash", total: 9, rank: 3 },
    },
    standingsTotal: [
      { rank: 1, name: "GPT-6 Astra", org: "OpenAI", wdl: "2胜 0平 0负", pts: 4 },
      { rank: 2, name: "Claude Opus 5.5", org: "Anthropic", wdl: "1胜 1平 0负", pts: 3 },
    ],
    standingsGroups: [],
    versionIndex: {},
    players: {},
    latestBoutDate: "2026-09-28",
  };
}

function videoWith(comments, extra = {}) {
  return {
    ep: 1,
    aid: 1,
    bvid: "BV1test",
    title: "测试期",
    pinned: null,
    upComments: [],
    endorsed: [],
    hot: comments,
    ...extra,
  };
}

function c(message, over = {}) {
  return {
    rpid: "r" + Math.abs(hash(message)) + (over.rpidSuffix ?? ""),
    mid: "0",
    uname: "路人甲",
    isUp: false,
    isTop: false,
    upLiked: false,
    upReplied: false,
    like: 0,
    message,
    ...over,
  };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function cache(videos) {
  return { fetchedAt: "2026-10-02T00:00:00+08:00", authenticated: true, videos };
}

test("考核分断言：12/18 对上官方 total=12 → confirmed", () => {
  const r = verifyComments(
    cache([videoWith([c("GLM-5.3 考核 12/18 确实强")])]),
    toy()
  );
  assert.equal(r.claims.length, 1);
  const cl = r.claims[0];
  assert.equal(cl.kind, "kaoheTotal");
  assert.equal(cl.model, "GLM5.3");
  assert.equal(cl.status, "confirmed");
  assert.equal(cl.expected, "12/18");
});

test("考核分断言：评论说 10/18 官方 12 → conflict，进告警面", () => {
  const r = verifyComments(
    cache([videoWith([c("GLM-5.3 只有 10/18 吧")])]),
    toy()
  );
  assert.equal(r.claims.length, 1);
  assert.equal(r.claims[0].status, "conflict");
  assert.equal(r.claims[0].expected, "12/18");
});

test("数字绑最近模型名：GLM 的分不会挂到 Grok 头上", () => {
  const r = verifyComments(
    cache([videoWith([c("GLM-5.3 拿了 12/18，DeepSeek Flash 是 9/18")])]),
    toy()
  );
  const byModel = Object.fromEntries(r.claims.map((x) => [x.model, x]));
  assert.equal(byModel["GLM5.3"].claimed, "12/18");
  assert.equal(byModel["DeepSeek Flash"].claimed, "9/18");
  assert.equal(byModel["GLM5.3"].status, "confirmed");
  assert.equal(byModel["DeepSeek Flash"].status, "confirmed");
});

test("裸叫法不猜版本：『千问 第9名』→ ambiguous", () => {
  const r = verifyComments(
    cache([videoWith([c("千问这次第9名还行")])]),
    toy()
  );
  assert.equal(r.claims.length, 1);
  assert.equal(r.claims[0].status, "ambiguous");
  assert.equal(r.claims[0].model, null);
});

test("官方没这项数据 → unverifiable，不算冲突", () => {
  // Qwen3.8Flash 没有考核记录，评论说它有考核分 → 无法核对
  const r = verifyComments(
    cache([videoWith([c("Qwen3.8Flash 考核 15/18 断层第一")])]),
    toy()
  );
  assert.equal(r.claims[0].status, "unverifiable");
  assert.equal(r.claims[0].expected, null);
});

test("名次断言：Opus5.5 第3名 对上 ladder rank=3 → confirmed", () => {
  const r = verifyComments(
    cache([videoWith([c("Opus5.5 第3名有点低了")])]),
    toy()
  );
  const cl = r.claims.find((x) => x.kind === "ladderRank");
  assert.equal(cl.status, "confirmed");
});

test("积分断言：GPT-6 Astra 积4分 对上积分榜", () => {
  const r = verifyComments(
    cache([videoWith([c("GPT-6 Astra 小组赛积4分稳了")])]),
    toy()
  );
  const cl = r.claims.find((x) => x.kind === "standingsPts");
  assert.equal(cl.status, "confirmed");
});

test("WDL 断言：2胜0平0负 对上 wdl", () => {
  const r = verifyComments(
    cache([videoWith([c("Claude Opus 5.5 是 1胜1平0负")])]),
    toy()
  );
  const cl = r.claims.find((x) => x.kind === "wdl");
  assert.equal(cl.claimed, "1胜1平0负");
  assert.equal(cl.status, "confirmed");
});

test("信任分级：UP主本人=official，被置顶的观众评论=endorsed（不是官方）", () => {
  // 同主语同断言会去重只留最高信任，所以用两条不同断言各验证一级
  const up = c("官方说一句：GLM-5.3 是 12/18", { isUp: true, uname: "Token就是词元", rpidSuffix: "u" });
  const pinnedViewer = c("GLM-5.3 第6名", { isTop: true, uname: "观众", rpidSuffix: "v" });
  const r = verifyComments(
    cache([videoWith([], { pinned: pinnedViewer, upComments: [up], hot: [] })]),
    toy()
  );
  const byTrust = Object.fromEntries(r.claims.map((x) => [x.trust, x]));
  assert.equal(byTrust.official.uname, "Token就是词元");
  assert.equal(byTrust.endorsed.uname, "观众");
  assert.ok(!("community" in byTrust));
});

test("去重：同一断言取最高信任的那条", () => {
  const fan = c("GLM-5.3 是 12/18", { like: 99, rpidSuffix: "a" });
  const up = c("GLM-5.3 是 12/18", { isUp: true, uname: "Token就是词元", rpidSuffix: "b" });
  const r = verifyComments(
    cache([videoWith([fan], { upComments: [up] })]),
    toy()
  );
  assert.equal(r.claims.length, 1);
  assert.equal(r.claims[0].trust, "official");
});

test("UP主勘误关键词进 notices，不产生断言", () => {
  const up = c("勘误：上期把 Grok4.5 的分记错了，以英雄榜为准", { isUp: true, uname: "Token就是词元" });
  const r = verifyComments(
    cache([videoWith([], { upComments: [up] })]),
    toy()
  );
  assert.equal(r.notices.length, 1);
  assert.equal(r.notices[0].trust, "official");
});

test("含糊说法不产断言：『X 分』『一轮过』不进 claims", () => {
  const r = verifyComments(
    cache([videoWith([c("GLM5.3 拿了 12 分，一轮过黄金太强了")])]),
    toy()
  );
  assert.equal(r.claims.length, 0);
});

test("extractClaims 只认四种硬模式", () => {
  const cs = extractClaims("GLM 12/18，第3名，2胜0平1负，积4分，用时34:49，拿了 66 分");
  const kinds = cs.map((x) => x.kind).sort();
  assert.deepEqual(kinds, ["kaoheTotal", "ladderRank", "standingsPts", "wdl"]);
});

test("buildSubjects：挑战榜行自动挂上考核与积分", () => {
  const { subjects } = buildSubjects(toy());
  const glm = subjects.get("glm53");
  assert.equal(glm.ladderRank, 6);
  assert.equal(glm.kaoheTotal, 12);
  const gpt6 = subjects.get("gpt6");
  // GPT6 经 STANDINGS_ALIASES 对齐到 GPT-6 Astra
  assert.equal(gpt6.standingsPts, 4);
});
