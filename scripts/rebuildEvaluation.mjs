import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildEvaluationSnapshot } from "./evaluation/import0824.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(process.env.EVALUATION_SOURCE_ROOT || join(root, "..", "0824"));
const outputPath = resolve(process.env.EVALUATION_OUTPUT || join(root, "public", "evaluationData.json"));

if (!existsSync(sourceRoot)) {
  throw new Error(`Evaluation source directory not found: ${sourceRoot}`);
}

const snapshot = buildEvaluationSnapshot(sourceRoot);
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
const temporaryPath = `${outputPath}.tmp`;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(temporaryPath, serialized, "utf8");
if (existsSync(outputPath)) rmSync(outputPath, { force: true });
renameSync(temporaryPath, outputPath);

const counts = snapshot.suites.map((suite) => `${suite.id}:${suite.entries.length}`).join(" ");
console.log(`[rebuildEvaluation] wrote ${outputPath}`);
console.log(`[rebuildEvaluation] ${snapshot.suites.length} suites · ${counts}`);
console.log(`[rebuildEvaluation] dataVersion=${snapshot.dataVersion}`);
