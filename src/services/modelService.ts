import { KillLineRecord, RankedKillLineRecord, StatusType } from "../types";
import { COST_DATA } from "../data/shishanData";

export interface ModelFilterOptions {
  searchQuery?: string;
  filterTier?: "ALL" | "TOP" | "FLASH" | string;
  sortBy?: "score" | "name" | "diamond" | "king";
}

/**
 * 模型数据与排行榜业务服务
 * 负责模型列表聚合、多维度检索过滤、排序以及数据导出
 *
 * 注意：这里所有方法都是纯函数，数据一律由调用方传入。
 * 把数据从模块常量改成入参之后，拿到新一版数据直接重排即可，
 * 不必再改代码、不必重新构建。
 */
export class ModelService {
  /**
   * 按 ID 查找指定模型
   */
  static getModelById(
    data: KillLineRecord[],
    id: string
  ): KillLineRecord | undefined {
    return data.find((m) => m.id === id);
  }

  /**
   * 获取花费结算对比数据
   */
  static getCostData() {
    return COST_DATA;
  }

  /**
   * 综合检索与排序（纯函数）
   * @param data 当前生效的模型数据，来自 rankingSource
   */
  static filterAndSortModels(
    data: RankedKillLineRecord[],
    options: ModelFilterOptions = {}
  ): RankedKillLineRecord[] {
    const { searchQuery = "", filterTier = "ALL", sortBy = "score" } = options;

    return data.filter((item) => {
      // 1. 关键词搜索
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesModel = item.model.toLowerCase().includes(q);
        const matchesQuote = item.quote.toLowerCase().includes(q);
        const matchesTier = item.tier.toLowerCase().includes(q);
        if (!matchesModel && !matchesQuote && !matchesTier) {
          return false;
        }
      }

      // 2. 梯队筛选
      if (filterTier === "TOP") {
        return (
          item.kingStatus === "pass" ||
          item.kingStatus === "warn" ||
          item.diamondStatus === "pass"
        );
      }
      if (filterTier === "FLASH") {
        return item.category === "Flash" || item.model.toLowerCase().includes("flash");
      }

      return true;
    }).sort((a, b) => {
      // 3. 多规则排序
      if (sortBy === "name") {
        return a.model.localeCompare(b.model);
      }
      if (sortBy === "diamond") {
        const weight: Record<StatusType, number> = { pass: 3, warn: 2, fail: 1, none: 0 };
        return weight[b.diamondStatus] - weight[a.diamondStatus] || b.score - a.score;
      }
      if (sortBy === "king") {
        const weight: Record<StatusType, number> = { pass: 3, warn: 2, fail: 1, none: 0 };
        return weight[b.kingStatus] - weight[a.kingStatus] || b.score - a.score;
      }
      return b.score - a.score;
    });
  }

  /**
   * 导出数据为 JSON 或 CSV 并自动触发下载
   * @param scope 当前收录范围，用于生成标题。期数不再写死，UP主更新后自动跟着变
   */
  static exportData(
    data: KillLineRecord[],
    format: "json" | "csv",
    scope?: { episodesCovered: number; videosFound: number; pending: number }
  ): void {
    const blob =
      format === "json"
        ? this.exportToJson(data, scope)
        : this.exportToCsv(data);
    const filename = `shishan-benchmark-data.${format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 导出数据为 JSON 格式 Blob
   */
  static exportToJson(
    data: KillLineRecord[],
    scope?: { episodesCovered: number; videosFound: number; pending: number }
  ): Blob {
    const title = scope
      ? `屎山论剑实测榜 · 已录 ${scope.episodesCovered} 期正片 / 共发现 ${scope.videosFound} 条视频（${scope.pending} 条待补录）`
      : "屎山论剑实测榜 · 难度斩杀线 × 花费全量对照";
    const dataStr = JSON.stringify(
      {
        title,
        source: "B站: Token就是词元",
        exportedAt: new Date().toISOString(),
        killLines: data,
        costSettlements: COST_DATA,
      },
      null,
      2
    );
    return new Blob([dataStr], { type: "application/json" });
  }

  /**
   * 导出数据为 CSV 格式 Blob（带 UTF-8 BOM 防止 Excel 乱码）
   */
  static exportToCsv(data: KillLineRecord[]): Blob {
    const headers = [
      "模型名称",
      "天梯梯队",
      "黄金线",
      "钻石线",
      "王者线",
      "实测证言",
      "战力指数",
      "全榜名次",
    ];
    const rows = data.map((d) => {
      const ranked = d as RankedKillLineRecord;
      return [
        `"${d.model}"`,
        `"${d.tier}"`,
        `"${d.gold}"`,
        `"${d.diamond}"`,
        `"${d.king}"`,
        `"${d.quote.replace(/"/g, '""')}"`,
        `"${d.score}"`,
        `"${ranked.rank ?? ""}"`,
      ];
    });
    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  }
}
