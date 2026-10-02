#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
第二信源：UP主（Token就是词元）视频评论区采集，用于对 toy 英雄榜做双重核实。

为什么不复用 fetch_comments.py 的老路：
  1. 老脚本的 /x/v2/reply 裸调现在稳定 412，必须用 wbi 签名版 /x/v2/reply/wbi/main；
  2. 视频清单不再写死 12 期 —— 每期都从合集接口现取（老做法漏掉了
     "Opus5.5对战GPT6 Sol"、"六家Flash模型大乱斗03" 两期新视频）。

评论接口要 wbi 签名 + cookie 预热（否则 412）。
签名常量和旧 sync_bilibili.py 一致（B站公开的混淆表）。

登录态（可选，强烈建议）：B站对匿名请求只返回 3 条热评 + 置顶，
拿不到分页。提供 SESSDATA 后即可正常翻页：
  - 环境变量 BILIBILI_SESSDATA，或
  - scripts/.bilibili_auth 里的 SESSDATA=... 行（已 gitignore，
    用 scripts/bilibiliLogin.py 扫码生成）
匿名态也能跑，但每期只有置顶 + 3 条热评 + 其楼层回复，信号很薄。

产出 scripts/.cache/comments.json，由 rebuildRanking.mjs 经
scripts/lib/commentVerify.mjs 与 toy.json 交叉核实。

只采对核实有用的信号，不全量爬评论：
  - UP主置顶（top.upper）          —— 官方声明/勘误，最高信任
  - UP主本人评论（顶层 + 楼层回复） —— 官方口径补充
  - UP主点赞/回复（up_action）      —— UP主背书的第三方数据
  - 热评前 N 页                     —— 社区结构化数据（用时表/战绩统计）
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

# 有登录态时每期抓的热评页数（每页 ~20 条）。再往后的长尾对核实贡献很小。
HOT_PAGES_AUTH = 10
# 匿名态只拿得到 1 页（B站限制），多写也没意义
HOT_PAGES_ANON = 1
# 楼层回复展开条数上限：只看每条热评的前几条回复里有没有 UP主本人
SUB_REPLY_LIMIT = 8

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
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "scripts", ".cache")
CACHE_FILE = os.path.join(CACHE_DIR, "comments.json")

_COOKIE_JAR = http.cookiejar.CookieJar()
_OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_COOKIE_JAR))

AUTH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bilibili_auth")


def load_sessdata():
    """SESSDATA 读取顺序：环境变量 -> scripts/.bilibili_auth。找不到返回 None（匿名态）。"""
    env = os.environ.get("BILIBILI_SESSDATA", "").strip()
    if env:
        return env
    if os.path.exists(AUTH_FILE):
        with open(AUTH_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("SESSDATA="):
                    return line.split("=", 1)[1].strip()
    return None


def install_cookie(sessdata):
    """把 SESSDATA 放进 cookie jar，后续接口走登录态。"""
    import http.cookiejar as cj
    ck = cj.Cookie(
        version=0, name="SESSDATA", value=sessdata, port=None, port_specified=False,
        domain=".bilibili.com", domain_specified=True, domain_initial_dot=True,
        path="/", path_specified=True, secure=False, expires=None, discard=True,
        comment=None, comment_url=None, rest={}, rfc2109=False,
    )
    _COOKIE_JAR.set_cookie(ck)


def _open(url, referer="https://www.bilibili.com/", retries=3):
    """412/429 风控退避重试；最后一次失败原样抛出。"""
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


def get_mixin_key():
    data = _open("https://api.bilibili.com/x/web-interface/nav")
    wbi = data["data"]["wbi_img"]
    raw = (
        wbi["img_url"].rsplit("/", 1)[1].split(".")[0]
        + wbi["sub_url"].rsplit("/", 1)[1].split(".")[0]
    )
    return "".join(raw[i] for i in MIXIN_KEY_TAB)[:32]


def wbi_sign(params, mixin_key):
    clean = {k: "".join(c for c in str(v) if c not in "!'()*") for k, v in params.items()}
    clean["wts"] = int(time.time())
    query = urllib.parse.urlencode(sorted(clean.items()))
    clean["w_rid"] = hashlib.md5((query + mixin_key).encode()).hexdigest()
    return clean


def fetch_season():
    api = (
        "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list"
        "?mid={mid}&season_id={sid}&sort_reverse=false&page_num=1&page_size=50"
    ).format(mid=MID, sid=SEASON_ID)
    data = _open(api, referer="https://space.bilibili.com/%s" % MID)
    if data.get("code") != 0:
        raise RuntimeError("合集接口错误: code=%s %s" % (data.get("code"), data.get("message")))
    out = []
    for idx, item in enumerate((data.get("data") or {}).get("archives") or [], start=1):
        out.append(
            {
                "ep": idx,
                "aid": item.get("aid"),
                "bvid": item.get("bvid", ""),
                "title": item.get("title", ""),
                "pubdate": item.get("pubdate"),
            }
        )
    return out


def shrink_comment(c):
    """只留核实需要的字段，原样保留全文 message（提取规则在 commentVerify 做）。"""
    member = c.get("member") or {}
    up_action = c.get("up_action") or {}
    return {
        "rpid": str(c.get("rpid_str") or c.get("rpid") or ""),
        "mid": str(c.get("mid_str") or c.get("mid") or ""),
        "uname": member.get("uname", ""),
        "isUp": member.get("mid") == MID or str(c.get("mid_str") or "") == MID,
        "upLiked": bool(up_action.get("like")),
        "upReplied": bool(up_action.get("reply")),
        "like": c.get("like") or 0,
        "rcount": c.get("rcount") or 0,
        "ctime": c.get("ctime") or 0,
        "message": (c.get("content") or {}).get("message", ""),
    }


def fetch_video_comments(video, mixin_key, pages):
    """游标分页抓热评；置顶单独从 data.top.upper 拿。"""
    aid = video["aid"]
    bvid = video["bvid"]
    referer = "https://www.bilibili.com/video/%s" % bvid

    pinned = None
    up_comments = []
    endorsed = []
    hot = []
    total_count = None

    offset = ""
    for _page in range(pages):
        params = {
            "oid": aid,
            "type": 1,
            "mode": 3,
            "ps": 20,
            "pagination_str": json.dumps({"offset": offset}, separators=(",", ":")),
            "plat": 1,
            "seek_rpid": "",
            "web_location": 1315875,
        }
        url = "https://api.bilibili.com/x/v2/reply/wbi/main?" + urllib.parse.urlencode(
            wbi_sign(params, mixin_key)
        )
        data = _open(url, referer=referer)
        if data.get("code") != 0:
            raise RuntimeError("评论接口 code=%s %s" % (data.get("code"), data.get("message")))
        body = data.get("data") or {}
        cursor = body.get("cursor") or {}
        if total_count is None:
            total_count = cursor.get("all_count")

        if pinned is None:
            top_upper = ((body.get("top") or {}).get("upper")) or None
            if top_upper:
                pinned = shrink_comment(top_upper)
                pinned["isTop"] = True

        for c in body.get("replies") or []:
            sc = shrink_comment(c)
            if sc["isUp"]:
                up_comments.append(sc)
            if sc["upLiked"] or sc["upReplied"]:
                endorsed.append(sc)
            hot.append(sc)
            for sub in (c.get("replies") or [])[:SUB_REPLY_LIMIT]:
                ss = shrink_comment(sub)
                ss["inReplyTo"] = sc["rpid"]
                if ss["isUp"]:
                    up_comments.append(ss)
                if ss["upLiked"] or ss["upReplied"]:
                    endorsed.append(ss)

        next_offset = ((cursor.get("pagination_reply") or {}).get("next_offset")) or ""
        if cursor.get("is_end") or not next_offset or next_offset == offset:
            break
        offset = next_offset
        time.sleep(2)

    # 去重：置顶/UP主/点赞可能同时落在 hot 里
    seen = set()
    for bucket in (pinned and [pinned] or []) + up_comments + endorsed + hot:
        seen.add(bucket["rpid"])
    return {
        "totalCount": total_count,
        "pinned": pinned,
        "upComments": up_comments,
        "endorsed": endorsed,
        "hot": hot,
    }


def main():
    try:
        req = urllib.request.Request("https://www.bilibili.com/", headers=HEADERS)
        _OPENER.open(req, timeout=20).read()
        time.sleep(0.8)
    except Exception:  # noqa: BLE001
        pass

    sessdata = load_sessdata()
    authenticated = False
    if sessdata:
        install_cookie(sessdata)
        authenticated = True
    pages = HOT_PAGES_AUTH if authenticated else HOT_PAGES_ANON
    print(
        "[sync_comments] %s态：每期 %d 页%s"
        % (
            "登录" if authenticated else "匿名",
            pages,
            "" if authenticated else "（B站匿名只给 3 条热评，登录后可翻页）",
        )
    )

    mixin_key = get_mixin_key()
    videos = fetch_season()
    print("[sync_comments] 合集 %d 期" % len(videos))

    out_videos = []
    for v in videos:
        try:
            block = fetch_video_comments(v, mixin_key, pages)
        except Exception as exc:  # noqa: BLE001
            print("  [warn] ep%d %s 评论采集失败: %s" % (v["ep"], v["bvid"], exc))
            block = {"totalCount": None, "pinned": None, "upComments": [], "endorsed": [], "hot": [], "error": str(exc)}
        out_videos.append({**v, **block})
        print(
            "  ep%-2d %s 评论 %s 条（UP主 %d / 点赞 %d / 热评 %d）"
            % (
                v["ep"],
                v["bvid"],
                block["totalCount"] if block["totalCount"] is not None else "?",
                len(block["upComments"]),
                len(block["endorsed"]),
                len(block["hot"]),
            )
        )
        time.sleep(2)

    payload = {
        "source": "bilibili-comments",
        "up": {"mid": MID, "uname": UP_NAME},
        "seasonId": SEASON_ID,
        "authenticated": authenticated,
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%S+08:00", time.localtime()),
        "videos": out_videos,
    }
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print("[sync_comments] -> %s" % CACHE_FILE)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print("[sync_comments] 失败: %s" % exc, file=sys.stderr)
        sys.exit(1)
