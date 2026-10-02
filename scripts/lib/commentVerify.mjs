/**
 * 评论区第二信源核实：把 sync_comments.py 采集的评论里的结构化断言
 * 与 toy.json 三榜交叉核对，产出 confirmed / conflict / unverifiable。
 *
 * 核实纪律（和 toyResolve 同一套思路，宁可少判也不错判）：
 *  - 模型名只允许「全名精确命中」或「显式登记的社区叫法」，裸称
 *    （"千问""GPT""Grok"）一律记 ambiguous，不猜是哪个版本；
 *  - 断言类型只认四种硬模式：N/18 考核分、第N名、N胜N平N负、积N分。
 *    「X 分」「一轮过」这类含糊说法一律不产出断言；
 *  - 数字绑定最近的模型名（前面 100 字符内最近的，或后面 40 字符内），
 *    不把别人的分数挂到模型头上；
 *  - 断言对不上 toy 数据 ≠ 评论错：上游没这项数据时记 unverifiable，
 *    只有两边都有数且不等才是 conflict。
 *
 * 纯函数、无 IO：tests/ 用合成 fixture 直接断言。
 */

import {
  indexByNorm,
  norm,
  resolveAssessment,
  resolveStandings,
  resolveVersion,
} from "./toyResolve.mjs";

/**
 * 社区叫法登记表：norm 后的叫法 -> 主语 key（也是 norm 名），
 * 或 "ambiguous"（叫法覆盖多个上榜版本，不猜）。
 * 登记纪律：只收在评论里高频出现且指向明确的叫法；有歧义就标 ambiguous。
 */
const COMMUNITY_ALIASES = {
  // DeepSeek 家族：榜上只有 DeepSeek Flash 一行
  ds: "deepseekflash",
  deepseek: "deepseekflash",
  deepseekv4: "deepseekflash",
  deepseekv4flash: "deepseekflash",
  dsflash: "deepseekflash",
  // 千问：Max / Flash / 27B 都在册，裸名歧义
  千问: "ambiguous",
  qwen: "ambiguous",
  qwen38: "ambiguous",
  qwen38max: "qwen38max",
  qwenmax: "qwen38max",
  千问max: "qwen38max",
  千问38max: "qwen38max",
  qwen38flash: "qwen38flash",
  qwenflash: "qwen38flash",
  千问flash: "qwen38flash",
  // GLM：5.3 与 5.3Flash 同榜
  glm: "ambiguous",
  智谱: "ambiguous",
  glm53: "glm53",
  glm53flash: "glm53flash",
  智谱53: "glm53",
  // Grok：榜上 4.7，考核里有 4.5
  grok: "ambiguous",
  grok47: "grok47",
  grok45: "grok45",
  // GPT：6 与 6 Sol 同榜
  gpt: "ambiguous",
  gpt6: "gpt6",
  gpt6sol: "gpt6sol",
  gpt6astra: "gpt6",
  astra: "gpt6",
  chatgpt: "ambiguous",
  // Anthropic：Fable5.1 与 Opus5.5 同榜
  claude: "ambiguous",
  opus: "ambiguous",
  opus55: "opus55",
  fable: "claudefable51",
  fable51: "claudefable51",
  // 其他：榜上唯一
  kimi: "kimik3",
  kimik3: "kimik3",
  gemini: "ambiguous", // 3.8Flash 上榜但 3.6Flash 也在版本册里
  gemini38flash: "gemini38flash",
  minimax: "minimaxm31flash",
  mimo: "mimo26flash",
  mimo26: "mimo26flash",
  mimo26flash: "mimo26flash",
  混元: "hunyuan30",
  hunyuan: "hunyuan30",
  hy30: "hunyuan30",
};

/** 断言模式：kind -> 提取 value 的正则（含全局匹配位置） */
const CLAIM_PATTERNS = [
  { kind: "kaoheTotal", re: /(\d{1,2})\s*[/／]\s*18/g, pick: (m) => ({ value: Number(m[1]), text: `${m[1]}/18` }) },
  { kind: "ladderRank", re: /第\s*(\d{1,2})\s*名/g, pick: (m) => ({ value: Number(m[1]), text: `第${m[1]}名` }) },
  {
    kind: "wdl",
    re: /(\d+)\s*胜\s*(\d+)\s*平\s*(\d+)\s*负/g,
    pick: (m) => ({ value: `${m[1]}-${m[2]}-${m[3]}`, text: `${m[1]}胜${m[2]}平${m[3]}负` }),
  },
  {
    kind: "wdl",
    re: /(\d+)\s*[-–—]\s*(\d+)\s*[-–—]\s*(\d+)/g,
    pick: (m) => ({ value: `${m[1]}-${m[2]}-${m[3]}`, text: `${m[1]}-${m[2]}-${m[3]}` }),
  },
  {
    kind: "standingsPts",
    re: /(?:积\s*(\d+)\s*分|积分\s*[:：]?\s*(\d+)|(\d+)\s*个?积分)/g,
    pick: (m) => ({ value: Number(m[1] ?? m[2] ?? m[3]), text: `积${m[1] ?? m[2] ?? m[3]}分` }),
  },
];

/** UP主官方声音里的勘误/声明关键词：命中即收进 notices，不参与断言核对 */
const NOTICE_KEYWORDS = [
  "勘误", "更正", "修正", "不算", "取消", "无效", "存疑", "重新测", "复测", "加赛", "改名", "作废",
];

const WINDOW_BEFORE = 100;
const WINDOW_AFTER = 40;
const EXCERPT_LEN = 160;

/** key(norm 名) -> 匹配原文的正则：字符间允许空白和 - _ . 漂移，保留原文位置 */
function nameRegex(key) {
  const chars = [...key].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(chars.join("[\\s\\-_.]*"), "gi");
}

/**
 * 建主语索引：ladder 行名 + 考核名 + 积分榜名 + 版本 label + 社区别名，
 * 统一指到一个 subject（能挂几项官方数据就挂几项）。
 */
export function buildSubjects(toy) {
  const subjects = new Map(); // key -> subject
  const ladder = toy.ladder ?? [];
  const assessments = toy.assessments ?? {};
  const standingsTotal = toy.standingsTotal ?? [];
  const versionIndex = toy.versionIndex ?? {};
  const assessIndex = indexByNorm(Object.values(assessments));
  const standingsIndex = indexByNorm(standingsTotal);

  const ensure = (key, display) => {
    if (!subjects.has(key)) subjects.set(key, { key, display });
    return subjects.get(key);
  };

  // 1) 挑战榜行是主语主体：行名即版本，考核/积分用同一套三级解析挂上
  const ladderSubjectKeys = new Map(); // norm(ladderName) -> key
  for (const row of ladder) {
    const key = norm(row.name);
    const s = ensure(key, row.name);
    s.ladderRank = row.rank ?? null;
    ladderSubjectKeys.set(key, key);
    const assess = resolveAssessment(row.name, assessIndex)?.assess;
    if (assess) {
      s.kaoheTotal = assess.total ?? null;
      s.kaoheName = assess.name;
      // 考核名也是这个主语的入口（如 "GLM-5.3" -> GLM5.3 行）
      const ak = norm(assess.name);
      if (!subjects.has(ak)) subjects.set(ak, s);
    }
    const st = resolveStandings(row.name, standingsIndex)?.entry;
    if (st) {
      s.standingsPts = st.pts ?? null;
      s.standingsWdl = wdlCompact(st.wdl);
      const sk = norm(st.name);
      if (!subjects.has(sk)) subjects.set(sk, s);
    }
  }

  // 2) 考核里没挂上挑战榜的独立被测版本（如 Grok 4.5、混元3.0）
  for (const a of Object.values(assessments)) {
    const key = norm(a.name);
    if (subjects.has(key)) continue;
    ensure(key, a.name).kaoheTotal = a.total ?? null;
    subjects.get(key).kaoheName = a.name;
  }

  // 3) 积分榜里没挂上的行（写法漂移但没登记别名的，仍能接 "Claude Opus 5.5" 这种全名评论）
  for (const st of standingsTotal) {
    const key = norm(st.name);
    if (subjects.has(key)) continue;
    const s = ensure(key, st.name);
    s.standingsPts = st.pts ?? null;
    s.standingsWdl = wdlCompact(st.wdl);
  }

  // 4) 版本 label：榜上行的已对上版本 → 指到该行主语；没上榜的版本若刚好
  //    有考核/积分命中也挂过去，否则留空 subject（断言落上去就是 unverifiable）
  const players = toy.players ?? {};
  for (const [vkey, v] of Object.entries(versionIndex)) {
    if (subjects.has(vkey)) continue;
    // 反查：这个版本 label 是不是某个 ladder 行解析出的版本
    let hit = null;
    for (const row of ladder) {
      const hv = resolveVersion(row.name, versionIndex);
      if (hv && norm(hv.version) === vkey) {
        hit = row;
        break;
      }
    }
    if (hit) {
      subjects.set(vkey, subjects.get(norm(hit.name)) ?? ensure(norm(hit.name), hit.name));
      continue;
    }
    const s = ensure(vkey, v.version ?? vkey);
    const familyPlayers = players ? Object.values(players) : [];
    void familyPlayers;
    const assess = resolveAssessment(v.version ?? "", assessIndex)?.assess;
    if (assess) {
      s.kaoheTotal = assess.total ?? null;
      s.kaoheName = assess.name;
    }
  }

  // 5) 社区别名
  const aliasKeys = new Map(); // aliasKey -> subject | "ambiguous"
  for (const [alias, target] of Object.entries(COMMUNITY_ALIASES)) {
    if (target === "ambiguous") {
      aliasKeys.set(alias, "ambiguous");
      continue;
    }
    const s = subjects.get(target);
    aliasKeys.set(alias, s ?? null); // 指向不存在的主语 = 该叫法所指版本没上榜
  }

  return { subjects, aliasKeys };
}

function wdlCompact(wdl) {
  if (!wdl) return null;
  const m = String(wdl).match(/(\d+)\s*胜\s*(\d+)\s*平\s*(\d+)\s*负/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = String(wdl).match(/(\d+)\s*[-–—]\s*(\d+)\s*[-–—]\s*(\d+)/);
  return m2 ? `${m2[1]}-${m2[2]}-${m2[3]}` : null;
}

/** 在一条评论里找全部模型名提及：返回 [{index, key, subject|"ambiguous"|null}] */
function findMentions(message, subjects, aliasKeys) {
  const mentions = [];
  const candidates = [
    ...[...subjects.keys()].map((key) => ({ key, kind: "subject" })),
    ...[...aliasKeys.keys()].map((key) => ({ key, kind: "alias" })),
  ].sort((a, b) => b.key.length - a.key.length); // 长名优先，避免 glm53 吃掉 glm53flash 的前缀
  for (const { key, kind } of candidates) {
    if (!key) continue;
    const re = nameRegex(key);
    let m;
    while ((m = re.exec(message)) !== null) {
      const target =
        kind === "alias" ? aliasKeys.get(key) : subjects.get(key);
      mentions.push({ index: m.index, key, target });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return mentions.sort((a, b) => a.index - b.index);
}

/** 提取一条评论里的断言（不核实） */
export function extractClaims(message) {
  const claims = [];
  for (const { kind, re, pick } of CLAIM_PATTERNS) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(message)) !== null) {
      claims.push({ index: m.index, kind, ...pick(m) });
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
  }
  return claims.sort((a, b) => a.index - b.index);
}

/** 数字绑定最近的模型名：前面 100 字符内最近的优先，否则后面 40 字符内 */
function nearestMention(claimIndex, mentions) {
  let best = null;
  for (const mt of mentions) {
    const dist = claimIndex - mt.index;
    if (dist >= 0 && dist <= WINDOW_BEFORE && (!best || dist < best.dist)) {
      best = { mt, dist, dir: "before" };
    }
  }
  if (best) return best.mt;
  for (const mt of mentions) {
    const dist = mt.index - claimIndex;
    if (dist >= 0 && dist <= WINDOW_AFTER && (!best || dist < best.dist)) {
      best = { mt, dist, dir: "after" };
    }
  }
  return best?.mt ?? null;
}

function verdict(claim, subject) {
  if (!subject) return { status: "unverifiable", expected: null };
  const checks = {
    kaoheTotal: { get: (s) => s.kaoheTotal, fmt: (v) => `${v}/18` },
    ladderRank: { get: (s) => s.ladderRank, fmt: (v) => `第${v}名` },
    wdl: { get: (s) => s.standingsWdl, fmt: (v) => v },
    standingsPts: { get: (s) => s.standingsPts, fmt: (v) => `积${v}分` },
  };
  const c = checks[claim.kind];
  const expected = c.get(subject);
  if (expected === null || expected === undefined) {
    return { status: "unverifiable", expected: null };
  }
  return {
    status: expected === claim.value ? "confirmed" : "conflict",
    expected: c.fmt(expected),
    expectedValue: expected,
  };
}

function trustOf(comment, video) {
  // 置顶≠官方：UP主会把观众评论挂到置顶位（ep4 就是），只有本人发的才算官方口径
  if (comment.isUp) return "official";
  if (comment.isTop || comment.upLiked || comment.upReplied) return "endorsed";
  return "community";
}

const TRUST_RANK = { official: 3, endorsed: 2, community: 1 };

function excerptOf(message) {
  const flat = String(message ?? "").replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LEN ? flat.slice(0, EXCERPT_LEN) + "…" : flat;
}

/**
 * 主入口：comments 缓存 + toy 缓存 -> 核实结果。
 * 返回 { stats, notices, claims }，全部可直接序列化进 rankingData.json。
 */
export function verifyComments(commentsCache, toy) {
  const { subjects, aliasKeys } = buildSubjects(toy);
  const notices = [];
  const claims = [];
  let scanned = 0;

  for (const video of commentsCache?.videos ?? []) {
    const buckets = [
      ...(video.pinned ? [video.pinned] : []),
      ...(video.upComments ?? []),
      ...(video.endorsed ?? []),
      ...(video.hot ?? []),
    ];
    const seen = new Set();
    for (const c of buckets) {
      if (!c?.rpid || seen.has(c.rpid)) continue;
      seen.add(c.rpid);
      scanned++;
      const message = c.message ?? "";
      const trust = trustOf(c, video);

      if (trust === "official" && NOTICE_KEYWORDS.some((k) => message.includes(k))) {
        notices.push({
          ep: video.ep,
          bvid: video.bvid,
          rpid: c.rpid,
          uname: c.uname,
          trust,
          excerpt: excerptOf(message),
        });
      }

      const mentions = findMentions(message, subjects, aliasKeys);
      if (!mentions.length) continue;
      const found = extractClaims(message);
      if (!found.length) continue;

      for (const claim of found) {
        const mt = nearestMention(claim.index, mentions);
        if (!mt) continue;
        if (mt.target === "ambiguous") {
          claims.push(makeClaim(claim, c, video, trust, null, "ambiguous", null, mt.key));
          continue;
        }
        const subject = mt.target ?? null;
        const v = verdict(claim, subject);
        claims.push(
          makeClaim(claim, c, video, trust, subject, v.status, v.expected)
        );
      }
    }
  }

  // 同主语同断言重复出现只留最高信任一条；歧义断言也留（UI 里标"指向不明"）
  const dedup = new Map();
  for (const cl of claims) {
    const key = `${cl.model ?? cl.mentionKey ?? "?"}|${cl.kind}|${String(cl.claimed)}`;
    const prev = dedup.get(key);
    if (
      !prev ||
      TRUST_RANK[cl.trust] > TRUST_RANK[prev.trust] ||
      (TRUST_RANK[cl.trust] === TRUST_RANK[prev.trust] && cl.like > prev.like)
    ) {
      dedup.set(key, cl);
    }
  }
  const final = [...dedup.values()];

  const stats = {
    videos: commentsCache?.videos?.length ?? 0,
    scanned,
    claims: final.length,
    confirmed: final.filter((c) => c.status === "confirmed").length,
    conflict: final.filter((c) => c.status === "conflict").length,
    unverifiable: final.filter((c) => c.status === "unverifiable").length,
    ambiguous: final.filter((c) => c.status === "ambiguous").length,
  };

  return { stats, notices, claims: final };
}

function makeClaim(claim, comment, video, trust, subject, status, expected, mentionKey = null) {
  return {
    model: subject?.display ?? null,
    modelKey: subject?.key ?? null,
    mentionKey,
    kind: claim.kind,
    claimed: claim.text,
    expected: expected ?? null,
    status,
    trust,
    ep: video.ep,
    bvid: video.bvid,
    rpid: comment.rpid,
    uname: comment.uname,
    like: comment.like ?? 0,
    excerpt: excerptOf(comment.message),
  };
}
