import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyRanking,
  DEFAULT_SCORING,
  RankMap,
  ScoringConfig,
} from "./scoreEngine";
import { RankedKillLineRecord, RankingPayload, KillLineSeedRecord } from "../types";
import seed from "../data/killLineSeed.json";

/** 运行时数据源：放在 public/ 下，改数据不用重新构建 */
export const RANKING_DATA_URL = "/rankingData.json";

const SNAPSHOT_KEY = "shishan.ranking.snapshot.v1";

/** 默认轮询间隔：5 分钟。UP主更新后最多 5 分钟内前端自动重排 */
export const DEFAULT_POLL_MS = 5 * 60 * 1000;

/** 构建期兜底：rankingData.json 拉取失败时用仓库内的种子数据顶上 */
const FALLBACK_PAYLOAD: RankingPayload = {
  schemaVersion: 1,
  scoreMode: DEFAULT_SCORING.mode,
  dataVersion: "seed",
  updatedAt: new Date(0).toISOString(),
  scoring: { weights: DEFAULT_SCORING.weights, decay: DEFAULT_SCORING.decay },
  source: {
    upName: (seed as any).source.upName,
    mid: (seed as any).source.mid,
    seasonId: (seed as any).source.seasonId,
  },
  episodes: (seed as any).episodes,
  pendingEpisodes: [],
  models: (seed as any).models as KillLineSeedRecord[],
};

function readSnapshot(): RankMap | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as RankMap) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(ranks: RankMap): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(ranks));
  } catch {
    // 隐私模式下 localStorage 不可用时忽略，退化为不显示名次变动
  }
}

async function fetchPayload(signal?: AbortSignal): Promise<RankingPayload> {
  // 加时间戳绕过静态资源缓存，保证每次轮询拿到的是最新文件
  const res = await fetch(`${RANKING_DATA_URL}?t=${Date.now()}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`rankingData.json ${res.status}`);
  return (await res.json()) as RankingPayload;
}

export interface RankingState {
  /** 已实体化名次的模型列表 */
  ranked: RankedKillLineRecord[];
  payload: RankingPayload | null;
  loading: boolean;
  error: string | null;
  /** 最近一次成功同步的时间戳 */
  lastSyncedAt: number | null;
  /** true 表示线上数据不可用，当前展示的是仓库内兜底种子 */
  usingFallback: boolean;
  refresh: () => void;
}

/**
 * 排名数据源：负责拉取、变化检测（dataVersion）、名次重算与快照持久化。
 *
 * 触发时机：
 * 1. 首次挂载
 * 2. 定时轮询（默认 5 分钟）
 * 3. 页面重新可见 / 网络恢复
 * 4. 手动 refresh
 */
export function useRankingData(pollMs: number = DEFAULT_POLL_MS): RankingState {
  const [ranked, setRanked] = useState<RankedKillLineRecord[]>(() =>
    applyRanking(FALLBACK_PAYLOAD.models, null).ranked
  );
  const [payload, setPayload] = useState<RankingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [usingFallback, setUsingFallback] = useState(true);

  const versionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchPayload();
      if (!mountedRef.current) return;

      const config: ScoringConfig = {
        ...DEFAULT_SCORING,
        mode: next.scoreMode ?? DEFAULT_SCORING.mode,
        weights: next.scoring?.weights ?? DEFAULT_SCORING.weights,
        decay: next.scoring?.decay ?? DEFAULT_SCORING.decay,
      };

      const versionChanged = versionRef.current !== next.dataVersion;
      const previous = readSnapshot();
      const { ranked: nextRanked, ranks } = applyRanking(
        next.models,
        previous,
        config
      );

      // 只有数据版本真的变了才推进快照，避免重复渲染把 delta 抹平成 0
      if (versionChanged) {
        writeSnapshot(ranks);
        versionRef.current = next.dataVersion;
      }

      setRanked(nextRanked);
      setPayload(next);
      setUsingFallback(false);
      setError(null);
      setLastSyncedAt(Date.now());
    } catch (e) {
      if (!mountedRef.current) return;
      setUsingFallback(true);
      setError(e instanceof Error ? e.message : String(e));
      setRanked(applyRanking(FALLBACK_PAYLOAD.models, readSnapshot()).ranked);
      setPayload(FALLBACK_PAYLOAD);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(() => {
      // 后台标签页不轮询，回到前台时由 visibilitychange 补一次
      if (document.visibilityState === "visible") load();
    }, pollMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const onOnline = () => load();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [load, pollMs]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  return { ranked, payload, loading, error, lastSyncedAt, usingFallback, refresh };
}
