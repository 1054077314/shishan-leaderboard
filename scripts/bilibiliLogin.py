#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
B站扫码登录：生成官方登录二维码 -> 用户用 B站 App 扫码确认 -> 拿到 SESSDATA。

为什么用扫码而不是手动复制 Cookie：
  SESSDATA 是 HttpOnly 的，浏览器里 JS 读不到，让用户翻 DevTools 容易出错。
  走官方二维码接口（passport-login/web/qrcode），App 扫码确认后 SESSDATA
  直接出现在轮询响应的 Set-Cookie 里，脚本原样落盘，全程不经过第三方。

写入： scripts/.bilibili_auth（仅追加一行 SESSDATA=...，该文件已 git-ignore）
轮询状态码： 86101 未扫码 / 86090 已扫码待确认 / 86038 二维码过期 / 0 成功

运行： python scripts/bilibiliLogin.py
"""
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
AUTH_FILE = os.path.join(HERE, ".bilibili_auth")
QR_FILE = os.path.join(HERE, ".cache", "login_qr.png")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
GENERATE = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"
POLL = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.bilibili.com/"})
    return urllib.request.urlopen(req, timeout=15)


def make_qr(url, dest):
    try:
        import qrcode
    except ImportError:
        # 无 qrcode 库时降级：打印登录链接，转成二维码或手机直接打开都行
        print(f"[login] 未安装 qrcode，请把此链接转成二维码扫描：\n{url}")
        return False
    img = qrcode.make(url, box_size=8, border=2)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    img.save(dest)
    return True


def extract_set_cookies(resp):
    """urllib 的 headers.get_all 拿到全部 Set-Cookie 行"""
    return resp.headers.get_all("Set-Cookie") or []


def save_sessdata(sessdata):
    """保留文件里的注释行，替换/追加 SESSDATA 数据行"""
    lines = []
    if os.path.exists(AUTH_FILE):
        with open(AUTH_FILE, "r", encoding="utf-8") as f:
            lines = [l.rstrip("\n") for l in f if l.strip() and not l.startswith("SESSDATA=")]
    lines.append(f"SESSDATA={sessdata}")
    with open(AUTH_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    with fetch(GENERATE) as r:
        gen = json.loads(r.read().decode("utf-8"))
    if gen.get("code") != 0:
        print(f"[login] 二维码生成失败: {gen}")
        return 1
    qr_url, key = gen["data"]["url"], gen["data"]["qrcode_key"]
    if make_qr(qr_url, QR_FILE):
        print(f"[login] 二维码已生成: {QR_FILE}")
    print("[login] 请用 B站 App 扫一扫并确认登录（3 分钟内有效）", flush=True)

    deadline = time.time() + 185
    last_state = None
    while time.time() < deadline:
        try:
            with fetch(f"{POLL}?qrcode_key={key}") as r:
                set_cookies = extract_set_cookies(r)
                body = json.loads(r.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"[login] 轮询异常，重试: {exc}", flush=True)
            time.sleep(2)
            continue
        code = body.get("data", {}).get("code")
        if code != last_state:
            msgs = {86101: "等待扫码…", 86090: "已扫码，请在手机上确认…", 86038: "二维码已过期"}
            print(f"[login] {msgs.get(code, f'状态 {code}')}", flush=True)
            last_state = code
        if code == 0:
            sessdata = None
            for c in set_cookies:
                if c.startswith("SESSDATA="):
                    sessdata = c.split(";")[0][len("SESSDATA="):]
            if not sessdata:
                print("[login] 登录成功但未在响应里找到 SESSDATA")
                return 1
            save_sessdata(sessdata)
            print(f"[login] 登录成功！SESSDATA 已写入 {AUTH_FILE}（len={len(sessdata)}）", flush=True)
            return 0
        if code == 86038:
            print("[login] 二维码过期，请重新运行本脚本", flush=True)
            return 2
        time.sleep(2)
    print("[login] 超时未确认，退出")
    return 3


if __name__ == "__main__":
    sys.exit(main())
