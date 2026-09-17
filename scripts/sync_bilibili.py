#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
采集 UP主（Token就是词元）的最新视频，做变化检测。

为什么不能只看合集：
  UP主有大量视频不属于"屎山论剑"合集（例如 07-11 的《屎山论剑｜美区选拔赛》，
  以及 09-17 的《屎山留给DeepSeek的时间不多了｜B组第二轮》——标题里
  根本没有"屎山论剑"四个字）。所以只查合集 sid 会漏掉真正的更新。

这里用两个信源取并集：
  1) 合集 seasons_archives_list           —— 正片，权威、无需签名
  2) 搜索接口 search_type=video + 关键词   —— 兜底，补充未进合集的视频
     （按 UP主昵称过滤 author；空间投稿列表接口已被风控 412，不依赖它）

产出： scripts/.cache/bilibili_season.json
      episodes = 合集正片（带期号）
      extras   = 命中搜索但不在合集里的视频

后续： node scripts/rebuildRanking.mjs 重建 public/rankingData.json，
       dataVersion 变化 -> 前端自动重排，并提示待补录的新视频。
"""
import hashlib
import http.cookiejar
import json
import os
import sys
import time
import urllib.parse
import urllib.request

MID = "3546747185924773"
UP_NAME = "Token就是词元"
SEASON_ID = "8474061"

# 搜索兜底的关键词池。UP主标题风格多变，这里宁可宽一点，命中后靠 author 过滤。
SEARCH_KEYWORDS = [
    "屎山",
    "屎山论剑",
    "祖传代码",
    "祖传BUG",
    "模型斩杀线",
    "决战屎山之巅",
]

SEARCH_REFERER = "https://search.bilibili.com/"

# wbi 签名用的常量表（B站公开的混淆顺序）
MIXIN_KEY_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
    20, 34, 44, 52,
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "scripts", ".cache")
CACHE_FILE = os.path.join(CACHE_DIR, "bilibili_season.json")

# 缓存里保留多久以前的老记录（秒）。超过就丢弃，避免删稿/改稿后一直留着
EXTRA_TTL_SECONDS = 180 * 24 * 3600


# 带 cookie 的会话：B站依赖 buvid3 等 cookie 判断请求是否像浏览器
_COOKIE_JAR = http.cookiejar.CookieJar()
_OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_COOKIE_JAR))


def _get(url, referer="https://www.bilibili.com/", retries=3):
    """
    带退避重试的请求。
    B站对连续请求会偶发 412/429 风控，不做重试的话一次限流就会漏掉新视频。
    """
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=dict(HEADERS, Referer=referer))
            with _OPENER.open(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (412, 429, 403) and attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            raise
    raise last


def fetch_season():
    api = (
        "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list"
        "?mid={mid}&season_id={sid}&sort_reverse=false&page_num=1&page_size=50"
    ).format(mid=MID, sid=SEASON_ID)
    data = _get(api, referer="https://space.bilibili.com/%s" % MID)
    if data.get("code") != 0:
        raise RuntimeError("合集接口错误: code=%s %s" % (data.get("code"), data.get("message")))
    out = []
    for idx, item in enumerate((data.get("data") or {}).get("archives") or [], start=1):
        out.append(
            {
                "ep": idx,
                "bvid": item.get("bvid", ""),
                "title": item.get("title", ""),
                "pubdate": item.get("pubdate"),
                "source": "season",
            }
        )
    return out


def fetch_search(keywords):
    """
    搜索兜底：抓标题含关键词、且作者是本 UP主的视频。
    老接口被风控(412)时自动切 wbi 签名版，两条通道都试过才算失败。
    """
    found = {}
    mixin_key = None
    for kw in keywords:
        payload = None
        try:
            url = (
                "https://api.bilibili.com/x/web-interface/search/type"
                "?search_type=video&order=pubdate&page=1&page_size=30&keyword={kw}"
            ).format(kw=urllib.parse.quote(kw))
            payload = _get(url, referer=SEARCH_REFERER)
        except Exception as exc:  # noqa: BLE001
            print("  [warn] 关键词[%s] 老搜索接口失败: %s，尝试 wbi 通道" % (kw, exc))
            try:
                if mixin_key is None:
                    mixin_key = get_mixin_key()
                url = "https://api.bilibili.com/x/web-interface/wbi/search/type?" + urllib.parse.urlencode(
                    _wbi_sign(
                        {
                            "search_type": "video",
                            "keyword": kw,
                            "order": "pubdate",
                            "page": 1,
                            "page_size": 30,
                        },
                        mixin_key,
                    )
                )
                payload = _get(url, referer=SEARCH_REFERER)
            except Exception as exc2:  # noqa: BLE001
                print("  [warn] 关键词[%s] wbi 通道也失败: %s" % (kw, exc2))

        if payload is None:
            continue
        if payload.get("code") != 0:
            print("  [warn] 关键词[%s] 返回 code=%s" % (kw, payload.get("code")))
            continue

        import html as _html
        import re as _re

        for row in (payload.get("data") or {}).get("result") or []:
            if row.get("author") != UP_NAME:
                continue
            bvid = row.get("bvid")
            if not bvid:
                continue
            found[bvid] = {
                "bvid": bvid,
                "title": _html.unescape(_re.sub("<[^>]+>", "", row.get("title", ""))),
                "pubdate": row.get("pubdate"),
                "source": "search:%s" % kw,
            }
        time.sleep(2.5)
    return sorted(found.values(), key=lambda x: x.get("pubdate") or 0)


def get_mixin_key():
    """取 nav 里的 img/sub key，按 MIXIN_KEY_TAB 重排得到 32 位 mixin_key"""
    data = _get("https://api.bilibili.com/x/web-interface/nav")
    wbi = data["data"]["wbi_img"]
    raw = (
        wbi["img_url"].rsplit("/", 1)[1].split(".")[0]
        + wbi["sub_url"].rsplit("/", 1)[1].split(".")[0]
    )
    return "".join(raw[i] for i in MIXIN_KEY_TAB)[:32]


def _wbi_sign(params, mixin_key):
    clean = {k: "".join(c for c in str(v) if c not in "!'()*") for k, v in params.items()}
    clean["wts"] = int(time.time())
    query = urllib.parse.urlencode(sorted(clean.items()))
    clean["w_rid"] = hashlib.md5((query + mixin_key).encode()).hexdigest()
    return clean


def load_cache():
    if not os.path.exists(CACHE_FILE):
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return None


def fmt(ts):
    if not ts:
        return "—"
    return time.strftime("%Y-%m-%d %H:%M", time.localtime(ts))


def main():
    # 预热会话，拿 buvid3 等 cookie，能显著降低后续接口的 412 概率
    try:
        _get("https://www.bilibili.com/")
        time.sleep(0.8)
    except Exception:  # noqa: BLE001
        pass

    episodes = fetch_season()
    found_all = fetch_search(SEARCH_KEYWORDS)
    season_bvids = {e["bvid"] for e in episodes}

    # 与上次缓存合并：某次搜索被风控限流时，之前已经发现过的视频不会凭空消失
    previous = load_cache()
    merged_extras = {}
    now_ts = int(time.time())
    for old in (previous or {}).get("extras", []):
        pub = old.get("pubdate") or 0
        if pub and now_ts - pub > EXTRA_TTL_SECONDS:
            continue
        if old["bvid"] not in season_bvids:
            merged_extras[old["bvid"]] = old
    for cur in found_all:
        if cur["bvid"] not in season_bvids:
            merged_extras[cur["bvid"]] = cur
    extras = sorted(merged_extras.values(), key=lambda x: x.get("pubdate") or 0)

    prev_all = {}
    for e in (previous or {}).get("episodes", []):
        prev_all[e["bvid"]] = e
    for e in (previous or {}).get("extras", []):
        prev_all[e["bvid"]] = e

    current_all = {e["bvid"]: e for e in episodes}
    current_all.update({e["bvid"]: e for e in extras})

    added = [v for b, v in current_all.items() if b not in prev_all]
    added.sort(key=lambda x: x.get("pubdate") or 0)

    os.makedirs(CACHE_DIR, exist_ok=True)
    payload = {
        "mid": MID,
        "upName": UP_NAME,
        "seasonId": SEASON_ID,
        "fetchedAt": int(time.time()),
        "episodes": episodes,
        "extras": extras,
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("[sync_bilibili] 合集 %d 期 + 站外命中 %d 条 -> %s" % (len(episodes), len(extras), CACHE_FILE))
    if extras:
        print("  未进合集的视频：")
        for e in extras:
            print("    %s  %s  %s" % (fmt(e.get("pubdate")), e["bvid"], e["title"]))
    if previous is None:
        print("  首次采集，已建立基线")
    elif added:
        print("  本次新增 %d 条（需人工补录实测结果）：" % len(added))
        for e in added:
            print("    %s  %s  %s" % (fmt(e.get("pubdate")), e["bvid"], e["title"]))
    else:
        print("  与上次一致，无需重排")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print("[sync_bilibili] 失败: %s" % exc, file=sys.stderr)
        sys.exit(1)
