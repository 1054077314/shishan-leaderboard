# -*- coding: utf-8 -*-
"""从 B站 评论区抓每期视频的实测成绩。

视频结尾板 OCR 噪声大：0/8 认混、名字和分数跨行、板子还分好几种版式。
评论区里 UP 主和观众直接把比分写成文本，抓文本比读像素可靠得多。

产出 scripts/.cache/commentScores/{bvid}.json，字段与 extractEndingScores.py
对齐（boards / matchedModels / confidence），rebuildRanking 会优先采信。

  python scripts/scrapeComments.py                 # 只跑待补录
  python scripts/scrapeComments.py BV1zXj263E6X    # 指定 bvid
  python scripts/scrapeComments.py --all           # 连已录的一起跑
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE_DIR = os.path.join(HERE, ".cache")
OUT_DIR = os.path.join(CACHE_DIR, "commentScores")
SEED_FILE = os.path.join(ROOT, "src", "data", "killLineSeed.json")
RANKING_FILE = os.path.join(ROOT, "public", "rankingData.json")
AUTH_FILE = os.path.join(HERE, ".bilibili_auth")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Origin": "https://www.bilibili.com",
    "Referer": "https://www.bilibili.com/",
}

# 指纹 cookie：B站对裸请求回 412，带上 buvid3 就放行（无需登录）
_COOKIE = {}

# 比分写法：3:4 / 3 ： 4 / 3-4 / 3比4 / 3 4
SCORE_PAIR_RE = re.compile(
    r"(\d{1,2})\s*[:：比\-–—]\s*(\d{1,2})|(?<![\d.])(\d{1,2})\s+(\d{1,2})(?![\d.])"
)
INLINE_SCORE_RE = re.compile(r"(\d{1,2})\s*分")
WIN_VERBS = ("战胜", "赢了", "击败", "拿下", "险胜", "力压", "胜", "晋级", "淘汰", "出局")
ROUND_RE = re.compile(r"(\d{1,2})\s*[轮回合场]")


def norm_name(s):
    return re.sub(r"[^a-z0-9一-鿿]", "", (s or "").lower())


# 评论区叫法 → 花名册标准名。"千问3.8max" 不加这张表永远匹配不上 "Qwen 3.8 Max"
ALIASES = {
    "千问": "Qwen", "通义": "Qwen", "qoder": "Qwen",
    "豆包": "Doubao", "混元": "Hunyuan", "智谱": "GLM", "月之暗面": "Kimi",
    "阶跃": "Step", "龙猫": "LongCat", "闪灵": "Gemini",
    "fable": "Claude Fable", "opus": "Opus", "haiku": "Claude", "sonnet": "Claude",
    "gemini": "Gemini", "grok": "Grok", "gpt": "GPT", "sol": "GPT",
}


def canon(s):
    """把评论里的中文叫法、缩写归一到花名册口径"""
    out = s
    for k, v in ALIASES.items():
        out = re.sub(re.escape(k), v, out, flags=re.I)
    return out


def load_sessdata():
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


def init_session():
    """拿 buvid3 指纹 + 登录态。B站对裸请求回 412；匿名评论只放 3 条热评，
    带 SESSDATA 才能翻完（一晚上 301 条里挑比分全靠它）。
    """
    try:
        data = _get("https://api.bilibili.com/x/frontend/finger/spi").get("data") or {}
        for api_key, cookie_name in (("b_3", "buvid3"), ("b_4", "buvid4")):
            if data.get(api_key):
                _COOKIE[cookie_name] = data[api_key]
    except Exception as exc:  # noqa: BLE001
        print(f"  [comment] 取指纹失败: {exc}")

    sess = load_sessdata()
    if not sess:
        print("  [comment] 无 SESSDATA：匿名只能看 3 条热评，跑 scripts/bilibiliLogin.py 扫码")
        return
    _COOKIE["SESSDATA"] = sess
    try:
        nav = _get("https://api.bilibili.com/x/web-interface/nav")
        uname = (nav.get("data") or {}).get("uname") if nav.get("code") == 0 else None
        print(f"  [comment] 登录：{uname or 'cookie 已失效，跑 scripts/bilibiliLogin.py 重扫'}")
    except Exception:  # noqa: BLE001
        pass


def _get(url, params=None, referer="https://www.bilibili.com/"):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    cookie = "; ".join(f"{k}={v}" for k, v in _COOKIE.items())
    headers = dict(HEADERS, Referer=referer)
    if cookie:
        headers["Cookie"] = cookie
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            return json.loads(urllib.request.urlopen(req, timeout=20).read())
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (412, 429, 403) and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    raise last


def roster_names():
    try:
        with open(SEED_FILE, "r", encoding="utf-8") as f:
            return [m["model"] for m in json.load(f).get("models", [])]
    except (OSError, ValueError, KeyError):
        return []


def pending_bvids():
    try:
        with open(RANKING_FILE, "r", encoding="utf-8") as f:
            return [e["bvid"] for e in json.load(f).get("pendingEpisodes", [])]
    except (OSError, ValueError, KeyError):
        return []


def video_meta(bvid):
    """顺带把标题、简介、动态捞回来——UP主常在简介里写结论"""
    data = _get(
        "https://api.bilibili.com/x/web-interface/view",
        params={"bvid": bvid},
    )["data"]
    return {
        "aid": data["aid"],
        "bvid": bvid,
        "title": data.get("title", ""),
        "desc": data.get("desc", ""),
        "dynamic": data.get("dynamic", ""),
        "mid": (data.get("owner") or {}).get("mid"),
        "pubdate": data.get("pubdate"),
    }


def fetch_comments(aid, bvid=None, mid=None, pages=10, ps=20):
    """拉全量评论 + 楼中楼。sort=1 按点赞排，比分常写在 UP 主补充回复里。"""
    out, seen = [], set()
    referer = f"https://www.bilibili.com/video/{bvid}/" if bvid else "https://www.bilibili.com/"

    def add(r, is_sub=False):
        if not r or r["rpid"] in seen:
            return
        seen.add(r["rpid"])
        member = r.get("member") or {}
        content = (r.get("content") or {}).get("message", "") or ""
        if not content.strip():
            return
        out.append({
            "user": member.get("uname", ""),
            "mid": member.get("mid"),
            "isUp": bool(mid and member.get("mid") == mid),
            "like": r.get("like", 0),
            "text": content.strip(),
            "sub": is_sub,
        })

    for pn in range(1, pages + 1):
        try:
            data = _get(
                "https://api.bilibili.com/x/v2/reply",
                params={"type": 1, "oid": aid, "sort": 1, "pn": pn, "ps": ps},
                referer=referer,
            ).get("data") or {}
        except Exception as exc:  # noqa: BLE001
            print(f"    [comment] 第{pn}页失败: {exc}")
            break
        replies = data.get("replies") or []
        if pn == 1:
            replies = list(data.get("top_replies") or []) + replies
        for r in replies:
            add(r)
            for s in (r.get("replies") or [])[:3]:
                add(s, is_sub=True)
        if not replies:
            break
        time.sleep(0.25)
    return out


def find_models(text, roster):
    """在一段文字里定位花名册模型名，返回 (norm名, 原名, 起点, 终点)。

    先把中文叫法归一（千问→Qwen），再比对；两边都走 norm_name 兜住空格/连字符差异。
    """
    text = canon(text)
    hits = []
    for name in roster:
        key = norm_name(name)
        if not key:
            continue
        for m in re.finditer(re.escape(name), text, re.I):
            hits.append((key, name, m.start(), m.end()))
        # 归一化兜底：原文写成 "Qwen3.8max" 也能对上
        nt = norm_name(text)
        for m in re.finditer(re.escape(key), nt):
            hits.append((key, name, -1, -1))
    hits.sort(key=lambda h: -(h[3] - h[2]))
    kept = []
    for h in hits:
        if h[2] < 0:
            if any(k[0] == h[0] for k in kept):
                continue
            kept.append(h)
            continue
        if any(not (h[3] <= k[2] or h[2] >= k[3]) and k[2] >= 0 for k in kept):
            continue
        kept.append(h)
    return [h for h in kept if h[2] >= 0] or kept


def parse_text(text, roster, roster_norm):
    """一段文字里抽出对阵比分 / 单人分数，返回 (versus, hero)"""
    versus, hero = [], []

    # 对阵：A 3:4 B。先找比分，再取两侧最近的模型名
    for m in SCORE_PAIR_RE.finditer(text):
        a_s, b_s = m.group(1), m.group(2)
        if a_s is None:
            a_s, b_s = m.group(3), m.group(4)
        if a_s is None:
            continue
        sa, sb = int(a_s), int(b_s)
        if sa == sb and sa == 0:
            continue
        left = text[max(0, m.start() - 24):m.start()]
        right = text[m.end():m.end() + 24]
        la = find_models(left, roster)
        lb = find_models(right, roster)
        # 两边同一模型是自匹配假阳性，丢掉
        if la and lb and la[0][0] != lb[0][0]:
            versus.append({
                "a": la[0][1], "b": lb[0][1],
                "scoreA": str(sa), "scoreB": str(sb),
                "raw": text.strip()[:120],
            })
            continue
        # 只有一侧有名字：可能是 "GPT-5.5 3:4" 或 "3:4 拿下"
        side = la or lb
        if side:
            name = side[0][1]
            score = sa if la else sb
            if score <= 18:
                hero.append({"name": name, "score": score,
                             "status": "胜" if (sa > sb) == bool(la) else "负"})

    # 单人分数："XX 5分" / "XX 拿下 8 分"
    for name in roster:
        key = norm_name(name)
        for m in re.finditer(re.escape(name), text, re.I):
            window = text[m.end():m.end() + 26]
            mi = INLINE_SCORE_RE.search(window)
            if mi and int(mi.group(1)) <= 18:
                hero.append({"name": name, "score": int(mi.group(1)), "status": None})

    # 胜负："A 战胜 B"
    for verb in WIN_VERBS:
        for m in re.finditer(re.escape(verb), text):
            left = text[max(0, m.start() - 24):m.start()]
            right = text[m.end():m.end() + 24]
            la, lb = find_models(left, roster), find_models(right, roster)
            if la and lb and la[0][0] != lb[0][0]:
                versus.append({
                    "a": la[0][1], "b": lb[0][1], "scoreA": None, "scoreB": None,
                    "raw": text.strip()[:120],
                })
    return versus, hero


def process(meta, roster):
    roster_norm = {norm_name(n): n for n in roster}
    comments = fetch_comments(meta["aid"], meta["bvid"], meta["mid"])
    corpus = [(c["text"], c["isUp"], c["like"]) for c in comments]
    corpus.append((meta.get("desc", ""), True, 999))
    corpus.append((meta.get("dynamic", ""), True, 999))

    versus, hero, raw = [], [], []
    for text, _is_up, _like in corpus:
        if not text.strip():
            continue
        v, h = parse_text(text, roster, roster_norm)
        versus += v
        hero += h
        if not v and not h and len(text) >= 6:
            raw.append(text.strip()[:160])

    # 去重：同名对比分只留赞数最高/最早的那条
    def dedupe(items, keyfn):
        seen, out = set(), []
        for it in items:
            k = keyfn(it)
            if k in seen:
                continue
            seen.add(k)
            out.append(it)
        return out

    versus = dedupe(versus, lambda v: (v["a"], v["b"]))
    hero = dedupe(hero, lambda h: h["name"])
    for v in versus:
        for side, key in (("a", "matchedA"), ("b", "matchedB")):
            hit = roster_norm.get(norm_name(v[side]))
            if hit:
                v[key] = hit

    for h in hero:
        hit = roster_norm.get(norm_name(h["name"]))
        if hit:
            h["matchedModel"] = hit

    matched = sorted({
        roster_norm[norm_name(x)]
        for v in versus for x in (v["a"], v["b"]) if norm_name(x) in roster_norm
    } | {
        roster_norm[norm_name(h["name"])]
        for h in hero if norm_name(h["name"]) in roster_norm
    })
    conf = "high" if (versus or len(hero) >= 2) else "low" if (versus or hero) else "none"
    return {
        "bvid": meta["bvid"],
        "title": meta["title"],
        "source": "comment",
        "extractedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "quality": f"评论区 {len(comments)} 条",
        "confidence": conf,
        "boards": {"versus": versus, "hero": hero, "raw": raw[:40]},
        "matchedModels": matched,
        "topComments": [c["text"] for c in comments if c["isUp"] or c["like"] >= 5][:8],
    }


def main():
    ap = argparse.ArgumentParser(description="从 B站 评论区抓实测成绩")
    ap.add_argument("bvids", nargs="*", help="要抓的 bvid，默认待补录")
    ap.add_argument("--all", action="store_true", help="连已录的一起跑")
    args = ap.parse_args()

    bvids = args.bvids or pending_bvids()
    if not bvids:
        print("[comment] 没有待补录视频")
        return 0
    roster = roster_names()
    if not roster:
        print("[comment] 花名册为空，无法匹配模型名")
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    init_session()
    ok = 0
    for bvid in bvids:
        try:
            meta = video_meta(bvid)
            res = process(meta, roster)
        except Exception as exc:  # noqa: BLE001
            print(f"  [comment] {bvid} 失败: {exc}")
            continue
        with open(os.path.join(OUT_DIR, f"{bvid}.json"), "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
        b = res["boards"]
        print(f"  [comment] {bvid} 对阵 {len(b['versus'])} / 单人 {len(b['hero'])}"
              f" · 命中 {res['matchedModels']}")
        for v in b["versus"]:
            print(f"      {v['a']} {v.get('scoreA')}-{v.get('scoreB')} {v['b']}")
        ok += 1
    print(f"[comment] 完成 {ok}/{len(bvids)}，结果在 {OUT_DIR}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
