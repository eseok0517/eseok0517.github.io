#!/usr/bin/env python3
"""
Fetch public macro series from FRED (no API key needed), classify market regimes,
and write results for the portfolio site.

Sources (FRED public CSV endpoint, https://fred.stlouisfed.org):
  SP500          S&P 500 index (daily)
  T10Y2Y         10-year minus 2-year Treasury spread (daily, percentage points)
  CPIAUCSL       Consumer Price Index, all urban consumers (monthly)
  BAMLH0A0HYM2   ICE BofA US High Yield option-adjusted spread (daily, percent)

Outputs (under --out, default ./data):
  raw/<SERIES>.csv       the series exactly as downloaded
  macro_results.json     monthly table, current snapshot, and forward-return stats by regime

Standard library only, so it runs on a stock GitHub Actions runner with no installs.

Usage:
  python scripts/fetch_macro.py                 # live download from FRED
  python scripts/fetch_macro.py --fixture DIR   # read DIR/<SERIES>.csv (testing only)
"""
import argparse
import csv
import io
import json
import os
import statistics
import sys
import urllib.request
from datetime import datetime, timezone

SERIES = {
    "SP500": "S&P 500 index",
    "T10Y2Y": "10Y minus 2Y Treasury spread (pct. points)",
    "CPIAUCSL": "Consumer Price Index (all urban consumers)",
    "BAMLH0A0HYM2": "High-yield credit spread (pct.)",
}
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={id}&cosd=2000-01-01"

# Regime definitions (edit to taste; they are stated on the results page)
INFLATION_HIGH = 3.0   # CPI year-over-year, percent
CREDIT_STRESS = 5.0    # high-yield spread, percent
HORIZON = 12           # months for forward return


def download(series_id):
    req = urllib.request.Request(
        FRED_URL.format(id=series_id),
        headers={"User-Agent": "portfolio-data-pipeline (github.com/eseok0517)"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def parse_fred(text):
    """Return a sorted list of (YYYY-MM-DD, float). FRED marks missing values as '.' or blank."""
    out = []
    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # header: DATE/observation_date, <series id>
    for row in reader:
        if len(row) < 2:
            continue
        d, v = row[0].strip(), row[1].strip()
        if not d or v in ("", "."):
            continue
        try:
            out.append((d, float(v)))
        except ValueError:
            continue
    out.sort()
    return out


def to_monthly_last(points, before_month=None):
    """Last valid observation in each calendar month, keyed 'YYYY-MM'."""
    before_month = before_month or datetime.now(timezone.utc).strftime("%Y-%m")
    m = {}
    for d, v in points:
        if d[:7] >= before_month:
            continue
        m[d[:7]] = v
    return m


def month_add(ym, k):
    y, mo = int(ym[:4]), int(ym[5:7])
    t = y * 12 + (mo - 1) + k
    return f"{t // 12:04d}-{t % 12 + 1:02d}"


def build_table(monthly):
    sp, curve, cpi, hy = (monthly[k] for k in ("SP500", "T10Y2Y", "CPIAUCSL", "BAMLH0A0HYM2"))
    # The high-yield spread series on FRED now covers only about three years, so it must not
    # limit the sample: use S&P 500 and yield-curve months, and treat credit data as optional.
    months = sorted(set(sp) & set(curve))
    rows = []
    for ym in months:
        prev = cpi.get(month_add(ym, -12))
        cur = cpi.get(ym)
        yoy = (cur / prev - 1) * 100 if cur and prev else None
        fwd_key = month_add(ym, HORIZON)
        fwd = (sp[fwd_key] / sp[ym] - 1) * 100 if fwd_key in sp else None
        rows.append({
            "month": ym,
            "sp500": round(sp[ym], 2),
            "curve": round(curve[ym], 3),
            "hy_spread": round(hy[ym], 3) if ym in hy else None,
            "cpi_yoy": None if yoy is None else round(yoy, 2),
            "fwd12_return": None if fwd is None else round(fwd, 2),
            "curve_regime": "Inverted" if curve[ym] < 0 else "Normal",
            "inflation_regime": None if yoy is None else ("High" if yoy >= INFLATION_HIGH else "Low"),
            "credit_regime": None if ym not in hy else ("Stressed" if hy[ym] >= CREDIT_STRESS else "Calm"),
        })
    return rows


def regime_stats(rows, field):
    groups = {}
    for r in rows:
        label = r[field]
        if label is None or r["fwd12_return"] is None:
            continue
        groups.setdefault(label, []).append(r["fwd12_return"])
    out = []
    for label, vals in sorted(groups.items()):
        out.append({
            "regime": label,
            "months": len(vals),
            "mean_fwd12": round(statistics.mean(vals), 2),
            "median_fwd12": round(statistics.median(vals), 2),
            "pct_positive": round(100 * sum(v > 0 for v in vals) / len(vals), 1),
            "worst_fwd12": round(min(vals), 2),
            "best_fwd12": round(max(vals), 2),
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--saved-source", help="rebuild from previously downloaded real FRED CSVs")
    ap.add_argument("--fixture", help="directory containing <SERIES>.csv files (testing only)")
    args = ap.parse_args()

    if args.fixture and args.saved_source:
        ap.error("Choose either --fixture or --saved-source")
    os.makedirs(os.path.join(args.out, "raw"), exist_ok=True)
    monthly = {}
    meta = {}
    for sid, desc in SERIES.items():
        if args.fixture or args.saved_source:
            with open(os.path.join(args.fixture or args.saved_source, f"{sid}.csv"), encoding="utf-8") as f:
                text = f.read()
        else:
            text = download(sid)
        with open(os.path.join(args.out, "raw", f"{sid}.csv"), "w", encoding="utf-8", newline="") as f:
            f.write(text)
        pts = parse_fred(text)
        if not pts:
            sys.exit(f"No usable observations for {sid}")
        monthly[sid] = to_monthly_last(pts)
        meta[sid] = {"description": desc, "first": pts[0][0], "last": pts[-1][0], "observations": len(pts)}

    rows = build_table(monthly)
    if len(rows) < 36:
        sys.exit(f"Only {len(rows)} overlapping months; refusing to publish results")

    # A common snapshot requires all inputs; historical comparisons retain optional credit gaps.
    latest = next((r for r in reversed(rows) if r["cpi_yoy"] is not None and r["hy_spread"] is not None), rows[-1])
    results = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "synthetic": bool(args.fixture),
        "refresh_mode": "test fixture" if args.fixture else "stored FRED downloads" if args.saved_source else "fresh FRED download",
        "sample": {"first_month": rows[0]["month"], "last_month": rows[-1]["month"], "monthly_rows": len(rows)},
        "source": "FRED (Federal Reserve Bank of St. Louis), public CSV endpoint",
        "definitions": {
            "curve": "Inverted when the 10Y-2Y spread is below 0",
            "inflation": f"High when CPI year-over-year is at least {INFLATION_HIGH}%",
            "credit": f"Stressed when the high-yield spread is at least {CREDIT_STRESS}%",
            "forward_return": f"S&P 500 price return over the next {HORIZON} months, measured from each month-end",
        },
        "series": meta,
        "latest": latest,
        "stats": {
            "curve_regime": regime_stats(rows, "curve_regime"),
            "inflation_regime": regime_stats(rows, "inflation_regime"),
            "credit_regime": regime_stats(rows, "credit_regime"),
        },
        "monthly": rows,
        "caveats": [
            "Forward-return windows overlap, so consecutive months are not independent observations.",
            "FRED's S&P 500 series covers only about the last ten years, so some regimes have few months.",
            "FRED's high-yield spread covers only about the last three years, so credit-regime results rest on far fewer months than the yield-curve results.",
            "Price return only (no dividends). Historical regime differences are descriptive, not a forecast.",
            "The current partial calendar month is excluded; forward returns require a full 12-month endpoint.",
            "Regimes use reported macro data and may contain later revisions. Release lags are not modeled; this is not a real-time trading backtest.",
        ],
    }
    with open(os.path.join(args.out, "macro_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=1)
    print(f"Wrote {len(rows)} monthly rows to {args.out}/macro_results.json (synthetic={results['synthetic']})")


if __name__ == "__main__":
    main()
