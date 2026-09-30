#!/usr/bin/env python3
"""Capture page screenshots + layout metrics for frontend acceptance.

Usage:
  python scripts/frontend-shots.py OUT_DIR /markets /asset/ondo-global-markets ...
Env:
  RWA_BASE_URL (default http://localhost:3030)
  SHOT_WIDTHS  (default 390)      e.g. "320,390,430"
  SHOT_THEMES  (default light,dark)
  SHOT_LOCALE  (default en)       e.g. ar for RTL checks
  SHOT_FULL    (default 1)        full-page screenshot
  SHOT_TOKEN   optional session token injected as rwa.session for signed-in pages

Prints one JSON line per capture: horizontal overflow, console errors, final URL.
Never writes the token to disk.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("RWA_BASE_URL", "http://localhost:3030")
CHROME = os.environ.get("CHROME_BIN", r"C:\Program Files\Google\Chrome\Application\chrome.exe")


def slug(path: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", path).strip("-") or "root"


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    paths = sys.argv[2:]
    widths = [int(w) for w in os.environ.get("SHOT_WIDTHS", "390").split(",")]
    themes = os.environ.get("SHOT_THEMES", "light,dark").split(",")
    locale = os.environ.get("SHOT_LOCALE", "en")
    full = os.environ.get("SHOT_FULL", "1") == "1"
    token = os.environ.get("SHOT_TOKEN")
    failures = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME, headless=True)
        for theme in themes:
            for width in widths:
                context = browser.new_context(viewport={"width": width, "height": 844}, device_scale_factor=2)
                init = f"localStorage.setItem('rwa.theme','{theme}');localStorage.setItem('rwa-language','{locale}');"
                if token:
                    t = json.dumps(token)
                    init += "localStorage.setItem('rwa.session', JSON.stringify({sessionToken: %s, loggedInAt: new Date().toISOString()}));localStorage.setItem('rwa-session-token', %s);localStorage.setItem('auth_token', %s);" % (t, t, t)
                context.add_init_script(init)
                for path in paths:
                    page = context.new_page()
                    errors: list[str] = []
                    page.on("console", lambda m, e=errors: m.type == "error" and e.append(m.text[:200]))
                    page.on("pageerror", lambda ex, e=errors: e.append(str(ex)[:200]))
                    page.goto(BASE + path, wait_until="domcontentloaded", timeout=60000)
                    try:
                        page.wait_for_load_state("networkidle", timeout=15000)
                    except Exception:
                        pass
                    page.wait_for_timeout(1800)
                    metrics = page.evaluate(
                        "() => ({doc: document.documentElement.scrollWidth, vw: innerWidth, dir: document.documentElement.dir, lang: document.documentElement.lang, h: document.documentElement.scrollHeight})"
                    )
                    name = f"{slug(path)}-{theme}-{width}{'-' + locale if locale != 'en' else ''}.jpg"
                    page.screenshot(path=str(out / name), full_page=full, type="jpeg", quality=72, scale="css")
                    overflow = metrics["doc"] > metrics["vw"]
                    failures += int(overflow)
                    print(json.dumps({"path": path, "url": page.url.replace(BASE, ""), "theme": theme, "width": width, "locale": locale, "overflow": overflow, **metrics, "errors": errors[:5], "shot": name}, ensure_ascii=False))
                    page.close()
                context.close()
        browser.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
