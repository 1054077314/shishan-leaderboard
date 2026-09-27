export type SourceRefKind = "answer" | "report" | "score-data" | "question-data";

export interface SourceRef {
  path: string;
  kind: SourceRefKind;
  sha256: string;
}

export type EvaluationJudgeRole =
  | "authoritative"
  | "secondary-review"
  | "reliability-only"
  | "display-only"
  | "sole-reference";

export type EvaluationReviewStatus = "accepted" | "needs-review";

export interface EvaluationDimension {
  id: string;
  name: string;
  max: number;
}

export interface EvaluationScore {
  judgeId: string;
  judgeName: string;
  role: EvaluationJudgeRole;
  total: number;
  dimensions: Record<string, number>;
  comment?: string;
  meanConfidence?: number;
  confidence?: Record<string, number>;
  reviewStatus: EvaluationReviewStatus;
  reviewReasons?: string[];
}

export interface EvaluationEntry {
  id: string;
  actorId: string;
  displayName: string;
  answerText: string;
  answerFormat: "markdown" | "text";
  answerRef: SourceRef;
  groupId: string;
  groupLabel: string;
  sourceOrder: number;
  sourceRank?: number | null;
  sourceNote?: string;
  scores: EvaluationScore[];
}

export interface EvaluationGroup {
  id: string;
  label: string;
  note?: string;
}

export type EvaluationLeaderboardMode =
  | "tiers"
  | "source-order"
  | "context-separated"
  | "single-result";

export interface EvaluationSampleAccounting {
  sourceCount: number;
  includedCount: number;
  excluded: Array<{ label: string; reason: string }>;
}

export interface EvaluationLimitation {
  code: string;
  text: string;
  entryIds?: string[];
}

export interface EvaluationSuite {
  id: string;
  ordinal: "01" | "02" | "03" | "04" | "05";
  title: string;
  taskStatus: "structured-copy" | "source-context-only" | "original-prompt-missing";
  taskSummary: string;
  sourceRefs: SourceRef[];
  dimensions: EvaluationDimension[];
  sampleAccounting: EvaluationSampleAccounting;
  judges: Array<{ id: string; name: string; role: EvaluationJudgeRole }>;
  leaderboardMode: EvaluationLeaderboardMode;
  primaryJudgeId?: string;
  groups: EvaluationGroup[];
  limitations: EvaluationLimitation[];
  entries: EvaluationEntry[];
}

export interface EvaluationSnapshot {
  schemaVersion: 1;
  dataVersion: string;
  generatedAt: string;
  source: {
    collectionId: "0824";
    access: "read-only";
  };
  policy: {
    audience: "internal-only";
    crossSuiteAggregateAllowed: false;
    scoreMixingAllowed: false;
  };
  suites: EvaluationSuite[];
}
