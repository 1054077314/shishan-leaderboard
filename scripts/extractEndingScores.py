#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
自动抓取视频结尾的评分板（英雄榜 / 对阵表 / 小组排名），结构化存盘。

为什么：
  UP主发新视频后，实测结果（rounds）只能人工看视频录入。本脚本把其中
  机器可读的部分自动化：每集结尾都会展示官方结算板，下载视频结尾段、
  抽帧、OCR、按板式解析，产出 scripts/.cache/autoScores/<bvid>.json。
  rebuildRanking.mjs 会把这些结果合并进 pendingEpisodes，前端标注
  「自动识别 · 待人工确认」。识别结果不直接写入 rounds / 影响排名，
  排名仍只吃人工确认过的数据。

登录与清晰度：
  不带 Cookie 只能拿 360P，表格行高 ~5px，低于 OCR 下限（实测只能认出
  部分行）。把 B 站账号的 SESSDATA 放进 scripts/.bilibili_auth（仅一行，
  已 git-ignore，只用于请求 B 站自己的 CDN）即可解锁 720P/1080P，
  行高翻倍后本地 OCR 可用。

板式与解析（按画面特征分三类，识别不出的板子保留 rawLines 供人工看）：
  1) 英雄榜：每行 「排名 模型名 …… 积分 [状态]」，状态 ∈ 通过/晋级/淘汰/翻车/待定
  2) 对阵表：行内含 「A VS B」，可带比分
  3) 小组排名：行内含 W-D-L 式战绩 「a-b-c」+ 模型名

运行： python scripts/extractEndingScores.py [--bvids BVxxx ...] [--force]
依赖： pip install rapidocr-onnxruntime imageio-ffmpeg （opencv 随前者带入）
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_bilibili import _get, _wbi_sign, get_mixin_key  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE_DIR = os.path.join(HERE, ".cache")
AUTO_DIR = os.path.join(CACHE_DIR, "autoScores")
AUTH_FILE = os.path.join(HERE, ".bilibili_auth")
RANKING_FILE = os.path.join(ROOT, "public", "rankingData.json")
SEED_FILE = os.path.join(ROOT, "src", "data", "killLineSeed.json")

# 两遍扫描：粗扫定位板子出现在哪几秒，精扫只对候选帧做放大 OCR。
# 教训：固定在结尾抽 7 帧会漏掉板子只停留几秒的集数（总决赛结尾 76s 全是代码画面）；
# 而 720P 下 OCR 会把表格拆成单元格，行数暴增，全量精扫又太慢。
TAIL_SECONDS = 120        # 粗扫窗口：覆盖片尾结算板 + 片尾卡
SCAN_INTERVAL = 8         # 粗扫步长（秒），约 15 帧
SKIP_LAST_SECONDS = 4     # 最后几秒是片尾卡，跳过
BOARD_PICK_TOP = 3        # 粗扫打分后，最多选几帧进入精扫

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com/",
}

STATUS_WORDS = ("通过", "晋级", "淘汰", "翻车", "待定", "轮空", "备局", "胜", "负", "平")

VS_RE = re.compile(r"(.{2,30}?)\s*VS\s*(.{2,30}?)(?:\s+(\d+)\s*[-–:]\s*(\d+))?$")
# 对阵比分卡：左模型名 …… 3 : 4 …… 右模型名（结尾定格那张卡，无 VS 字样）
MATCH_CARD_RE = re.compile(
    r"(.{2,28}?)[\s·|]*(\d{1,2})\s*[:：]\s*(\d{1,2})[\s·|]*(.{2,28})"
)
# 战绩只可能是小个位数；放开到 \d+ 会把 "2026-08-1"（日期）误当战绩
WDL_RE = re.compile(r"(?<![\d.])(\d{1,2})\s*[-–]\s*(\d{1,2})\s*[-–]\s*(\d{1,2})(?![\d.])")
SCORE_RE = re.compile(r"^(.*?)[\s.·:：]+(\d{1,4})$")
# 阶梯榜上分数写作 "5分"，且常和名字分在相邻两行
INLINE_SCORE_RE = re.compile(r"(\d{1,2})\s*分")
STATUS_RE = re.compile("(" + "|".join(STATUS_WORDS) + ")")
# 两位数分数后紧跟新模型名 = 左右两列被 OCR 拼进同一行；
# 只认两位数，免得把 "Qwen 3.8 Max" 里的版本号当切点
SPLIT_AFTER_NUM = re.compile(r"(?<=\d{2})\s+(?=[A-Z][A-Za-z])")
# 抽签/分组板特征词：命中多就说明这帧是抽签分组，不是评分结算。
# 英文词必须全大写——代码截图里 "customerDrawing" 会把 DRAWING 误触发。
DRAW_TOKEN_RE = re.compile(r"POT\s*\d|TIER|DRAWING|GROUP\s*[A-D]|抽签|签池|档位")
DRAW_ROW_RE = re.compile(
    r"(?:([A-Z])\s*组)?\s*([A-Za-z][A-Za-z0-9.\-]{1,24})\s*POT\s*(\d)", re.I
)
# 代码/日志截图不是板面，别混进 raw 污染人工核对区
NOISE_RE = re.compile(r"\b(java|import |xml|mvn|http|://|\{\}|\(\)|;|=>|SELECT |public |void )", re.I)


def load_sessdata():
    """SESSDATA：环境变量优先，其次 scripts/.bilibili_auth（一行纯文本）"""
    v = os.environ.get("BILI_SESSDATA", "").strip()
    if v:
        return v
    try:
        with open(AUTH_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    return line.split("SESSDATA=")[-1].strip().strip(";")
    except OSError:
        pass
    return ""


def get_ffmpeg():
    import imageio_ffmpeg  # 延迟导入：纯 API 场景（比如只查缓存）不必装

    return imageio_ffmpeg.get_ffmpeg_exe()


def pending_bvids():
    """待补录列表来自 rankingData.json；没有就退回合集缓存里的全部视频"""
    try:
        with open(RANKING_FILE, "r", encoding="utf-8") as f:
            rank = json.load(f)
        bvids = [e["bvid"] for e in rank.get("pendingEpisodes", [])]
        if bvids:
            return bvids
    except (OSError, ValueError, KeyError):
        pass
    cache_file = os.path.join(CACHE_DIR, "bilibili_season.json")
    try:
        with open(cache_file, "r", encoding="utf-8") as f:
            cache = json.load(f)
        return [e["bvid"] for e in cache.get("episodes", [])][-6:]
    except (OSError, ValueError, KeyError):
        return []


def roster_names():
    """花名册：用于给识别出的名字打 matched 标记"""
    try:
        with open(SEED_FILE, "r", encoding="utf-8") as f:
            seed = json.load(f)
        return [m["model"] for m in seed.get("models", [])]
    except (OSError, ValueError, KeyError):
        return []


def norm_name(s):
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", (s or "").lower())


def download(bvid, cid, sessdata, workdir):
    """优先带 Cookie 走 DASH 视频流（720P/1080P），失败退回 360P durl"""
    if sessdata:
        headers = dict(HEADERS, Cookie=f"SESSDATA={sessdata}")
        params = {"bvid": bvid, "cid": cid, "qn": 80, "fnval": 16, "fourk": 1}
        try:
            req = urllib.request.Request(
                "https://api.bilibili.com/x/player/playurl?" + urllib.parse.urlencode(params),
                headers=headers,
            )
            data = json.loads(urllib.request.urlopen(req, timeout=20).read())["data"]
            videos = data.get("dash", {}).get("video", [])
            if videos:
                # OCR 用 720P 足够，1080P 只会让下载和单帧识别都变慢
                hd = [v for v in videos if (v.get("height") or 0) <= 800]
                stream = max(hd or videos, key=lambda v: v.get("bandwidth", 0))
                qn, wh = stream.get("id"), (stream.get("width"), stream.get("height"))
                url, ext = stream["baseUrl"], ".m4s"
                print(f"  [download] DASH qn={qn} {wh[0]}x{wh[1]}")
                return _save(url, headers, os.path.join(workdir, "video" + ext)), wh
        except Exception as exc:  # noqa: BLE001
            print(f"  [download] DASH 失败，退回 360P: {exc}")
    params = {"bvid": bvid, "cid": cid, "qn": 16, "type": "MP4", "platform": "html5"}
    data = _get("https://api.bilibili.com/x/player/playurl?" + urllib.parse.urlencode(params))["data"]
    url = data["durl"][0]["url"]
    print("  [download] 360P durl（无 Cookie 上限）")
    return _save(url, HEADERS, os.path.join(workdir, "video.mp4")), None


def _save(url, headers, dest):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    return dest


def extract_frames(ffmpeg, video, workdir, upscale, tag):
    """结尾 TAIL_SECONDS 秒内每 SCAN_INTERVAL 秒一帧。

    tag='scan' 输出原生分辨率（粗扫，快）；tag='hi' 输出放大版（精扫，给选中的帧用）。
    两批帧时间轴一致，可用同一序号对应。
    """
    frame_dir = os.path.join(workdir, f"frames_{tag}")
    shutil.rmtree(frame_dir, ignore_errors=True)
    os.makedirs(frame_dir, exist_ok=True)
    duration = TAIL_SECONDS - SKIP_LAST_SECONDS
    subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error",
         "-sseof", f"-{TAIL_SECONDS}", "-i", video,
         "-t", str(duration),            # 截断到结尾前 SKIP_LAST_SECONDS
         "-vf", f"fps=1/{SCAN_INTERVAL},scale=iw*{upscale}:ih*{upscale}:flags=lanczos",
         "-q:v", "2", os.path.join(frame_dir, "f_%02d.jpg")],
        check=True,
    )
    return sorted(
        os.path.join(frame_dir, n) for n in os.listdir(frame_dir) if n.endswith(".jpg")
    )


def ocr_image(engine, path, invert=False):
    """OCR 一帧；invert 用于暗色 UI 检出差的场景（--invert 开启），默认单遍保速度"""
    import cv2
    import numpy as np

    # 项目路径含中文，cv2.imread 在 Windows 下读不了，用 imdecode 绕开
    img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return []
    if invert:
        img = 255 - img.astype(np.uint8)  # cv5 的 bitwise_not 有兼容问题，用 numpy 取反
    out = []
    rows, _ = engine(img)
    for box, text, conf in rows or []:
        ys = [p[1] for p in box]
        out.append({"text": text, "conf": round(float(conf), 3),
                    "y": round(sum(ys) / len(ys), 1), "x": round(min(p[0] for p in box), 1)})
    return out


def cluster_rows(lines, tol=18):
    """把 OCR 检出的独立文本框按 y 坐标聚成表格行、行内按 x 排序拼接。

    720P 下检测器常把名字格/积分格拆成单独的框，直接按行解析会全碎掉；
    先重建逻辑行再解析，结构化才有意义。tol 是同一行 y 中心的容差（放大后约 1.5 倍行高）。
    """
    rows = []
    for ln in sorted(lines, key=lambda r: (r["y"], r["x"])):
        hit = None
        for row in rows:
            if abs(row["y"] - ln["y"]) <= tol:
                hit = row
                break
        if hit:
            hit["parts"].append(ln)
            hit["y"] = (hit["y"] * (len(hit["parts"]) - 1) + ln["y"]) / len(hit["parts"])
        else:
            rows.append({"y": ln["y"], "parts": [ln]})
    out = []
    for row in rows:
        parts = sorted(row["parts"], key=lambda p: p["x"])
        out.append({"text": " ".join(p["text"] for p in parts).strip(),
                    "y": round(row["y"], 1), "x": parts[0]["x"]})
    return out


def fuzzy_dedupe(rows):
    """模糊去重：同一段板面文字在多帧/多次检出，OCR 每次拼写出入一两个字。

    完全相等去不掉这种变体（"OCI并发工艺" vs "ocI井发工艺"），
    按相似度 + y 带合并，出现次数记入 hits 供置信判断。
    """
    import difflib

    def norm_key(s):
        return re.sub(r"[\s,，.。:：]+", "", s.lower())

    kept = []
    for row in sorted(rows, key=lambda r: (r["y"], r["x"])):
        hit = None
        for k in kept:
            if abs(k["y"] - row["y"]) <= 22:
                ratio = difflib.SequenceMatcher(
                    None, norm_key(k["text"]), norm_key(row["text"])
                ).ratio()
                if ratio >= 0.85:
                    hit = k
                    break
        if hit:
            hit["hits"] = hit.get("hits", 1) + row.get("hits", 1)
            if len(row["text"]) > len(hit["text"]):
                hit["text"] = row["text"]
            hit["y"] = round((hit["y"] + row["y"]) / 2, 1)
        else:
            kept.append(dict(row) | {"hits": row.get("hits", 1)})
    return sorted(kept, key=lambda r: (r["y"], r["x"]))


def split_row(text):
    """一行 OCR 常把左右两列挤成一行（如 "GRI Grok4.7 1-8-8 FB! ClaudeFable5.1 1-0-0"）。

    先按战绩 x-y-z 切开，每个战绩各带自己前面那段名字；
    剩下的长行再按「数字后跟新模型名」的边界切，切不开就整行返回。
    """
    segs = []
    pos = 0
    for m in WDL_RE.finditer(text):
        name = text[pos:m.start()].strip(" .·:：|,，")
        if name:
            segs.append(f"{name} {m.group(1)}-{m.group(2)}-{m.group(3)}")
        pos = m.end()
    tail = text[pos:].strip(" .·:：|,，")
    if tail and not segs:
        return [s.strip() for s in SPLIT_AFTER_NUM.split(text) if s.strip()] or [text]
    if tail and segs:
        segs.append(tail)
    return segs or [text]


def merge_score_rows(rows, gap=70):
    """模型名和成绩常被 OCR 拆成相邻两行（一行只有名字，下一行才有分数）。

    按 y 找到没有分数的行，把紧随其后带分数的行并回来，再交给解析器。
    """
    out = []
    for ln in rows:
        text = ln["text"].strip()
        has_score = bool(
            SCORE_RE.match(text) or INLINE_SCORE_RE.search(text) or WDL_RE.search(text)
        )
        prev = out[-1] if out else None
        if (
            prev is not None
            and not prev["_has_score"]
            and not prev["_joined"]
            and abs(ln["y"] - prev["y"]) <= gap
            and has_score
            and prev["_x"] < ln.get("x", 0) + 400  # 只并同侧/下方，别把右列并到左列
        ):
            prev["text"] = f"{prev['text']} {text}"
            prev["_has_score"] = True
            prev["_joined"] = True
            continue
        out.append({"text": text, "y": ln["y"], "x": ln.get("x", 0),
                    "_has_score": has_score, "_joined": False, "_x": ln.get("x", 0)})
    for r in out:
        r.pop("_has_score", None)
        r.pop("_joined", None)
        r.pop("_x", None)
    return out


def parse_lines(rows):
    """把（已按 y 聚类重建的）逻辑行归入板式；聚不进的进 raw。

    板型先判：结尾帧有两类——评分结算板、分组抽签板。
    抽签板上的 "POT1 81" 是签池档位不是分数，硬套英雄榜会读出一堆假成绩。
    """
    boards = {"hero": [], "versus": [], "group": []}
    rows = merge_score_rows(rows)
    joined = " ".join(r["text"] for r in rows)
    is_draw = len(DRAW_TOKEN_RE.findall(joined)) >= 3

    for ln in sorted(rows, key=lambda r: (r["y"], r["x"])):
        for text in split_row(ln["text"].strip()):
            if not text or text.lower() in ("bilibili",):
                continue
            if NOISE_RE.search(text) or len(text) > 140:
                continue
            if is_draw:
                for m in DRAW_ROW_RE.finditer(text):
                    grp, name, pot = m.groups()
                    name = name.strip(" .·:：|,，")
                    if len(name) >= 2:
                        boards.setdefault("draw", []).append(
                            {"group": grp.upper() if grp else None,
                             "name": name, "pot": int(pot)}
                        )
                if DRAW_TOKEN_RE.search(text) or len(text) >= 3:
                    boards.setdefault("raw", []).append(text)
                continue
            if "VS" in text.upper():
                m = VS_RE.search(text)
                if m:
                    boards["versus"].append(
                        {"a": m.group(1).strip(), "b": m.group(2).strip(),
                         "scoreA": m.group(3), "scoreB": m.group(4)}
                    )
                    continue
            m2 = WDL_RE.search(text)
            if m2:
                name = (text[:m2.start()] + " " + text[m2.end():]).strip(" .·:：|-0123456789 ")
                w, d, l = (int(g) for g in m2.groups())
                if w + d + l <= 40:  # 真战绩不会打这么多场
                    boards["group"].append({"name": name, "w": w, "d": d, "l": l, "raw": text})
                    continue
            m = SCORE_RE.match(text)
            if m and len(m.group(1).strip()) >= 2 and int(m.group(2)) <= 200:
                name = m.group(1).strip(" .·:：|")
                st = STATUS_RE.search(text)
                boards["hero"].append(
                    {"name": name, "score": int(m.group(2)), "status": st.group(1) if st else None}
                )
                continue
            mi = INLINE_SCORE_RE.search(text)
            if mi and int(mi.group(1)) <= 18:
                name = (text[:mi.start()] + " " + text[mi.end():]).strip(" .·:：|，,")
                if len(name) >= 2:
                    st = STATUS_RE.search(text)
                    boards["hero"].append(
                        {"name": name, "score": int(mi.group(1)),
                         "status": st.group(1) if st else None}
                    )
                    continue
            if STATUS_RE.search(text) or len(text) >= 3:
                boards.setdefault("raw", []).append(text)
    if is_draw:
        boards["kind"] = "draw"
    return {k: v for k, v in boards.items() if v}


def boardness(rows):
    """粗扫打分：一帧里长得多像结算板（名字+积分 / 战绩 / 对阵 的行数）"""
    n = 0
    for ln in rows:
        t = ln["text"].strip()
        m = SCORE_RE.match(t)
        if (m and len(m.group(1).strip()) >= 2 and int(m.group(2)) <= 200) \
                or WDL_RE.search(t) or "VS" in t.upper():
            n += 1
    return n


def match_roster(boards, roster):
    """给识别行打 matched 标记（精确/包含双匹配），顺带数命中率供置信参考"""
    roster_norm = {norm_name(n): n for n in roster}
    matched = set()

    def hit_for(raw):
        n = norm_name(raw)
        if not n:
            return None
        return roster_norm.get(n) or next(
            (orig for key, orig in roster_norm.items() if key and (key in n or n in key)), None
        )

    for row in boards.get("hero", []):
        hit = hit_for(row["name"])
        if hit:
            row["matchedModel"] = hit
            matched.add(hit)
    for row in boards.get("group", []):
        hit = hit_for(row["name"])
        if hit:
            row["matchedModel"] = hit
            matched.add(hit)
    for row in boards.get("draw", []):
        hit = hit_for(row["name"])
        if hit:
            row["matchedModel"] = hit
            matched.add(hit)
    for row in boards.get("versus", []):
        for side in ("a", "b"):
            hit = hit_for(row[side])
            if hit:
                matched.add(hit)
    return sorted(matched)


_ENGINE = None


def get_engine():
    """每个进程懒加载一份 OCR 引擎（并行 worker 各自持有）"""
    global _ENGINE
    if _ENGINE is None:
        from rapidocr_onnxruntime import RapidOCR

        _ENGINE = RapidOCR()
    return _ENGINE


def process_bvid(bvid, roster, sessdata, force, invert=False):
    out_file = os.path.join(AUTO_DIR, f"{bvid}.json")
    if os.path.exists(out_file) and not force:
        # 贴了 Cookie 之后清晰度升级，旧的低清识别结果自动作废重跑
        try:
            with open(out_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if sessdata and (cached.get("quality") or "").startswith("640x360"):
                print(f"[extract] {bvid} 已有 360P 结果，Cookie 已生效 -> 用高清重识别")
            else:
                return False
        except (OSError, ValueError):
            return False
    view = _get(f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}")["data"]
    title, cid, duration = view["title"], view["cid"], view["duration"]
    print(f"[extract] {bvid} {title[:28]} ({duration}s)")
    workdir = os.path.join(AUTO_DIR, f"_work_{bvid}")
    shutil.rmtree(workdir, ignore_errors=True)
    os.makedirs(workdir, exist_ok=True)
    try:
        ffmpeg = get_ffmpeg()
        engine = get_engine()
        video, dims = download(bvid, cid, sessdata, workdir)
        upscale = 1.5 if (dims and dims[1] and dims[1] >= 600) else 2
        quality = f"{dims[0]}x{dims[1]}" if dims else "640x360"

        # 第一遍：原生分辨率粗扫整个结尾窗口，定位结算板出现在哪几帧
        scan_frames = extract_frames(ffmpeg, video, workdir, 1.0, "scan")
        print(f"  [scan] 粗扫 {len(scan_frames)} 帧（原生分辨率）", flush=True)
        scores = []
        for i, fp in enumerate(scan_frames, 1):
            rows = cluster_rows(ocr_image(engine, fp, invert))
            scores.append((boardness(rows), i, rows))
            print(f"    扫 {i}/{len(scan_frames)}：板状行 {scores[-1][0]}", flush=True)

        # 第二遍：只对最像结算板的几帧做放大精扫
        picks = sorted(scores, key=lambda t: (-t[0], t[1]))[:BOARD_PICK_TOP]
        hi_frames = extract_frames(ffmpeg, video, workdir, upscale, "hi")
        picked = []
        for board_score, idx, _ in sorted(picks, key=lambda t: t[1]):
            if board_score == 0 and len(picked) >= 1:
                continue  # 全部 0 分时至少保留最早一帧做 raw 展示
            if idx - 1 < len(hi_frames):
                picked.append((idx, hi_frames[idx - 1]))
        print(f"  [scan] 精扫帧：{[i for i, _ in picked]}", flush=True)
        merged = []
        for idx, fp in picked:
            merged.extend(cluster_rows(ocr_image(engine, fp, invert)))
        rows = fuzzy_dedupe(merged)
        print(f"  [ocr] 去重后 {len(rows)} 逻辑行", flush=True)
        boards = parse_lines(rows)
        matched = match_roster(boards, roster)
        result = {
            "bvid": bvid,
            "title": title,
            "extractedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "quality": quality,
            "frames": len(scan_frames),
            "boards": boards,
            "ocrRows": rows,
            "matchedModels": matched,
            "confidence": (
                "high" if len(matched) >= 2 and boards.get("hero")
                else "low" if matched or boards.get("hero") else "none"
            ),
        }
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(
            f"  -> 英雄榜 {len(boards.get('hero', []))} 行 / 对阵 {len(boards.get('versus', []))} 行"
            f" / 命中花名册 {len(matched)} : {', '.join(matched) or '—'}"
        )
        return True
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def reparse(roster):
    """只对缓存里的 ocrRows 重跑解析（不下载不 OCR）。改解析逻辑后用它秒级生效"""
    import glob

    n = 0
    for f in sorted(glob.glob(os.path.join(AUTO_DIR, "BV*.json"))):
        try:
            with open(f, "r", encoding="utf-8") as fh:
                d = json.load(fh)
            rows = d.get("ocrRows") or []
            boards = parse_lines(rows)
            matched = match_roster(boards, roster)
            d["boards"] = boards
            d["matchedModels"] = matched
            d["confidence"] = (
                "high" if len(matched) >= 2 and boards.get("hero")
                else "low" if matched or boards.get("hero") else "none"
            )
            with open(f, "w", encoding="utf-8") as fh:
                json.dump(d, fh, ensure_ascii=False, indent=2)
            n += 1
            kind = boards.get("kind")
            label = "抽签板" if kind == "draw" else "结算板"
            print(f"  [reparse] {d['bvid']} {label} 英雄榜 {len(boards.get('hero', []))}"
                  f" / 对阵 {len(boards.get('versus', []))}"
                  f" / 小组 {len(boards.get('group', []))}"
                  f" / 抽签 {len(boards.get('draw', []))} · 命中 {len(matched)}")
        except (OSError, ValueError) as exc:
            print(f"  [reparse] {f} 跳过: {exc}")
    print(f"[reparse] 已重解析 {n} 个缓存结果")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bvids", nargs="*", help="只处理这些 bvid；缺省=全部待补录")
    ap.add_argument("--force", action="store_true", help="忽略缓存重跑")
    ap.add_argument("--reparse", action="store_true",
                    help="不下载不 OCR，只用新解析逻辑重读缓存的 ocrRows")
    ap.add_argument("--limit", type=int, default=4, help="本次最多处理几个（默认 4）")
    ap.add_argument("--workers", type=int, default=3,
                    help="并行进程数（默认 3；OCR 吃 CPU，再多了互相拖慢）")
    ap.add_argument("--invert", action="store_true",
                    help="OCR 前先反色（暗色结算板用 --invert 往往检出更好，但需另跑一遍）")
    args = ap.parse_args()

    roster = roster_names()

    if args.reparse:
        return reparse(roster)

    bvids = args.bvids or pending_bvids()
    if not bvids:
        print("[extract] 没有待补录视频，无事可做")
        return 0
    todo = [b for b in bvids if args.force or not os.path.exists(os.path.join(AUTO_DIR, f"{b}.json"))]
    skipped = len(bvids) - len(todo)
    if not todo:
        print(f"[extract] {len(bvids)} 个待补录全部已有识别结果（--force 重跑）")
        return 0
    todo = todo[-args.limit:] if args.limit else todo

    sessdata = load_sessdata()
    print(f"[extract] 待处理 {len(todo)} 个（已缓存跳过 {skipped}）· {args.workers} 进程并行 · 清晰度模式："
          f"{'带 Cookie' if sessdata else '无 Cookie（360P，识别质量受限）'}", flush=True)
    os.makedirs(AUTO_DIR, exist_ok=True)
    get_ffmpeg()  # 提前触发 imageio_ffmpeg 导入与解包，worker 里就不用各自等

    from concurrent.futures import ProcessPoolExecutor, as_completed

    jobs = [(b, roster, sessdata, args.force, args.invert) for b in todo]
    done = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_bvid, *job): job[0] for job in jobs}
        for fut in as_completed(futures):
            bvid = futures[fut]
            try:
                if fut.result():
                    done += 1
            except Exception as exc:  # noqa: BLE001
                print(f"  [extract] {bvid} 失败: {exc}", flush=True)
    print(f"[extract] 完成 {done}/{len(todo)}，结果在 {AUTO_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
