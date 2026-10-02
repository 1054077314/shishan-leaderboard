/**
 * toy 数据解析的纯函数集合：版本解析 / 官方考核解析 / 战绩取数 / 轮次折算。
 *
 * 存在理由：rebuildRanking.mjs 早期把这三步写成了"模糊匹配一把梭"，
 * 实测造成两类错数据（均可复现）：
 *  1. 版本解析靠"最长 key 互相 contains"，ladder 的 `Qwen3.8Max` 会命中
 *     `Qwen3.8Max Preview`，而榜上该行指的是正式版；
 *  2. 官方考核匹配靠"token 交集 ≥2"，于是
 *     Grok4.7 蹭到 Grok 4.5 的分、GLM5.3Flash 蹭到 GLM-5.3 的分、
 *     Qwen3.8Flash 蹭到 Qwen3.8 27B 的分 —— 三个跨版本串分。
 * 因此这里一律改成「精确 → 去渠道后缀 → 显式别名」三级，宁可判"无官方考核"
 * 也不猜。函数保持无 IO、无副作用，tests/toyResolve.test.mjs 直接断言。
 */

/** 归一化：小写并去掉空白与 - _ . ，让 "GLM-5.3" 与 "GLM5.3" 可比 */
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s\-_.]/g, "");

/** 渠道/阶段后缀：同名模型的不同发布形态，比对时可剥掉 */
const CHANNEL_SUFFIX = /(正式版|测试版|稳定版|preview|beta|rc)$/;

/** 剥掉发布形态后缀后的归一化名（norm 后小写，故只匹配小写形式） */
export const stripChannel = (key) => String(key ?? "").replace(CHANNEL_SUFFIX, "");

/** 带 preview/beta 等字样的版本视为"非正式"，同名候选里排最后 */
const channelPenalty = (key) => (/(preview|beta|rc|测试)/.test(key) ? 1 : 0);

/**
 * ladder 行名 → player-data 版本。
 *
 * 分级（score 越大越可信，只用最高一档）：
 *   4 归一化完全相等
 *   3 索引 key 去掉发布形态后缀后相等（榜上 "Qwen3.8Max" ↔ "Qwen3.8Max正式版"）
 *   2 行名去掉后缀后相等
 *   1 索引 key 包含行名（行名是版本 label 的缩写），取最短者
 * 同分再按"非正式排后 → 名字更短者胜"排。全不命中返回 null，由调用方告警。
 */
export function resolveVersion(rowName, versionIndex = {}) {
  const key = norm(rowName);
  if (!key) return null;
  const hits = [];
  for (const [k, v] of Object.entries(versionIndex)) {
    const ks = stripChannel(k);
    const kstripped = stripChannel(key);
    let score = 0;
    if (k === key) score = 4;
    else if (ks === key) score = 3;
    else if (k === kstripped || ks === kstripped) score = 2;
    else if (ks.includes(key)) score = 1;
    if (!score) continue;
    hits.push({ k, v, score, len: k.length });
  }
  if (!hits.length) return null;
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      channelPenalty(a.k) - channelPenalty(b.k) ||
      a.len - b.len
  );
  const best = hits[0];
  // 同级候选不止一个 = 名字本身不足以唯一定位，这次是靠排序规则选的，
  // 必须让调用方告警：ladder 行名与版本 label 的对应一旦判错，整行战绩就错。
  const sameTier = hits.filter((h) => h.score === best.score);
  return {
    ...best.v,
    method: `v${best.score}`,
    ambiguous: sameTier.length > 1,
    candidates: ambiguousNames(sameTier),
  };
}

function ambiguousNames(hits) {
  return hits.length > 1 ? hits.map((h) => h.v?.version ?? h.k) : [];
}

/**
 * 官方考核名别名表：ladder 行名与 assessment-data 名字既不相等、也不差一个
 * 发布形态后缀，但确认是同一个被考核版本时才登记。新增条目必须能举出出处。
 * key/value 均为 norm 后的名字。
 */
export const ASSESS_ALIASES = {
  // 英雄榜挑战榜写作 "DeepSeek Flash"，考核场官方标题为 "DeepSeek V4 Flash"
  deepseekflash: "deepseekv4flash",
};

/**
 * ladder 行名 → assessment-data 官方考核记录。
 * 只做精确、去后缀、别名三级，绝不做 token 交集：跨版本串分是这里最贵的错误。
 */
export function resolveAssessment(rowName, assessmentsByName = {}) {
  const key = norm(rowName);
  if (!key) return null;
  if (assessmentsByName[key])
    return { assess: assessmentsByName[key], method: "exact" };
  const aliased = ASSESS_ALIASES[key];
  if (aliased && assessmentsByName[aliased])
    return { assess: assessmentsByName[aliased], method: "alias" };
  const stripped = stripChannel(key);
  if (stripped !== key && assessmentsByName[stripped])
    return { assess: assessmentsByName[stripped], method: "stripped" };
  for (const [k, a] of Object.entries(assessmentsByName)) {
    if (stripChannel(k) === key) return { assess: a, method: "assessStripped" };
  }
  return null;
}

/**
 * 挑战榜行名(norm) → 总积分榜行名(norm)。两榜写法漂移（连字符/厂商前缀/
 * 展示后缀），norm 相等者由代码直接匹配，这里只登记匹配不上的别名。
 * 登记纪律与 ASSESS_ALIASES 相同：出处必须能在 player-data 里指认。
 *   Opus5.5 ← "Claude Opus 5.5"：players.claude-opus.name="Claude Opus" +
 *     versions[label=Opus5.5].short="5.5"，两字段拼出积分榜行名，唯一候选。
 *   GPT6    ← "GPT-6 Astra"：players.gpt.name="GPT" +
 *     versions[label=GPT6].short="6 Astra"。同家族的 GPT6 Sol short="6 Sol"，
 *     积分榜没有 "GPT-6 Sol"，故 Astra 只能挂在 GPT6 上，不是二选一猜的。
 * 由 short 拼名这条规则不通用（14 行只命中 5 行，积分榜写法并不统一），
 * 所以保留显式登记。以下两条查实是**不同版本**，不是写法漂移，禁止登记：
 *   "MiMo 2.6 Pro" —— players.mimo 只有 MiMo2.6Flash / MiMo2.5青春版，
 *     没有任何 short="2.6 Pro" 的版本，与榜上 MiMo2.6Flash 不同版本；
 *   "MiniMax M3" —— players.minimax 里 label="MiniMax M3"（short="M3"）
 *     本身就是独立版本，榜上行是 MiniMax M3.1 Flash，两行各自的积分。
 */
export const STANDINGS_ALIASES = {
  opus55: "claudeopus55",
  gpt6: "gpt6astra",
};

/**
 * 挑战榜行名 → 总积分榜行。先认 norm 相等，再认 STANDINGS_ALIASES，
 * 两级都不中就返回 null（前端积分列显示 —），不做包含/近似匹配。
 */
export function resolveStandings(rowName, standingsByName = {}) {
  const key = norm(rowName);
  if (!key) return null;
  if (standingsByName[key])
    return { entry: standingsByName[key], method: "exact" };
  const alias = STANDINGS_ALIASES[key];
  if (alias && standingsByName[alias])
    return { entry: standingsByName[alias], method: "alias" };
  return null;
}

/**
 * 取某个榜单行的斩杀线战绩来源。
 *
 * ⚠️ toy 的 player-data 有三层，混用会得出完全不同的结论：
 *   players[slug].career        —— 家族（整个产品线）生涯累计
 *   players[slug].byVersion[label] —— 单个版本的战绩（挑战榜排的就是版本）
 * 挑战榜每一行都是一个具体版本，所以只认 byVersion；家族数据一律不用，
 * 否则 GLM5.3 与 GLM5.3Flash 会显示一模一样的斩杀线（曾经的真实 bug）。
 */
export function pickStats(player, versionLabel) {
  const byVersion = player?.byVersion;
  if (byVersion && versionLabel && byVersion[versionLabel]) {
    const rec = byVersion[versionLabel];
    if (rec.byHardness)
      return { byHardness: rec.byHardness, volume: rec.volume ?? null, scope: "version" };
  }
  return { byHardness: null, volume: null, scope: "none" };
}

/** players 以 slug 为 key，而 versionIndex.family 存的是展示名，这里建一张反查表 */
export function indexPlayersByName(players = {}) {
  const map = new Map();
  for (const [slug, p] of Object.entries(players)) {
    if (!p?.name) continue;
    map.set(norm(p.name), { slug, player: p });
  }
  return map;
}

/** 考核 / 版本记录的可迭代索引 */
export function indexByNorm(items = [], keyOf = (x) => x?.name) {
  const map = {};
  for (const item of items) {
    const k = norm(keyOf(item));
    if (k) map[k] = item;
  }
  return map;
}

/**
 * byHardness 的 [ok, total] 折成前端三档。
 * 语义：total = 该版本出战场次，ok = 其中第一轮就通过的场次数，
 * 即"一轮通过率"，青铜+白银+黄金合并为 gold。
 * 格子文案一律带"首轮"字样（曾是"多轮通过"，语义正好相反）——
 * 只说 ok/total 的比值口径，不暗示轮次消耗。
 */
export function foldRounds(byHardness = {}) {
  const pick = (key) => {
    const v = byHardness[key];
    return Array.isArray(v) && v.length >= 2
      ? { ok: v[0] | 0, total: v[1] | 0 }
      : { ok: 0, total: 0 };
  };
  const b = pick("bronze"), s = pick("silver"), g = pick("gold");
  const gold = { ok: b.ok + s.ok + g.ok, total: b.total + s.total + g.total };
  const tiers = { gold, diamond: pick("diamond"), king: pick("king") };
  const out = {};
  for (const [tier, { ok, total }] of Object.entries(tiers)) {
    if (!total) {
      out[tier] = { round: "none", status: "none", text: "无记录" };
    } else if (ok === total) {
      out[tier] = { round: 1, status: "pass", text: "一轮过" };
    } else if (ok / total >= 0.6) {
      out[tier] = { round: 2, status: "warn", text: `首轮通过 ${ok}/${total}` };
    } else if (ok > 0) {
      out[tier] = { round: "fail", status: "fail", text: `首轮仅过 ${ok}/${total}` };
    } else {
      out[tier] = { round: "fail", status: "fail", text: `首轮全灭 0/${total}` };
    }
  }
  return out;
}
