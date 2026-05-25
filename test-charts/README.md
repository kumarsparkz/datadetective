# Test Charts for DataDetective

A curated set of chart images for demoing and testing DataDetective. Each was
generated deterministically (`generate_test_charts.py`) and **verified against
`gemma4:e4b` running locally** so the demo behaves predictably on camera.

The set is deliberately mixed — three manipulative charts and one honest control
— so you can show that the tool *reasons* about integrity rather than flagging
everything by default.

| File | What it is | The trick | What Gemma 4 should catch |
|------|-----------|-----------|---------------------------|
| `01-truncated-revenue.png` | Bar chart, "Company Revenue Growth Q1–Q4" | Y-axis starts at **$95M**, not zero — a 5% rise looks enormous | **[high] Truncated Y-axis** + hype caption |
| `02-cherry-picked-stock.png` | Line chart, "Stock Price Performance" | Shows only a hand-picked **Jun–Oct** upswing; "+59.5%! Invest now!" | **[high] Cherry-picked timeframe** |
| `03-misleading-pie.png` | 3D-style pie, "Market Share" | Slices labeled 45+25+20+18 = **108%**, hero slice exploded | **[high] Percentages don't sum to 100%** |
| `04-honest-control.png` | Bar chart, "Monthly Active Users" | None — zero baseline, units, source, neutral language | **Scores high (~95)** with no/low flags |

## Why these four

- **Contrast.** The honest control scoring ~95 next to the pie scoring ~25 proves
  the tool is discriminating, not cynical. That contrast is the most persuasive
  thing you can show a judge.
- **Reliability.** All four were chosen because `gemma4:e4b` produces a
  consistent verdict on them with the reason-first prompt. (Earlier, JSON-only
  mode missed the truncated axis and the bad pie total — see the blog post.)

## Regenerate

```bash
python3 generate_test_charts.py    # rewrites the PNGs in this folder
```

You can also just use the three **built-in sample buttons** in the app (Canvas-
generated, no files needed). These PNGs are for the "upload your own" half of the
demo and for repeatable testing.
