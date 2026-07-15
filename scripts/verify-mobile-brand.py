#!/usr/bin/env python3
"""Verify that the mobile header never presents a clipped/partial brand mark."""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("RWA_BASE_URL", "http://localhost:3030")
CHROME = os.environ.get(
    "CHROME_BIN",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
)


def main() -> int:
    chrome_path = Path(CHROME)
    if not chrome_path.exists():
        raise SystemExit(f"Chrome was not found at {chrome_path}")

    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=str(chrome_path), headless=True)
        for width in (360, 430):
            page = browser.new_page(viewport={"width": width, "height": 180})
            page.goto(f"{BASE_URL}/home", wait_until="domcontentloaded")
            page.wait_for_selector("#brand-ring")
            result = page.evaluate(
                """() => {
                  const ring = document.getElementById('brand-ring');
                  const animation = ring.getAnimations()[0];
                  if (animation) {
                    animation.pause();
                    animation.currentTime = 160;
                  }
                  const style = getComputedStyle(ring);
                  const brand = document.querySelector('.brand').getBoundingClientRect();
                  const actions = document.querySelector('.topbar-actions').getBoundingClientRect();
                  return {
                    dasharray: style.strokeDasharray,
                    brandTop: brand.top,
                    brandRight: brand.right,
                    actionsLeft: actions.left,
                  };
                }"""
            )
            if result["dasharray"] != "none":
                failures.append(
                    f"{width}px: ring uses {result['dasharray']}; the reveal can display a half logo"
                )
            if result["brandTop"] < 16:
                failures.append(
                    f"{width}px: brand top is {result['brandTop']}px; expected at least 16px"
                )
            if result["brandRight"] > result["actionsLeft"]:
                failures.append(f"{width}px: brand overlaps the header actions")
            page.close()
        browser.close()

    if failures:
        raise SystemExit("\n".join(failures))

    print("Mobile brand verification passed at 360px and 430px.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
