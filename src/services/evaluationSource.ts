import { useCallback, useEffect, useRef, useState } from "react";
import type { EvaluationSnapshot } from "../types/evaluation";

export const EVALUATION_DATA_URL = "/evaluationData.json";

function isEvaluationSnapshot(value: unknown): value is EvaluationSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EvaluationSnapshot>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.dataVersion === "string" &&
    Array.isArray(candidate.suites) &&
    candidate.suites.every(
      (suite) =>
        suite &&
        typeof suite.id === "string" &&
        Array.isArray(suite.entries) &&
        Array.isArray(suite.dimensions)
    )
  );
}

export interface EvaluationDataState {
  data: EvaluationSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useEvaluationData(): EvaluationDataState {
  const [data, setData] = useState<EvaluationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const response = await fetch(`${EVALUATION_DATA_URL}?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`evaluationData.json ${response.status}`);
      const next: unknown = await response.json();
      if (!isEvaluationSnapshot(next)) throw new Error("评测快照格式无效");
      if (!mountedRef.current) return;
      setData(next);
      setError(null);
    } catch (cause) {
      if (!mountedRef.current) return;
      setData(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: () => void load() };
}
