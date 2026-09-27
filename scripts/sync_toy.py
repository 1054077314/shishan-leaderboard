#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
主数据源：B站 toy 官方「屎山英雄榜」
https://www.bilibili.com/toy/shishan/index.html?spm_id_from=333.1387.0.0
外层是壳，真实内容在 iframe：
https://www.bilibilitoy.com/toy/shishan/index.html

该页是纯静态 Astro 页，无 XHR 接口。榜单数据以两种形式直出：
  1. <script type="application/json"> 内嵌块：
     player-data（选手生涯 voter + 版本）、topic-data（题库）、
     assessment-data（屎山考核逐题逐轮 verdicts + total/18）、tier-meta
  2. 服务端直出的三张榜 HTML：
     ladder（屎山论剑挑战榜：名次/升降/战报 note）、
     kaohe（考核榜，与 assessment-data 同源）、
     standings（赛事积分：小组 WDL + 总积分榜）

产出 scripts/.cache/toy.json，供 rebuildRanking.mjs 消费。
彻底替代 sync_bilibili.py 的合集+搜索视频采集链路。
"""
import gzip
import json
import os
import re
import sys
import urllib.request

TOY_URL = "https://www.bilibilitoy.com/toy/shishan/index.html"
SOURCE_URL = "https://www.bilibili.com/toy/shishan/index.html?spm_id_from=333.1387.0.0"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "scripts", ".cache")
CACHE_FILE = os.path.join(CACHE_DIR, "toy.json")


def fetch_html(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    try:
        return gzip.decompress(raw).decode("utf-8")
    except OSError:
        return raw.decode("utf-8", errors="ignore")


def extract_json_block(html, block_id):
    m = re.search(
        r'<script[^>]*id="%s"[^>]*>(.*?)</script>' % re.escape(block_id),
        html,
        re.S,
    )
    if not m:
        raise RuntimeError("内嵌 JSON 块缺失: %s" % block_id)
    return json.loads(m.group(1).strip())


def strip_tags(text):
    return re.sub(r"<[^>]+>", "", text or "").strip()


def parse_ladder(html):
    """挑战榜：取每行名次 / 版本名 / 厂商 / 升降 / 战报 note。"""
    m = re.search(
        r'<section class="ta-view" data-view="ladder">(.*?)</section>',
        html,
        re.S,
    )
    if not m:
        raise RuntimeError("ladder section 缺失")
    section = m.group(1)
    champ = re.search(
        r'<div class="ta-champ-name">\s*(.*?)\s*(?:<span[^>]*>.*?</span>)?\s*</div>\s*'
        r'<div class="ta-champ-org">(.*?)</div>\s*'
        r'<div class="ta-champ-note">(.*?)</div>',
        section,
        re.S,
    )
    rows = [
        {
            "rank": 1,
            "name": strip_tags(champ.group(1)),
            "org": strip_tags(champ.group(2)),
            "note": strip_tags(champ.group(3)),
            "trend": "hold",
            "delta": 0,
        }
    ]
    for rm in re.finditer(
        r'<li class="ta-row">\s*<span class="ta-rank">(\d+)</span>\s*'
        r'<span class="ta-trend (\w+)"[^>]*>(.*?)</span>.*?'
        r'<span class="ta-row-title">\s*(.*?)<em class="ta-row-org">(.*?)</em>\s*</span>\s*'
        r'(?:<span class="ta-row-note">(.*?)</span>)?',
        section,
        re.S,
    ):
        rank, trend, trend_text, name, org, note = rm.groups()
        trend_text = strip_tags(trend_text)
        delta = 0
        dm = re.search(r"[▲▼](\d+)", trend_text)
        if dm:
            delta = int(dm.group(1)) * (-1 if "▼" in trend_text else 1)
        rows.append(
            {
                "rank": int(rank),
                "name": strip_tags(name),
                "org": strip_tags(org),
                "note": strip_tags(note),
                "trend": trend,
                "delta": delta,
            }
        )
    rows.sort(key=lambda r: r["rank"])
    stats = re.search(
        r'<section class="ta-view" data-view="ladder">.*?<div class="ta-stats">(.*?)</div>',
        html,
        re.S,
    )
    latest = ""
    if stats:
        mm = re.search(r"最近\s*([\d-]+)", strip_tags(stats.group(1)))
        if mm:
            latest = mm.group(1)
    return rows, latest


def parse_standings(html):
    """赛事积分：小组 WDL/积分 + 总积分榜。"""
    m = re.search(
        r'<section class="ta-view" data-view="standings">(.*?)<section class="ta-view" data-view="players">',
        html,
        re.S,
    )
    if not m:
        raise RuntimeError("standings section 缺失")
    section = m.group(1)
    groups = []
    for gm in re.finditer(
        r'<span class="ta-group-name">(.*?)</span>.*?<span class="ta-group-state (\w+)">(.*?)</span>.*?</div>\s*<ol class="ta-mini">(.*?)</ol>',
        section,
        re.S,
    ):
        name, _state, state_text, body = gm.groups()
        members = []
        for mm in re.finditer(
            r'<span class="ta-mini-name">(.*?)</span>\s*<span class="ta-mini-wdl">([\d-]+)</span>\s*<span class="ta-mini-pts">(\d+)</span>',
            body,
        ):
            members.append(
                {"name": strip_tags(mm.group(1)), "wdl": mm.group(2), "pts": int(mm.group(3))}
            )
        groups.append({"group": strip_tags(name), "state": strip_tags(state_text), "members": members})
    total = []
    tm = re.search(r'<h2 class="ta-block-title">总积分榜</h2>.*?<ol class="ta-list"(.*?)</ol>', section, re.S)
    if tm:
        for rm in re.finditer(
            r'<span class="ta-rank[^"]*">(\d+)</span>.*?<span class="ta-row-title">\s*(.*?)<em class="ta-row-org">(.*?)</em>\s*</span>.*?'
            r'<span class="ta-wdl">(.*?)</span>.*?<span class="ta-pts"><b>(\d+)</b>',
            tm.group(1),
            re.S,
        ):
            total.append(
                {
                    "rank": int(rm.group(1)),
                    "name": strip_tags(rm.group(2)),
                    "org": strip_tags(rm.group(3)),
                    "wdl": strip_tags(rm.group(4)),
                    "pts": int(rm.group(5)),
                }
            )
    return groups, total


def normalize_name(name):
    return re.sub(r"[\s\-_.]", "", (name or "").lower())


def build_version_index(player_data):
    """family key -> {org, versions[]}，版本名归一化后可查。"""
    index = {}
    for _family, p in player_data.items():
        for v in p.get("versions", []):
            index[normalize_name(v["label"])] = {
                "family": p["name"],
                "org": p.get("org", ""),
                "version": v["label"],
                "color": p.get("color", ""),
            }
    return index


def main():
    html = fetch_html(TOY_URL)
    player_data = extract_json_block(html, "player-data")
    assessment_data = extract_json_block(html, "assessment-data")
    topic_data = extract_json_block(html, "topic-data")
    ladder, latest = parse_ladder(html)
    groups, standings_total = parse_standings(html)
    version_index = build_version_index(player_data)

    payload = {
        "source": "toy",
        "sourceUrl": SOURCE_URL,
        "toyUrl": TOY_URL,
        "fetchedAt": __import__("time").strftime("%Y-%m-%dT%H:%M:%S+08:00", __import__("time").localtime()),
        "latestBoutDate": latest,
        "ladder": ladder,
        "assessments": assessment_data,
        "players": player_data,
        "topics": topic_data,
        "standingsGroups": groups,
        "standingsTotal": standings_total,
        "versionIndex": version_index,
    }
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(
        "[sync_toy] ladder %d 位 / 考核 %d 份 / 选手 %d 家 / 题库 %d 道 / 小组 %d 个 -> %s"
        % (len(ladder), len(assessment_data), len(player_data), len(topic_data), len(groups), CACHE_FILE)
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print("[sync_toy] 失败: %s" % exc, file=sys.stderr)
        sys.exit(1)
