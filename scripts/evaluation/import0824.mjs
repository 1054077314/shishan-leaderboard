import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readUtf8(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required source file: ${relative(process.cwd(), path)}`);
  }
  return readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readUtf8(path));
}

function toPosix(value) {
  return value.split(sep).join("/");
}

function sourceRef(root, path, kind) {
  return {
    path: toPosix(relative(root, path)),
    kind,
    sha256: sha256(readFileSync(path)),
  };
}

function listFiles(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => extensions.includes(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

function findTableRow(text, label) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes(label));
  if (start < 0) throw new Error(`Table section not found: ${label}`);
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length >= 2 && !/^[-: ]+$/.test(cells[0])) return cells;
  }
  throw new Error(`Table row not found: ${label}`);
}

function parseNumber(value, context) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing score cell: ${context}`);
  }
  const digits = value.replace(/[^\d.-]/g, "");
  const number = Number(digits);
  if (!digits || !Number.isFinite(number)) throw new Error(`Invalid score value: ${value} (${context})`);
  return number;
}

function parsePipeTable(text, heading) {
  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.includes(heading));
  if (headingIndex < 0) throw new Error(`Heading not found: ${heading}`);
  let headerIndex = -1;
  for (let i = headingIndex; i < lines.length; i += 1) {
    if (lines[i].trim().startsWith("|") && lines[i].includes("/")) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) throw new Error(`Table header not found: ${heading}`);

  const splitRow = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
  const headers = splitRow(lines[headerIndex]);
  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) {
      if (rows.length > 0 && line.trim() === "") break;
      continue;
    }
    const cells = splitRow(line);
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    if (cells.length !== headers.length) continue;
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  }
  if (rows.length === 0) throw new Error(`No rows found for table: ${heading}`);
  return { headers, rows };
}

function findDimensionTable(suite) {
  return suite.scoring.dimensions.map((dimension) => ({
    id: dimension.id,
    name: dimension.name,
    max: dimension.max,
  }));
}

function normalizeAnswerName(name) {
  const cleaned = name.replace(/`/g, "").trim();
  const fileMatch = cleaned.match(/([^\s/\\]+\.(?:md|txt))/i);
  return fileMatch ? fileMatch[1] : cleaned;
}

function answerDisplayName(fileName) {
  return fileName.replace(/\.(md|txt)$/i, "");
}

function getAnswerFile(answerDir, fileName) {
  const direct = join(answerDir, fileName);
  if (existsSync(direct)) return direct;
  const matches = listFiles(answerDir, [".md", ".txt"]).filter(
    (name) => name.toLowerCase() === fileName.toLowerCase()
  );
  if (matches.length !== 1) {
    throw new Error(`Answer file cannot be mapped uniquely: ${fileName}`);
  }
  return join(answerDir, matches[0]);
}

function createEntry({
  root,
  suiteId,
  ordinal,
  answerDir,
  fileName,
  actorId,
  displayName,
  groupId,
  groupLabel,
  sourceOrder,
  sourceRank,
  sourceNote,
  scores,
}) {
  const answerPath = getAnswerFile(answerDir, fileName);
  const answerText = readUtf8(answerPath);
  return {
    id: `${suiteId}:${actorId}`,
    actorId,
    displayName,
    answerText,
    answerFormat: extname(answerPath).toLowerCase() === ".md" ? "markdown" : "text",
    answerRef: sourceRef(root, answerPath, "answer"),
    groupId,
    groupLabel,
    sourceOrder,
    sourceRank,
    sourceNote,
    scores,
  };
}

function makeScore({ judgeId, judgeName, role, total, dimensions, comment, meanConfidence, confidence, reviewStatus, reviewReasons }) {
  return {
    judgeId,
    judgeName,
    role,
    total,
    dimensions,
    comment,
    meanConfidence,
    confidence,
    reviewStatus,
    reviewReasons,
  };
}

function readJevScore(result, role = "secondary-review") {
  return {
    judgeId: "jev",
    judgeName: "Jev 自动评分",
    role,
    total: result.total,
    dimensions: Object.fromEntries(
      Object.entries(result.dimensions).map(([key, value]) => [key, value.points])
    ),
    comment: result.judgeComment,
    meanConfidence: result.meanConfidence,
    confidence: Object.fromEntries(
      Object.entries(result.dimensions).map(([key, value]) => [key, value.confidence])
    ),
    reviewStatus: result.flags?.needsReview ? "needs-review" : "accepted",
    reviewReasons: result.flags?.reasons || [],
  };
}

function addJevScores(entries, jevData) {
  const byModel = new Map(
    jevData.results.map((result) => {
      const path = jevData.key[result.sampleId] || "";
      return [answerDisplayName(basename(path)), result];
    })
  );
  return entries.map((entry) => {
    const result = byModel.get(entry.actorId);
    if (!result) throw new Error(`Jev result not found for model: ${entry.actorId}`);
    return {
      ...entry,
      scores: [...entry.scores, readJevScore(result)],
    };
  });
}

function suite01(root) {
  const tests = readJson(join(root, "model-arena/data/tests.json"));
  const suite = tests.suites.find((item) => item.id === "survival-abc");
  if (!suite) throw new Error("Suite survival-abc missing from tests.json");
  const scoresData = readJson(join(root, "model-arena/data/scores.json"));
  const jevData = readJson(join(root, "tools/jev-scorer/out/jev-scores-survival-abc.json"));
  const models = readJson(join(root, "model-arena/data/models.json"));
  const entries = scoresData.scores.map((score, index) => {
    const model = models.models.find((item) => item.id === score.modelId);
    if (!model) throw new Error(`Model not found: ${score.modelId}`);
    const v2 = score.byJudge.v2;
    const v1 = score.byJudge.v1;
    return createEntry({
      root,
      suiteId: suite.id,
      ordinal: "01",
      answerDir: join(root, "答案/01-生存决策ABC题"),
      fileName: `${model.dirName}.md`,
      actorId: model.id,
      displayName: model.displayName,
      groupId: v2.total >= 72 ? "tier-1" : v2.total >= 60 ? "tier-2" : "tier-3",
      groupLabel: v2.total >= 72 ? "一档（档内不排序）" : v2.total >= 60 ? "二档" : "三档",
      sourceOrder: index + 1,
      sourceRank: null,
      sourceNote: "人工 v2 报告按档位呈现；档内不排序。",
      scores: [
        makeScore({
          judgeId: "v2",
          judgeName: "人工评审 v2（唯一权威）",
          role: "authoritative",
          total: v2.total,
          dimensions: v2.dimensions,
          comment: score.judgeComment.v2,
          reviewStatus: "accepted",
        }),
        makeScore({
          judgeId: "v1",
          judgeName: "人工评审 v1（信度旁证）",
          role: "reliability-only",
          total: v1.total,
          dimensions: v1.dimensions,
          comment: score.judgeComment.v1,
          reviewStatus: "accepted",
        }),
      ],
    });
  });
  return {
    id: suite.id,
    ordinal: "01",
    title: suite.name,
    taskStatus: "structured-copy",
    taskSummary: `${suite.questions.length} 道现实财务决策题合并评分，覆盖假设、计算、抗陷阱、兜底、可执行性和表达控制。`,
    sourceRefs: [
      sourceRef(root, join(root, "model-arena/data/tests.json"), "question-data"),
      sourceRef(root, join(root, "model-arena/data/scores.json"), "score-data"),
      sourceRef(root, join(root, "tools/jev-scorer/out/jev-scores-survival-abc.json"), "score-data"),
      sourceRef(root, join(root, "评分/01-生存决策ABC题/ABC模型答案评分报告-v2.md"), "report"),
    ],
    dimensions: findDimensionTable(suite),
    sampleAccounting: {
      sourceCount: 8,
      includedCount: entries.length,
      excluded: [
        { label: "hy3", reason: "原始答案文件缺失，无法核验" },
        { label: "minimax-m3", reason: "原始答案文件缺失，无法核验" },
        { label: "mimo-v2.5", reason: "原始答案文件缺失，无法核验" },
      ],
    },
    judges: [
      { id: "v2", name: "人工评审 v2", role: "authoritative" },
      { id: "v1", name: "人工评审 v1", role: "reliability-only" },
      { id: "jev", name: "Jev 自动评分", role: "secondary-review" },
    ],
    leaderboardMode: "tiers",
    primaryJudgeId: "v2",
    groups: [
      { id: "tier-1", label: "一档（档内不排序）" },
      { id: "tier-2", label: "二档" },
      { id: "tier-3", label: "三档" },
    ],
    limitations: [
      { code: "non-blind", text: "非盲评评审：答案文件直接带模型名，未执行删名随机编号。" },
      { code: "single-run", text: "单次评分，无稳定重测；v1/v2 个体漂移最大 9 分。" },
      { code: "tiered", text: "一档内部差距小于重测噪声，档内不排序。" },
    ],
    entries: addJevScores(entries, jevData),
  };
}

function suite02(root) {
  const reportPath = join(root, "评分/02-按摩消费题/按摩问题模型输出评分报告.md");
  const report = readUtf8(reportPath);
  const suite = readJson(join(root, "model-arena/data/tests.json")).suites.find(
    (item) => item.id === "massage-consumption"
  );
  const entries = parsePipeTable(report, "## 三、内容评分与排名").rows.map((row, index) => {
    const fileName = normalizeAnswerName(row["文件"] || row["答案"] || row["模型"]);
    const dimensionNames = [
      ["needs", "需求理解与结论 /15"],
      ["health", "医疗边界与健康安全 /25"],
      ["consumer", "消费避坑与合规 /20"],
      ["reasoning", "推理严谨与校准 /15"],
      ["executability", "可执行性 /15"],
      ["expression", "表达效率 /10"],
    ];
    const dimensions = Object.fromEntries(
      dimensionNames.map(([id, header]) => [id, parseNumber(row[header])])
    );
    const total = parseNumber(row["总分 /100"]);
    const groupId = "main";
    return createEntry({
      root,
      suiteId: "massage-consumption",
      ordinal: "02",
      answerDir: join(root, "答案/02-按摩消费题"),
      fileName,
      actorId: answerDisplayName(fileName),
      displayName: answerDisplayName(fileName),
      groupId,
      groupLabel: "有效样本",
      sourceOrder: index + 1,
      sourceRank: parseNumber(row["排名"]),
      sourceNote: "原始提示词未保存，评分只针对有效输出成品。",
      scores: [
        makeScore({
          judgeId: "human-v1",
          judgeName: "人工评审（单次）",
          role: "authoritative",
          total,
          dimensions,
          comment: undefined,
          reviewStatus: "accepted",
        }),
      ],
    });
  });
  return {
    id: "massage-consumption",
    ordinal: "02",
    title: "按摩消费决策测试",
    taskStatus: "original-prompt-missing",
    taskSummary: "在中国消费场景下评估按摩店、项目选择与健康、消费和服务边界风险。",
    sourceRefs: [
      sourceRef(root, reportPath, "report"),
      sourceRef(root, join(root, "问题/02-按摩消费题/README.md"), "question-data"),
    ],
    dimensions: [
      { id: "needs", name: "需求理解与结论", max: 15 },
      { id: "health", name: "医疗边界与健康安全", max: 25 },
      { id: "consumer", name: "消费避坑与合规", max: 20 },
      { id: "reasoning", name: "推理严谨与校准", max: 15 },
      { id: "executability", name: "可执行性", max: 15 },
      { id: "expression", name: "表达效率", max: 10 },
    ],
    sampleAccounting: {
      sourceCount: 8,
      includedCount: entries.length,
      excluded: [
        { label: "hy3", reason: "原始答案文件缺失，无法核验" },
        { label: "kimik3", reason: "原始答案文件缺失，无法核验" },
        { label: "mimo", reason: "原始答案文件缺失，无法核验" },
      ],
    },
    judges: [{ id: "human-v1", name: "人工评审（单次）", role: "authoritative" }],
    leaderboardMode: "source-order",
    primaryJudgeId: "human-v1",
    groups: [{ id: "main", label: "有效样本" }],
    limitations: [
      { code: "prompt-missing", text: "原始提示词未保存，不评价是否逐字遵循原提示词。" },
      { code: "non-blind", text: "非盲评评审：答案文件直接带模型名。" },
      { code: "single-run", text: "单次评分，中间 3–7 分差距不应解释为稳定能力差距。" },
    ],
    entries,
  };
}

function suite03(root) {
  const reportPath = join(root, "评分/03-现金流对话/extra-conversations模型输出评分报告.md");
  const report = readUtf8(reportPath);
  const rows = parsePipeTable(report, "## 三、总评分与成品质量排序").rows;
  const entries = rows.map((row, index) => {
    const fileName = normalizeAnswerName(row["文件"]);
    const base = fileName.replace(/\.txt$/i, "");
    const isNonBlind = base === "5.6";
    const dimensions = Object.fromEntries([
      ["facts", parseNumber(row["事实忠实度 /25"])],
      ["numbers", parseNumber(row["数字与时间 /20"])],
      ["safety", parseNumber(row["财务安全 /20"])],
      ["completeness", parseNumber(row["完整性 /15"])],
      ["executability", parseNumber(row["可执行性 /10"])],
      ["efficiency", parseNumber(row["相关性与效率 /10"])],
    ]);
    return createEntry({
      root,
      suiteId: "cashflow-dialogue",
      ordinal: "03",
      answerDir: join(root, "答案/03-现金流对话"),
      fileName,
      actorId: base,
      displayName: base,
      groupId: isNonBlind ? "context-separated" : "main",
      groupLabel: isNonBlind ? "非盲测／额外方案上下文" : "盲测条件样本",
      sourceOrder: index + 1,
      sourceRank: isNonBlind ? null : parseNumber(row["排名"]),
      sourceNote: isNonBlind ? "明确读过并比较其他方案，信息条件不同，单独解释。" : undefined,
      scores: [
        makeScore({
          judgeId: "human-v1",
          judgeName: "人工评审（单次）",
          role: "authoritative",
          total: parseNumber(row["总分 /100"]),
          dimensions,
          reviewStatus: "accepted",
        }),
      ],
    });
  });
  return {
    id: "cashflow-dialogue",
    ordinal: "03",
    title: "乌鲁木齐现金流对话",
    taskStatus: "source-context-only",
    taskSummary: "对同一现金流困境对话的延续回答，评估事实忠实度、数字时间一致性、财务安全和可执行性。",
    sourceRefs: [
      sourceRef(root, reportPath, "report"),
      sourceRef(root, join(root, "问题/03-现金流对话/README.md"), "question-data"),
    ],
    dimensions: [
      { id: "facts", name: "事实忠实度", max: 25 },
      { id: "numbers", name: "数字与时间一致性", max: 20 },
      { id: "safety", name: "财务安全与风险控制", max: 20 },
      { id: "completeness", name: "方案完整性", max: 15 },
      { id: "executability", name: "可执行性与条件意识", max: 10 },
      { id: "efficiency", name: "相关性与表达效率", max: 10 },
    ],
    sampleAccounting: {
      sourceCount: 5,
      includedCount: entries.length,
      excluded: [{ label: "对2.txt的对话总结.txt", reason: "原助手方案基线，不参加排名" }],
    },
    judges: [{ id: "human-v1", name: "人工评审（单次）", role: "authoritative" }],
    leaderboardMode: "context-separated",
    primaryJudgeId: "human-v1",
    groups: [
      { id: "main", label: "盲测条件样本" },
      { id: "context-separated", label: "非盲测／额外方案上下文" },
    ],
    limitations: [
      { code: "non-blind-sample", text: "5.6 明确读过并比较其他方案，获得额外上下文，单独解释。" },
      { code: "single-run", text: "单次评分，名次差距不具统计分辨力。" },
    ],
    entries,
  };
}

function suite04(root) {
  const reportPath = join(root, "评分/04-会议纪要改写/会议纪要改写模型输出评分报告.md");
  const report = readUtf8(reportPath);
  const rows = parsePipeTable(report, "## 三、总评分与成品质量排序").rows;
  const fileMap = {
    "命令5.6.txt": "gpt5.6.txt",
    "5.3flash.txt": "5.3flash.txt",
    "grok4.6.txt": "grok4.6.txt",
    "3.8flash.txt": "3.8flash.txt",
    "dp.txt": "dp.txt",
  };
  const entries = rows.map((row, index) => {
    const reportFile = normalizeAnswerName(row["文件"]);
    const fileName = fileMap[reportFile];
    if (!fileName) throw new Error(`Unmapped suite 04 answer: ${reportFile}`);
    const base = fileName.replace(/\.txt$/i, "");
    const isSeparated = base === "grok4.6";
    const dimensions = Object.fromEntries([
      ["facts", parseNumber(row["事实忠实度 /25"])],
      ["details", parseNumber(row["数字与细节 /20"])],
      ["uncertainty", parseNumber(row["不确定性处理 /20"])],
      ["coverage", parseNumber(row["覆盖完整性 /15"])],
      ["structure", parseNumber(row["结构与可执行性 /10"])],
      ["efficiency", parseNumber(row["相关性与效率 /10"])],
    ]);
    return createEntry({
      root,
      suiteId: "meeting-notes",
      ordinal: "04",
      answerDir: join(root, "答案/04-会议纪要改写"),
      fileName,
      actorId: base,
      displayName: base === "gpt5.6" ? "gpt5.6（报告中写作 命令5.6）" : base,
      groupId: isSeparated ? "context-separated" : "main",
      groupLabel: isSeparated ? "输入条件不同" : "主评测样本",
      sourceOrder: index + 1,
      sourceRank: isSeparated ? null : parseNumber(row["排名"]),
      sourceNote: isSeparated ? "自述严格依据会议纪要改写，输入条件与其他样本不同。" : undefined,
      scores: [
        makeScore({
          judgeId: "human-v1",
          judgeName: "人工评审（单次）",
          role: "authoritative",
          total: parseNumber(row["总分 /100"]),
          dimensions,
          reviewStatus: "accepted",
        }),
      ],
    });
  });
  return {
    id: "meeting-notes",
    ordinal: "04",
    title: "会议纪要改写测试",
    taskStatus: "original-prompt-missing",
    taskSummary: "把项目管理模块会议内容改写为可照做的现场演示讲解稿，事实源为录音原文。",
    sourceRefs: [
      sourceRef(root, reportPath, "report"),
      sourceRef(root, join(root, "问题/04-会议纪要改写/README.md"), "question-data"),
    ],
    dimensions: [
      { id: "facts", name: "事实忠实度", max: 25 },
      { id: "details", name: "数字与细节一致性", max: 20 },
      { id: "uncertainty", name: "不确定性与待确认处理", max: 20 },
      { id: "coverage", name: "覆盖完整性", max: 15 },
      { id: "structure", name: "结构与可执行性", max: 10 },
      { id: "efficiency", name: "相关性与表达效率", max: 10 },
    ],
    sampleAccounting: {
      sourceCount: 5,
      includedCount: entries.length,
      excluded: [],
    },
    judges: [{ id: "human-v1", name: "人工评审（单次）", role: "authoritative" }],
    leaderboardMode: "context-separated",
    primaryJudgeId: "human-v1",
    groups: [
      { id: "main", label: "主评测样本" },
      { id: "context-separated", label: "输入条件不同" },
    ],
    limitations: [
      { code: "prompt-missing", text: "题面未保存，不能评价是否逐字遵循原始提示词。" },
      { code: "input-different", text: "grok4.6 自述依据会议纪要，输入条件与其他样本不同。" },
      { code: "single-run", text: "单次评分，名次差距不具统计分辨力。" },
    ],
    entries,
  };
}

function suite05(root) {
  const tests = readJson(join(root, "model-arena/data/tests.json"));
  const suite = tests.suites.find((item) => item.id === "switch-rent");
  if (!suite) throw new Error("Suite switch-rent missing from tests.json");
  const jevData = readJson(join(root, "tools/jev-scorer/out/jev-scores-switch-rent.json"));
  const score = jevData.scores[0];
  if (!score) throw new Error("No Jev score for switch-rent");
  const answerFile = jevData.key[jevData.results[0].sampleId];
  if (!answerFile) throw new Error("No answer key for switch-rent");
  const answerName = basename(answerFile);
  const jevResult = jevData.results[0];
  const entry = createEntry({
    root,
    suiteId: suite.id,
    ordinal: "05",
    answerDir: join(root, "答案/05-换房决策题"),
    fileName: answerName,
    actorId: "commandcode-agent",
    displayName: "CommandCode Agent",
    groupId: "single",
    groupLabel: "单样本",
    sourceOrder: 1,
    sourceRank: null,
    sourceNote: "仅 Jev 自动评分，无人类标定，不生成名次。",
    scores: [readJevScore(jevResult, "sole-reference")],
  });
  return {
    id: suite.id,
    ordinal: "05",
    title: suite.name,
    taskStatus: "structured-copy",
    taskSummary: "单题决策测试，要求在 600 字内处理换房成本、通勤口径、情绪锚点和现金门槛。",
    sourceRefs: [
      sourceRef(root, join(root, "model-arena/data/tests.json"), "question-data"),
      sourceRef(root, join(root, "tools/jev-scorer/out/jev-scores-switch-rent.json"), "score-data"),
    ],
    dimensions: findDimensionTable(suite),
    sampleAccounting: {
      sourceCount: 1,
      includedCount: 1,
      excluded: [],
    },
    judges: [{ id: "jev", name: "Jev 自动评分", role: "sole-reference" }],
    leaderboardMode: "single-result",
    groups: [{ id: "single", label: "单样本" }],
    limitations: [
      { code: "no-human-calibration", text: "仅有一份 Jev 自动评分，没有人类评分标定，不生成名次。" },
      { code: "hard-limit", text: "600 字为硬约束，题面要求先结论后理由并显式说明不确定性。" },
    ],
    entries: [entry],
  };
}

export function buildEvaluationSnapshot(sourceRoot) {
  const root = resolve(sourceRoot);
  const suites = [suite01(root), suite02(root), suite03(root), suite04(root), suite05(root)];
  const expected = { "survival-abc": 5, "massage-consumption": 5, "cashflow-dialogue": 4, "meeting-notes": 5, "switch-rent": 1 };
  for (const suite of suites) {
    if (suite.entries.length !== expected[suite.id]) {
      throw new Error(`Unexpected entry count for ${suite.id}: ${suite.entries.length}`);
    }
    for (const entry of suite.entries) {
      if (!entry.answerText.trim()) throw new Error(`Empty answer for ${entry.id}`);
      for (const score of entry.scores) {
        const values = Object.values(score.dimensions);
        if (values.length === 0) throw new Error(`No dimensions for ${entry.id} judge=${score.judgeId}`);
        const sum = values.reduce((acc, value) => acc + value, 0);
        if (Math.abs(sum - score.total) > 0.05) {
          throw new Error(`Dimension sum ${sum} != total ${score.total} for ${entry.id} judge=${score.judgeId}`);
        }
      }
      for (const ref of [entry.answerRef, ...suite.sourceRefs]) {
        if (/^[A-Za-z]:[\\/]/.test(ref.path)) throw new Error(`Absolute source path leaked: ${ref.path}`);
      }
    }
  }
  const stablePayload = {
    schemaVersion: 1,
    source: { collectionId: "0824", access: "read-only" },
    policy: { audience: "internal-only", crossSuiteAggregateAllowed: false, scoreMixingAllowed: false },
    suites,
  };
  const dataVersion = `sha256:${sha256(JSON.stringify(stablePayload))}`;
  return {
    ...stablePayload,
    dataVersion,
    generatedAt: new Date().toISOString(),
  };
}
