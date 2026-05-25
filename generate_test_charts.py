#!/usr/bin/env python3
"""
Generate the DataDetective test-chart set into ./test-charts/.

Three deliberately misleading charts + one honest control, drawn with Pillow so
they are deterministic and dependency-light. See test-charts/README.md for what
each one is designed to make Gemma 4 catch.

    pip install pillow
    python3 generate_test_charts.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "test-charts")
os.makedirs(OUT, exist_ok=True)

_FONT_DIRS = [
    "/System/Library/Fonts/Supplemental",        # macOS
    "/usr/share/fonts/truetype/dejavu",           # Linux
]


def F(size, bold=False):
    names = ["Arial Bold.ttf", "DejaVuSans-Bold.ttf"] if bold else ["Arial.ttf", "DejaVuSans.ttf"]
    for d in _FONT_DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def canvas(w=640, h=440):
    img = Image.new("RGB", (w, h), "white")
    return img, ImageDraw.Draw(img)


def center(d, x, y, s, f, fill=(26, 26, 46)):
    d.text((x - d.textlength(s, font=f) / 2, y), s, fill=fill, font=f)


def right(d, x, y, s, f, fill=(102, 102, 102)):
    d.text((x - d.textlength(s, font=f), y), s, fill=fill, font=f)


def truncated():
    img, d = canvas(); W, H = img.size
    center(d, W / 2, 22, "Company Revenue Growth (Q1-Q4)", F(19, True))
    vals, lab, yMin, yMax = [97, 98, 100, 102], ["Q1", "Q2", "Q3", "Q4"], 95, 104
    cL, cR, cT, cB = 90, W - 50, 68, H - 70; cW, cH = cR - cL, cB - cT
    for v in range(yMin, yMax + 1):
        y = cB - ((v - yMin) / (yMax - yMin)) * cH
        right(d, cL - 12, y - 7, f"${v}M", F(12)); d.line([(cL, y), (cR, y)], fill=(238, 238, 238))
    bW = cW / (len(vals) * 2); cols = [(79, 70, 229), (99, 102, 241), (129, 140, 248), (165, 180, 252)]
    for i, v in enumerate(vals):
        bH = ((v - yMin) / (yMax - yMin)) * cH; x = cL + (i * 2 + 0.5) * bW; y = cB - bH
        d.rectangle([x, y, x + bW, cB], fill=cols[i])
        center(d, x + bW / 2, y - 20, f"${v}M", F(14, True)); center(d, x + bW / 2, cB + 10, lab[i], F(13), (102, 102, 102))
    d.line([(cL, cT), (cL, cB), (cR, cB)], fill=(51, 51, 51), width=2)
    center(d, W / 2, H - 30, "Revenue SURGES from Q1 to Q4!", F(15, True), (22, 163, 74))
    return img


def cherry():
    img, d = canvas(); W, H = img.size
    center(d, W / 2, 22, "Stock Price Performance", F(19, True))
    mon, vals, yMin, yMax = ["Jun", "Jul", "Aug", "Sep", "Oct"], [42, 48, 55, 61, 67], 35, 75
    cL, cR, cT, cB = 80, W - 50, 68, H - 80; cW, cH = cR - cL, cB - cT
    for v in range(yMin, yMax + 1, 5):
        y = cB - ((v - yMin) / (yMax - yMin)) * cH
        right(d, cL - 12, y - 7, f"${v}", F(12)); d.line([(cL, y), (cR, y)], fill=(238, 238, 238))
    pts = [(cL + (i / (len(vals) - 1)) * cW, cB - ((v - yMin) / (yMax - yMin)) * cH) for i, v in enumerate(vals)]
    d.line(pts, fill=(22, 163, 74), width=4)
    for i, (x, y) in enumerate(pts):
        d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(22, 163, 74)); center(d, x, cB + 10, mon[i], F(12), (102, 102, 102))
    d.line([(cL, cT), (cL, cB), (cR, cB)], fill=(51, 51, 51), width=2)
    center(d, W / 2, H - 44, "+59.5% returns in 5 months! Invest now!", F(15, True), (22, 163, 74))
    center(d, W / 2, H - 22, "*Period shown: Jun-Oct 2025", F(10), (170, 170, 170))
    return img


def pie():
    img, d = canvas(); W, H = img.size
    center(d, W / 2, 22, "Market Share Distribution", F(19, True))
    sl = [("Our Product", 45, (79, 70, 229)), ("Competitor A", 25, (148, 163, 184)),
          ("Competitor B", 20, (203, 213, 225)), ("Others", 18, (226, 232, 240))]
    cx, cy, rx, ry = W / 2, H / 2 + 8, 150, 108; tot = sum(s[1] for s in sl); sa = -90
    for lbl, val, col in sl:
        sw = val / tot * 360; ox, oy = (16, 9) if lbl == "Our Product" else (0, 0)
        d.pieslice([cx - rx + ox, cy - ry + oy, cx + rx + ox, cy + ry + oy], sa, sa + sw, fill=col, outline="white", width=3)
        ma = math.radians(sa + sw / 2)
        center(d, cx + ox + math.cos(ma) * 85, cy + oy + math.sin(ma) * 60 - 8, f"{val}%", F(15, True), (255, 255, 255))
        sa += sw
    for i, (lbl, val, col) in enumerate(sl):
        x = 40 + i * 150; d.rectangle([x, H - 58, x + 13, H - 45], fill=col)
        d.text((x + 18, H - 59), f"{lbl} ({val}%)", fill=(85, 85, 85), font=F(11))
    center(d, W / 2, H - 26, "Our Product clearly dominates the market!", F(13, True))
    return img


def honest():
    img, d = canvas(); W, H = img.size
    center(d, W / 2, 18, "Monthly Active Users — 2025", F(18, True))
    center(d, W / 2, 40, "Source: internal analytics dashboard", F(10), (136, 136, 136))
    vals, lab, yMin, yMax = [120, 135, 128, 150, 162, 158], ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], 0, 200
    cL, cR, cT, cB = 80, W - 50, 68, H - 66; cW, cH = cR - cL, cB - cT
    for v in range(yMin, yMax + 1, 50):
        y = cB - ((v - yMin) / (yMax - yMin)) * cH
        right(d, cL - 12, y - 7, f"{v}k", F(11)); d.line([(cL, y), (cR, y)], fill=(238, 238, 238))
    step = cW / len(vals); bW = step * 0.6
    for i, v in enumerate(vals):
        bH = ((v - yMin) / (yMax - yMin)) * cH; x = cL + i * step + (step - bW) / 2; y = cB - bH
        d.rectangle([x, y, x + bW, cB], fill=(79, 70, 229)); center(d, x + bW / 2, cB + 8, lab[i], F(11), (102, 102, 102))
    d.line([(cL, cT), (cL, cB), (cR, cB)], fill=(51, 51, 51), width=2)
    center(d, W / 2, H - 22, "Y-axis starts at zero · units in thousands", F(10), (136, 136, 136))
    return img


CHARTS = {
    "01-truncated-revenue": truncated,
    "02-cherry-picked-stock": cherry,
    "03-misleading-pie": pie,
    "04-honest-control": honest,
}

if __name__ == "__main__":
    for name, fn in CHARTS.items():
        path = os.path.join(OUT, f"{name}.png")
        fn().save(path)
        print("wrote", path)
