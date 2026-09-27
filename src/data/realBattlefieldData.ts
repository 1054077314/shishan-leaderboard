export interface EpisodeMeta {
  ep: string; // "E01" ~ "E12"
  epNum: number;
  title: string;
  topic: string;
  difficulty: "黄金基础" | "黄金进阶" | "黄金死结" | "钻石初现" | "钻石攻坚" | "钻石分水岭" | "钻石死斗" | "王者前哨" | "王者绝壁" | "钻石决战" | "王者终局" | "断层全通";
  bvid: string;
  testedModelIds: string[]; // 真实在这一期出场并实测的模型ID
}

export interface ModelEpisodeRecord {
  score: number;
  tested: boolean; // 是否在该期实际实测，true 表示有真实实测视频记录
  roundResult: "一轮过" | "两轮过" | "三轮过" | "长考卡住" | "全灭" | "未参测" | "基准测试" | "专场首秀";
  note: string;
  bvid?: string;
}

export interface ModelHistoryData {
  modelId: string;
  modelName: string;
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  category: "Flagship" | "Thinking" | "Flash";
  color: string;
  debutEpisode: string; // 首次登场期数
  testedEpisodes: string[]; // 实际参测的期数列表
  // 每期的实测数据，key 为 "E01" ~ "E12"
  records: Record<string, ModelEpisodeRecord>;
}

// 真实 12 期官方实测期数元数据（严格对应 UP主 “Token就是词元” 《屎山论剑》视频）
export const REAL_EPISODES_META: EpisodeMeta[] = [
  {
    ep: "E01",
    epNum: 1,
    title: "第01期 祖传BUG｜国模AI选拔赛",
    topic: "祖传代码黄金基础排错",
    difficulty: "黄金基础",
    bvid: "BV1smTi6aE6J",
    testedModelIds: ["deepseek-v4-pro", "glm-53-flash", "qwen-38-flash"],
  },
  {
    ep: "E02",
    epNum: 2,
    title: "第02期 美团龙猫，请直面屎山代码！",
    topic: "LongCat 2.0 突击实测",
    difficulty: "黄金进阶",
    bvid: "BV1okM86eEwi",
    testedModelIds: ["longcat-20"],
  },
  {
    ep: "E03",
    epNum: 3,
    title: "第03期 HY3.0！面对屎山考验！",
    topic: "历史遗留并发与类型坑",
    difficulty: "黄金死结",
    bvid: "BV1etMJ6NEd4",
    testedModelIds: ["deepseek-v4-pro", "glm-53-flash"],
  },
  {
    ep: "E04",
    epNum: 4,
    title: "第04期 Grok4.5！火星AI改BUG！",
    topic: "多层类继承与全局变量",
    difficulty: "钻石初现",
    bvid: "BV1KeN76rEJ9",
    testedModelIds: ["grok-46"],
  },
  {
    ep: "E05",
    epNum: 5,
    title: "第05期 Kimi-K3｜照亮屎山！",
    topic: "万行工程与44分钟死循环",
    difficulty: "钻石攻坚",
    bvid: "BV1QNKw6uE3L",
    testedModelIds: ["kimi-k3", "glm-53-full"],
  },
  {
    ep: "E06",
    epNum: 6,
    title: "第06期 Qwen3.8Max｜Gemini3.6Flash",
    topic: "钻石分水岭与额度扣减",
    difficulty: "钻石分水岭",
    bvid: "BV1vrgQ6aEJU",
    testedModelIds: ["qwen-38-max", "gemini-38"],
  },
  {
    ep: "E07",
    epNum: 7,
    title: "第07期 中美AI！决战屎山之巅！",
    topic: "底层死锁与异步并发时序",
    difficulty: "钻石死斗",
    bvid: "BV1893x6HE7s",
    testedModelIds: ["deepseek-v4-pro", "gpt-6-astra", "claude-fable-51"],
  },
  {
    ep: "E08",
    epNum: 8,
    title: "第08期 DeepSeekV4Flash：下一位！",
    topic: "27万播放封神！Flash 狂斩钻石",
    difficulty: "王者前哨",
    bvid: "BV1fk3X6CEXb",
    testedModelIds: ["deepseek-v41-flash"],
  },
  {
    ep: "E09",
    epNum: 9,
    title: "第09期 开源闭源决战屎山之巅",
    topic: "王者绝壁！跨语言编译错误",
    difficulty: "王者绝壁",
    bvid: "BV1HzbX6tEvR",
    testedModelIds: ["gpt-6-astra", "claude-fable-51", "deepseek-v41-flash", "qwen-38-max", "glm-53-full"],
  },
  {
    ep: "E10",
    epNum: 10,
    title: "第10期 谁是模型斩杀线",
    topic: "黄金/钻石/王者斩杀线确立",
    difficulty: "钻石决战",
    bvid: "BV1mu4X6cEkD",
    testedModelIds: ["gpt-6-astra", "grok-46", "kimi-k3", "deepseek-v41-flash"],
  },
  {
    ep: "E11",
    epNum: 11,
    title: "第11期 GPT6和Fable5.1神仙打架",
    topic: "第429行刑侦级断案王者对决",
    difficulty: "王者终局",
    bvid: "BV1R2b56uEK7",
    testedModelIds: ["gpt-6-astra", "claude-fable-51"],
  },
  {
    ep: "E12",
    epNum: 12,
    title: "第12期 四家Flash大乱斗",
    topic: "1.17亿词元¥6.10终局大决算",
    difficulty: "断层全通",
    bvid: "BV1eCYD6QEqS",
    testedModelIds: ["deepseek-v41-flash", "glm-53-flash", "qwen-38-flash", "gemini-38"],
  },
];

// 各模型真实实测与战力评分数据
export const REAL_MODEL_HISTORIES: Record<string, ModelHistoryData> = {
  "gpt-6-astra": {
    modelId: "gpt-6-astra",
    modelName: "GPT-6 Astra",
    tier: "T0",
    category: "Flagship",
    color: "#be123c", // rose-400
    debutEpisode: "第07期",
    testedEpisodes: ["E07", "E09", "E10", "E11"],
    records: {
      E01: { score: 95.0, tested: false, roundResult: "未参测", note: "第01期尚未引入（基于题目难度推导一轮秒杀能力）" },
      E02: { score: 95.5, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 96.0, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 96.8, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 97.2, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 97.5, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 98.0, tested: true, roundResult: "一轮过", note: "中美决战首秀！钻石级死锁首轮一次通过", bvid: "BV1893x6HE7s" },
      E08: { score: 98.5, tested: false, roundResult: "未参测", note: "第08期为 DeepSeek Flash 专场" },
      E09: { score: 99.0, tested: true, roundResult: "一轮过", note: "王者绝壁决战！全场唯一一轮秒杀通过", bvid: "BV1HzbX6tEvR" },
      E10: { score: 99.2, tested: true, roundResult: "一轮过", note: "模型斩杀线评测：首轮破防王者题立下最高标杆", bvid: "BV1mu4X6cEkD" },
      E11: { score: 99.5, tested: true, roundResult: "一轮过", note: "神仙打架巅峰战！第429行逻辑完全零瑕疵秒杀", bvid: "BV1R2b56uEK7" },
      E12: { score: 99.5, tested: false, roundResult: "未参测", note: "第12期为轻量 Flash 专场" },
    },
  },
  "grok-46": {
    modelId: "grok-46",
    modelName: "Grok 4.6",
    tier: "T1",
    category: "Flagship",
    color: "#b45309", // amber-400
    debutEpisode: "第04期",
    testedEpisodes: ["E04", "E10"],
    records: {
      E01: { score: 81.0, tested: false, roundResult: "未参测", note: "第01期未参测" },
      E02: { score: 83.0, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 84.5, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 86.0, tested: true, roundResult: "一轮过", note: "火星极客专场首测！长思考模式攻破混乱旧代码", bvid: "BV1KeN76rEJ9" },
      E05: { score: 87.5, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 89.0, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 90.0, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 91.0, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 91.5, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 92.5, tested: true, roundResult: "两轮过", note: "斩杀线硬仗！王者级除 Astra 外仅 Grok 与 V4 Pro 做对", bvid: "BV1mu4X6cEkD" },
      E11: { score: 92.8, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 93.0, tested: false, roundResult: "未参测", note: "第12期未参测" },
    },
  },
  "claude-fable-51": {
    modelId: "claude-fable-51",
    modelName: "Claude Fable 5.1",
    tier: "T1",
    category: "Flagship",
    color: "#b45309", // amber-500
    debutEpisode: "第07期",
    testedEpisodes: ["E07", "E09", "E11"],
    records: {
      E01: { score: 88.0, tested: false, roundResult: "未参测", note: "第01期未参测" },
      E02: { score: 88.5, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 89.0, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 89.5, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 90.0, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 90.5, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 91.0, tested: true, roundResult: "一轮过", note: "中美决战首秀！代码风格最严谨规范，首轮过钻石", bvid: "BV1893x6HE7s" },
      E08: { score: 91.5, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 91.8, tested: true, roundResult: "三轮过", note: "开源闭源决战：钻石稳妥，王者复杂隐式陷阱需三轮收敛", bvid: "BV1HzbX6tEvR" },
      E10: { score: 92.0, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 92.5, tested: true, roundResult: "三轮过", note: "神仙打架神作！与 Astra 对线，钻石一轮对过、王者需三轮提示", bvid: "BV1R2b56uEK7" },
      E12: { score: 92.0, tested: false, roundResult: "未参测", note: "第12期未参测" },
    },
  },
  "deepseek-v4-pro": {
    modelId: "deepseek-v4-pro",
    modelName: "DeepSeek V4 Pro",
    tier: "T2",
    category: "Thinking",
    color: "#2563eb", // blue-400
    debutEpisode: "第01期",
    testedEpisodes: ["E01", "E03", "E07"],
    records: {
      E01: { score: 78.0, tested: true, roundResult: "两轮过", note: "系列揭幕战！展现长思考链基础，改对两处隐蔽缺陷", bvid: "BV1smTi6aE6J" },
      E02: { score: 80.0, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 82.0, tested: true, roundResult: "两轮过", note: "面对历史遗留业务并发逻辑，二轮收敛修复", bvid: "BV1etMJ6NEd4" },
      E04: { score: 83.5, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 84.0, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 85.0, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 88.0, tested: true, roundResult: "两轮过", note: "中美决战高光！两轮做对王者题，但钻石级偶发长考死锁", bvid: "BV1893x6HE7s" },
      E08: { score: 87.0, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 86.5, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 87.0, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 88.0, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 88.0, tested: false, roundResult: "未参测", note: "第12期未参测" },
    },
  },
  "deepseek-v41-flash": {
    modelId: "deepseek-v41-flash",
    modelName: "DeepSeek V4.1 Flash",
    tier: "T3",
    category: "Flash",
    color: "#0369a1", // sky-400
    debutEpisode: "第08期",
    testedEpisodes: ["E08", "E09", "E10", "E12"],
    records: {
      E01: { score: 70.0, tested: false, roundResult: "未参测", note: "第01期尚未发布" },
      E02: { score: 72.0, tested: false, roundResult: "未参测", note: "第02期尚未发布" },
      E03: { score: 73.5, tested: false, roundResult: "未参测", note: "第03期尚未发布" },
      E04: { score: 75.0, tested: false, roundResult: "未参测", note: "第04期尚未发布" },
      E05: { score: 76.0, tested: false, roundResult: "未参测", note: "第05期尚未发布" },
      E06: { score: 77.5, tested: false, roundResult: "未参测", note: "第06期尚未发布" },
      E07: { score: 79.0, tested: false, roundResult: "未参测", note: "第07期未实测" },
      E08: { score: 84.5, tested: true, roundResult: "一轮过", note: "27万播放封神名场面！钻石题一轮秒过，弹幕狂刷「下一位！」", bvid: "BV1fk3X6CEXb" },
      E09: { score: 82.0, tested: true, roundResult: "全灭", note: "开源闭源乱斗：钻石秒杀，王者题因状态地雷全灭但Token极省", bvid: "BV1HzbX6tEvR" },
      E10: { score: 84.0, tested: true, roundResult: "一轮过", note: "模型斩杀线实测：再次确立性价比第一，钻石题坚挺通过", bvid: "BV1mu4X6cEkD" },
      E11: { score: 84.0, tested: false, roundResult: "未参测", note: "第11期为双雄神仙打架专场" },
      E12: { score: 84.0, tested: true, roundResult: "一轮过", note: "终局决算！狂烧1.17亿Tokens仅¥6.10，性价比断层封神！", bvid: "BV1eCYD6QEqS" },
    },
  },
  "longcat-20": {
    modelId: "longcat-20",
    modelName: "美团龙猫 LongCat 2.0",
    tier: "T3",
    category: "Thinking",
    color: "#0e7490", // cyan-500
    debutEpisode: "第02期",
    testedEpisodes: ["E02"],
    records: {
      E01: { score: 72.0, tested: false, roundResult: "未参测", note: "第01期未发布" },
      E02: { score: 74.0, tested: true, roundResult: "一轮过", note: "美团龙猫专场突击实测！面对多层嵌套旧业务代码表现稳定", bvid: "BV1okM86eEwi" },
      E03: { score: 73.0, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 73.5, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 74.0, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 74.0, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 74.0, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 74.0, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 74.0, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 74.0, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 74.0, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 74.0, tested: false, roundResult: "未参测", note: "第12期未参测" },
    },
  },
  "kimi-k3": {
    modelId: "kimi-k3",
    modelName: "Kimi K3",
    tier: "T4",
    category: "Thinking",
    color: "#7e22ce", // purple-500
    debutEpisode: "第05期",
    testedEpisodes: ["E05", "E10"],
    records: {
      E01: { score: 42.0, tested: false, roundResult: "未参测", note: "第01期未参测" },
      E02: { score: 42.0, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 42.0, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 42.0, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 42.0, tested: true, roundResult: "长考卡住", note: "代表月亮照亮屎山！44分钟长考死循环烧几百万token未通过", bvid: "BV1QNKw6uE3L" },
      E06: { score: 42.0, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 42.0, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 42.0, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 42.0, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 42.0, tested: true, roundResult: "长考卡住", note: "斩杀线复盘：面对多层嵌套深坑再度天黑超时", bvid: "BV1mu4X6cEkD" },
      E11: { score: 42.0, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 42.0, tested: false, roundResult: "未参测", note: "第12期未参测" },
    },
  },
  "qwen-38-max": {
    modelId: "qwen-38-max",
    modelName: "Qwen 3.8 Max",
    tier: "T2",
    category: "Flagship",
    color: "#1d4ed8", // blue-500
    debutEpisode: "第06期",
    testedEpisodes: ["E06", "E09"],
    records: {
      E01: { score: 82.0, tested: false, roundResult: "未参测", note: "第01期未发布" },
      E02: { score: 82.0, tested: false, roundResult: "未参测", note: "第02期未发布" },
      E03: { score: 82.5, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 83.0, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 83.5, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 84.0, tested: true, roundResult: "一轮过", note: "B站AI大赛专场！超大杯阿里旗舰，稳健通过钻石分水岭", bvid: "BV1vrgQ6aEJU" },
      E07: { score: 84.5, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 85.0, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 85.5, tested: true, roundResult: "两轮过", note: "开源顶峰战力！排查复杂状态机稳健，王者题两轮收敛", bvid: "BV1HzbX6tEvR" },
      E10: { score: 85.5, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 86.0, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 86.0, tested: false, roundResult: "未参测", note: "第12期未参测" },
    },
  },
  "glm-53-flash": {
    modelId: "glm-53-flash",
    modelName: "GLM 5.3 Flash",
    tier: "T3",
    category: "Flash",
    color: "#047857", // emerald-400
    debutEpisode: "第01期",
    testedEpisodes: ["E01", "E03", "E12"],
    records: {
      E01: { score: 62.0, tested: true, roundResult: "一轮过", note: "第01期国模初选，黄金题快速通过", bvid: "BV1smTi6aE6J" },
      E02: { score: 63.5, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 64.0, tested: true, roundResult: "两轮过", note: "第03期实测，低开销修正基础语法缺陷", bvid: "BV1etMJ6NEd4" },
      E04: { score: 65.5, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 66.0, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 67.0, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 68.0, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 68.5, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 68.0, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 69.0, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 68.5, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 69.0, tested: true, roundResult: "长考卡住", note: "四家Flash大乱斗：3365万Token仅约¥2极度省流，但钻石卡住", bvid: "BV1eCYD6QEqS" },
    },
  },
  "qwen-38-flash": {
    modelId: "qwen-38-flash",
    modelName: "Qwen 3.8 Flash",
    tier: "T3",
    category: "Flash",
    color: "#047857", // emerald-500
    debutEpisode: "第01期",
    testedEpisodes: ["E01", "E12"],
    records: {
      E01: { score: 60.0, tested: true, roundResult: "一轮过", note: "第01期国模初测，黄金题稳妥通过", bvid: "BV1smTi6aE6J" },
      E02: { score: 61.5, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 63.0, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 64.0, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 65.0, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 65.5, tested: false, roundResult: "未参测", note: "第06期未参测" },
      E07: { score: 66.0, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 66.5, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 67.0, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 67.0, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 67.0, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 67.0, tested: true, roundResult: "长考卡住", note: "Flash终局大决战：老爷爷大思考沉思近2小时，仍卡死在钻石线", bvid: "BV1eCYD6QEqS" },
    },
  },
  "gemini-38": {
    modelId: "gemini-38",
    modelName: "Gemini 3.8",
    tier: "T4",
    category: "Flagship",
    color: "#78716c", // zinc-400
    debutEpisode: "第06期",
    testedEpisodes: ["E06", "E12"],
    records: {
      E01: { score: 48.0, tested: false, roundResult: "未参测", note: "第01期未参测" },
      E02: { score: 47.0, tested: false, roundResult: "未参测", note: "第02期未参测" },
      E03: { score: 46.5, tested: false, roundResult: "未参测", note: "第03期未参测" },
      E04: { score: 45.0, tested: false, roundResult: "未参测", note: "第04期未参测" },
      E05: { score: 46.0, tested: false, roundResult: "未参测", note: "第05期未参测" },
      E06: { score: 46.0, tested: true, roundResult: "全灭", note: "公开赛首战！黄金三轮全对，但钻石题未收敛，扣减37% Pro配额", bvid: "BV1vrgQ6aEJU" },
      E07: { score: 45.0, tested: false, roundResult: "未参测", note: "第07期未参测" },
      E08: { score: 46.0, tested: false, roundResult: "未参测", note: "第08期未参测" },
      E09: { score: 46.0, tested: false, roundResult: "未参测", note: "第09期未参测" },
      E10: { score: 45.0, tested: false, roundResult: "未参测", note: "第10期未参测" },
      E11: { score: 46.0, tested: false, roundResult: "未参测", note: "第11期未参测" },
      E12: { score: 46.0, tested: true, roundResult: "全灭", note: "终局Flash乱斗：钻石题依然翻车，跨期未破解恶劣代码工况", bvid: "BV1eCYD6QEqS" },
    },
  },
};
