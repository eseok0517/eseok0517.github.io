#!/usr/bin/env python3
"""
Download daily prices for a set of well-known stocks and ETFs, reduce them to month-end
dividend-adjusted closes, and write data/equities.json for the Equity Risk & Regimes page.

Prices: Yahoo Finance chart endpoint (adjusted close, includes dividends). If Yahoo refuses
the request for a ticker, Stooq daily closes are used instead (split-adjusted price only);
the file records which source each ticker came from.
Macro inputs from FRED's public CSV endpoint (no API key):
  T10Y2Y    10-year minus 2-year Treasury spread (daily)
  CPIAUCSL  Consumer Price Index (monthly)
  TB3MS     3-month Treasury bill rate (monthly, percent), used as the risk-free rate

Standard library only. Usage:
  python scripts/fetch_equities.py                 # live download
  python scripts/fetch_equities.py --fixture DIR   # DIR/<TICKER>.csv (Date,Close) and DIR/<SERIES>.csv (testing only)
"""
import argparse
import csv
import io
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_macro import parse_fred, to_monthly_last, month_add  # noqa: E402

START = "2007-01-01"
TICKERS = [
    ("SPY", "SPDR S&P 500 ETF", "US large-cap index"),
    ("QQQ", "Invesco QQQ (Nasdaq-100)", "US growth index"),
    ("AAPL", "Apple", "Technology"),
    ("MSFT", "Microsoft", "Technology"),
    ("NVDA", "NVIDIA", "Technology"),
    ("JPM", "JPMorgan Chase", "Banks"),
    ("GS", "Goldman Sachs", "Banks"),
    ("XOM", "Exxon Mobil", "Energy"),
    ("JNJ", "Johnson & Johnson", "Health care"),
    ("TLT", "iShares 20+ Year Treasury Bond ETF", "Long-term Treasuries"),
]
FRED = {"T10Y2Y": "10Y minus 2Y Treasury spread", "CPIAUCSL": "Consumer Price Index", "TB3MS": "3-month Treasury bill rate"}
FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={id}&cosd=2000-01-01"
UA = {"User-Agent": "Mozilla/5.0 (portfolio-data-pipeline; github.com/eseok0517)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def yahoo(ticker):
    p1 = int(datetime.strptime(START, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
    p2 = int(time.time())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?period1={p1}&period2={p2}&interval=1d&events=div%2Csplit")
    data = json.loads(get(url))["chart"]["result"][0]
    ts = data["timestamp"]
    adj = data["indicators"]["adjclose"][0]["adjclose"]
    out = []
    for t, v in zip(ts, adj):
        if v is None:
            continue
        out.append((datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%d"), float(v)))
    return sorted(out), "Yahoo Finance (adjusted close, dividends included)"


def parse_price_csv(text, col="Close"):
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        try:
            out.append((row["Date"].strip(), float(row[col])))
        except (KeyError, ValueError):
            continue
    return sorted(out)


def stooq(ticker):
    url = f"https://stooq.com/q/d/l/?s={ticker.lower()}.us&d1={START.replace('-', '')}&d2={datetime.now(timezone.utc).strftime('%Y%m%d')}&i=d"
    return parse_price_csv(get(url)), "Stooq (split-adjusted close, dividends not included)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--fixture", help="directory with <TICKER>.csv and <SERIES>.csv files (testing only)")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    monthly, sources = {}, {}
    for sym, name, group in TICKERS:
        if args.fixture:
            with open(os.path.join(args.fixture, f"{sym}.csv"), encoding="utf-8") as f:
                pts, src = parse_price_csv(f.read()), "test fixture"
        else:
            try:
                pts, src = yahoo(sym)
            except Exception as e:  # noqa: BLE001 - any failure falls back to the second source
                print(f"{sym}: Yahoo failed ({e}); trying Stooq", file=sys.stderr)
                try:
                    pts, src = stooq(sym)
                except Exception as e2:  # noqa: BLE001
                    print(f"{sym}: Stooq failed ({e2}); skipping", file=sys.stderr)
                    continue
            time.sleep(1)
        if len(pts) < 500:
            print(f"{sym}: only {len(pts)} observations; skipping", file=sys.stderr)
            continue
        monthly[sym] = to_monthly_last(pts)
        sources[sym] = src

    if "SPY" not in monthly or len(monthly) < 5:
        sys.exit("Too few tickers downloaded; refusing to overwrite equities.json")

    fred = {}
    for sid in FRED:
        if args.fixture:
            with open(os.path.join(args.fixture, f"{sid}.csv"), encoding="utf-8") as f:
                text = f.read()
        else:
            text = get(FRED_URL.format(id=sid))
        fred[sid] = to_monthly_last(parse_fred(text))

    months = sorted(set.union(*(set(m) for m in monthly.values())))
    months = [m for m in months if m >= START[:7]]
    curve = {m: round(fred["T10Y2Y"][m], 3) for m in months if m in fred["T10Y2Y"]}
    cpi = fred["CPIAUCSL"]
    cpi_yoy = {}
    for m in months:
        prev = cpi.get(month_add(m, -12))
        if m in cpi and prev:
            cpi_yoy[m] = round((cpi[m] / prev - 1) * 100, 2)
    rf = {m: round(fred["TB3MS"][m], 3) for m in months if m in fred["TB3MS"]}

    result = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "synthetic": bool(args.fixture),
        "months": months,
        "tickers": [
            {"symbol": s, "name": n, "group": g, "source": sources[s],
             "prices": [round(monthly[s][m], 4) if m in monthly[s] else None for m in months]}
            for s, n, g in TICKERS if s in monthly
        ],
        "macro": {
            "curve": [curve.get(m) for m in months],
            "cpi_yoy": [cpi_yoy.get(m) for m in months],
            "rf_pct": [rf.get(m) for m in months],
        },
        "definitions": {
            "curve_inverted": "10Y-2Y spread below 0 at month-end",
            "inflation_high": "CPI year-over-year of at least 3.0%",
            "risk_free": "3-month Treasury bill rate (TB3MS), annual percent",
        },
    }
    with open(os.path.join(args.out, "equities.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))
    print(f"Wrote {len(result['tickers'])} tickers, {len(months)} months to {args.out}/equities.json")


if __name__ == "__main__":
    main()
