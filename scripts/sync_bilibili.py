#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
采集 B站 UP主《屎山论剑》合集的最新视频列表，做变化检测。

职责边界（重要）：
  本脚本只负责"发现 UP主更新了什么"——拿到最新一期的 bvid / 标题 / 发布时间，
  并与上一次的缓存做 diff。它**不**负责判定模型成绩（视频内容是非结构化的，
  哪款模型几轮过无法从接口里抓出来），那部分需要人工补录到
  src/data/killLineSeed.json 的 rounds 字段里。

产出： scripts/.cache/bilibili_season.json
      同时打印出新增/变化的期数清单，供人工补录。

后续： 再跑 `node scripts/rebuildRanking.mjs` 重建 public/rankingData.json，
       dataVersion 会随之变化，前端下次轮询即自动重排。
"""
import json
import os
import sys
import time
import urllib.request

MID = "3546747185924773"
SEASON_ID = "8474061"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com",
    "Accept": "application/json, text/plain, */*",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "scripts", ".cache")
CACHE_FILE = os.path.join(CACHE_DIR, "bilibili_season.json")

API = (
    "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list"
    "?mid={mid}&season_id={sid}&sort_reverse=false&page_num=1&page_size=50"
).format(mid=MID, sid=SEASON_ID)


def fetch_season():
    req = urllib.request.Request(API, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    if data.get("code") != 0:
        raise RuntimeError("B站接口返回错误: code=%s message=%s" % (data.get("code"), data.get("message")))
    archives = (data.get("data") or {}).get("archives") or []
    episodes = []
    for idx, item in enumerate(archives, start=1):
        episodes.append(
            {
                "ep": idx,
                "bvid": item.get("bvid", ""),
                "title": item.get("title", ""),
                "pubdate": item.get("pubdate"),
            }
        )
    return episodes


def load_cache():
    if not os.path.exists(CACHE_FILE):
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return None


def main():
    episodes = fetch_season()
    previous = load_cache()
    prev_map = {e["bvid"]: e for e in (previous or {}).get("episodes", [])}

    added = [e for e in episodes if e["bvid"] not in prev_map]
    changed = [
        e
        for e in episodes
        if e["bvid"] in prev_map and prev_map[e["bvid"]].get("title") != e["title"]
    ]

    os.makedirs(CACHE_DIR, exist_ok=True)
    payload = {
        "mid": MID,
        "seasonId": SEASON_ID,
        "fetchedAt": int(time.time()),
        "episodes": episodes,
    }
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("[sync_bilibili] 合集共 %d 期 -> %s" % (len(episodes), CACHE_FILE))
    if not previous:
        print("  首次采集，已建立基线，无变化可比")
    if added:
        print("  新增 %d 期（需要人工补录实测结果）：" % len(added))
        for e in added:
            print("    第%02d期 %s %s" % (e["ep"], e["bvid"], e["title"]))
    if changed:
        print("  标题变更 %d 期：" % len(changed))
        for e in changed:
            print("    第%02d期 %s -> %s" % (e["ep"], prev_map[e["bvid"]].get("title"), e["title"]))
    if previous and not added and not changed:
        print("  与上次采集一致，无需重排")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print("[sync_bilibili] 失败: %s" % exc, file=sys.stderr)
        sys.exit(1)
