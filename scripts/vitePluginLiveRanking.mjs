/**
 * Vite 插件：让 public/rankingData.json 在本地 dev / preview 时保持"实时"。
 *
 * 背景问题：前端 useRankingData 每 5 分钟轮询 /rankingData.json，
 * 但该文件只有手动跑 `npm run sync`（python 采集 + node 重建）才会变化，
 * 轮询拿到的永远是旧快照 —— UP主发了新视频，榜单也不动。
 *
 * 做法：拦截 /rankingData.json 请求，文件超过 TTL 就自动执行
 *   1. python scripts/sync_toy.py         toy 英雄榜采集 -> scripts/.cache/toy.json
 *   2. node  scripts/rebuildRanking.mjs  重建 -> public/rankingData.json
 * 然后从磁盘伺服新文件。完全复用现有脚本，这里只负责调度。
 *
 * 行为约定：
 *  - 等待采集最多 waitMs；超时先把磁盘上的旧文件发出去，采集在后台继续跑完，
 *    下次轮询自然拿到新数据（前端兜底种子会在加载期间顶住首屏）。
 *  - single-flight：并发请求共享同一次刷新，不会叠加起多个 python。
 *  - 采集失败不改文件 mtime，下个轮询周期自动重试；期间一直用旧数据。
 *  - dataVersion 是内容哈希，数据没变时重发同名次快照，前端不会误报名次变动。
 *
 * 部署成纯静态站时本插件不参与（apply: "serve"），行为与从前一致。
 */
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const DATA_REL = path.join("public", "rankingData.json");

export function liveRankingPlugin(options = {}) {
  const root = options.root ?? process.cwd();
  const outFile = path.join(root, DATA_REL);

  // 默认 4 分钟：略短于前端 5 分钟的轮询间隔，保证每次轮询都有机会拿到新数据
  const ttlMs =
    Number(options.ttlMs ?? process.env.RANKING_TTL_MS) || 4 * 60 * 1000;
  // 等待采集完成的上限，超过先发旧数据（sync 采集含固定退避，实测约 20s）
  const waitMs =
    Number(options.waitMs ?? process.env.RANKING_REFRESH_WAIT_MS) || 30_000;
  // 硬超时：网络挂死时杀掉子进程，释放 single-flight，避免永远卡住
  const killMs =
    Number(options.killMs ?? process.env.RANKING_REFRESH_KILL_MS) || 90_000;

  let refreshing = null; // 进行中的刷新 Promise（single-flight）

  async function isStale() {
    try {
      const s = await stat(outFile);
      return Date.now() - s.mtimeMs > ttlMs;
    } catch {
      return true; // 文件不存在，必须重建
    }
  }

  function runStep(cmd, args, { killAfterMs = killMs } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { cwd: root, stdio: "pipe" });
      let output = "";
      child.stdout.on("data", (d) => (output += d));
      child.stderr.on("data", (d) => (output += d));
      const killer = setTimeout(() => {
        child.kill();
        reject(new Error(`${cmd} 超过 ${killAfterMs / 1000}s 未完成，已终止`));
      }, killAfterMs);
      child.on("error", (e) => {
        clearTimeout(killer);
        reject(e);
      });
      child.on("exit", (code) => {
        clearTimeout(killer);
        if (code === 0) resolve(output);
        else reject(new Error(`${cmd} 退出码 ${code}\n${output.slice(-2000)}`));
      });
    });
  }

  function refresh() {
    if (refreshing) return refreshing;
    console.log("[live-ranking] rankingData.json 已过期，自动同步 B 站数据…");
    refreshing = (async () => {
      const t0 = Date.now();
      await runStep("python", ["scripts/sync_toy.py"]);
      await runStep("node", ["scripts/rebuildRanking.mjs"]);
      console.log(
        `[live-ranking] 榜单数据已刷新，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`
      );
    })()
      .catch((e) => {
        console.warn(`[live-ranking] 自动同步失败，沿用现有文件: ${e.message}`);
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  async function serve(_req, res) {
    if (await isStale()) {
      await Promise.race([
        refresh(),
        new Promise((r) => setTimeout(r, waitMs)),
      ]);
    }
    try {
      const buf = await readFile(outFile);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(buf);
    } catch {
      res.statusCode = 404;
      res.end("rankingData.json 不存在，请先运行 npm run sync");
    }
  }

  const middleware = (req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (url !== "/rankingData.json") return next();
    serve(req, res).catch((e) => {
      console.warn(`[live-ranking] 伺服失败: ${e.message}`);
      next();
    });
  };

  return {
    name: "live-ranking-data",
    apply: "serve",
    // 注意：要同步注册（不能用 configureServer 返回的 post hook），
    // 否则排在 vite 内部静态中间件之后，public/ 里的旧文件会被先一步发出去
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
