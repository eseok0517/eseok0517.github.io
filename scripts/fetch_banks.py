#!/usr/bin/env python3
"""
Download quarterly call-report data from the FDIC BankFind API (public) for banks headquartered in
Arizona, for the ten largest U.S. banks, and for a size-matched peer group of banks from other states, and write data/banks.json for the Bank Health Monitor.

API: https://api.fdic.gov/banks  (endpoints /institutions and /financials). Unknown field names are
silently dropped by the API, so optional ratios are stored as null when absent.
Dollar amounts from the API are in thousands. Ratio fields (ROA, ROE, NIMY, etc.) are percent.

Standard library only. Usage:
  python scripts/fetch_banks.py                  # live download
  python scripts/fetch_banks.py --fixture FILE   # JSON {"institutions":[...], "financials":{cert:[...]}} (testing only)
"""
import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://api.fdic.gov/banks"
UA = {"User-Agent": "portfolio-data-pipeline (github.com/eseok0517)"}
QUARTERS = 13
FIN_FIELDS = ["CERT", "REPDTE", "ASSET", "DEP", "LNLSNET", "EQ", "NETINC", "ROA", "ROE", "NIMY", "RBC1AAJ", "EEFFR", "NCLNLSR", "NTLNLSR"]
INST_FIELDS = ["CERT", "NAME", "CITY", "STALP", "ASSET", "DEP", "ACTIVE", "ESTYMD"]


def get(path, params):
    url = f"{BASE}/{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            if attempt == 3:
                raise
            print(f"retry after error: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def rows(res):
    data = res.get("data")
    if isinstance(data, dict):
        data = [data]
    if data is None:
        raise RuntimeError(f"Unexpected response: {str(res)[:300]}")
    return [d.get("data", d) for d in data]


def num(v):
    try:
        return None if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return None


def institutions_live():
    az = rows(get("institutions", {"filters": "STALP:AZ AND ACTIVE:1", "fields": ",".join(INST_FIELDS), "sort_by": "ASSET", "sort_order": "DESC", "limit": 200, "format": "json"}))
    big = rows(get("institutions", {"filters": "ACTIVE:1", "fields": ",".join(INST_FIELDS), "sort_by": "ASSET", "sort_order": "DESC", "limit": 10, "format": "json"}))
    return az, big


def peers_live(n=40):
    """Similar-sized comparison banks: active, $70M to $1.5B in assets, headquartered anywhere in the U.S., sampled evenly by size."""
    try:
        r = rows(get("institutions", {"filters": "ACTIVE:1 AND ASSET:[70000 TO 1500000]", "fields": ",".join(INST_FIELDS), "sort_by": "ASSET", "sort_order": "DESC", "limit": 10000, "format": "json"}))
    except Exception as e:  # noqa: BLE001
        print(f"peer group unavailable: {e}", file=sys.stderr)
        return []
    pool = sorted((x for x in r if x.get("STALP") != "AZ"), key=lambda x: num(x.get("ASSET")) or 0)
    if len(pool) <= n:
        return pool
    step = (len(pool) - 1) / (n - 1)
    return [pool[round(i * step)] for i in range(n)]


def financials_live(cert):
    return rows(get("financials", {"filters": f"CERT:{cert}", "fields": ",".join(FIN_FIELDS), "sort_by": "REPDTE", "sort_order": "DESC", "limit": QUARTERS, "format": "json"}))


def est_year(v):
    try:
        return int(str(v)[:4]) if v else None
    except ValueError:
        return None


def build_bank(inst, group, fin):
    q = []
    for r in sorted(fin, key=lambda x: str(x.get("REPDTE"))):
        a, d, l, e = num(r.get("ASSET")), num(r.get("DEP")), num(r.get("LNLSNET")), num(r.get("EQ"))
        if not a or not r.get("REPDTE"):
            continue
        q.append({
            "date": str(r["REPDTE"]),
            "assets": a, "deposits": d, "loans": l, "equity": e, "netinc": num(r.get("NETINC")),
            "roa": num(r.get("ROA")), "roe": num(r.get("ROE")), "nim": num(r.get("NIMY")),
            "tier1": num(r.get("RBC1AAJ")), "eff": num(r.get("EEFFR")),
            "noncurrent": num(r.get("NCLNLSR")), "chargeoff": num(r.get("NTLNLSR")),
            "eq_assets": round(e / a * 100, 3) if e else None,
            "loans_dep": round(l / d * 100, 2) if l and d else None,
        })
    return {"cert": inst.get("CERT"), "name": inst.get("NAME"), "city": inst.get("CITY"), "state": inst.get("STALP"), "est": est_year(inst.get("ESTYMD")), "group": group, "quarters": q}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--fixture")
    args = ap.parse_args()
    if args.fixture:
        fx = json.load(open(args.fixture, encoding="utf-8"))
        az, big = fx["institutions"]["az"], fx["institutions"]["big"]
        fin = lambda c: fx["financials"][str(c)]
    else:
        az, big = institutions_live()
        fin = financials_live
    peer = [] if args.fixture else peers_live()
    if args.fixture:
        peer = fx["institutions"].get("peer", [])
    banks, seen = [], set()
    for group, lst in (("az", az), ("big", big), ("peer", peer)):
        for inst in lst:
            c = str(inst.get("CERT"))
            if c in seen:
                continue
            seen.add(c)
            try:
                b = build_bank(inst, group, fin(c))
            except Exception as e:  # noqa: BLE001
                if group == "az" or group == "big":
                    raise
                print(f"skipping peer {c}: {e}", file=sys.stderr)
                continue
            if len(b["quarters"]) >= 4:
                banks.append(b)
            if not args.fixture:
                time.sleep(0.2)
    n_az = sum(1 for b in banks if b["group"] == "az")
    if n_az < 3 or len(banks) < 8:
        sys.exit(f"Too few banks with data (AZ {n_az}, total {len(banks)}); refusing to overwrite banks.json")
    out = {"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), "synthetic": bool(args.fixture),
           "source": "FDIC BankFind API (call reports)", "latest": max(b["quarters"][-1]["date"] for b in banks), "banks": banks}
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "banks.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(banks)} banks ({n_az} Arizona, {sum(1 for b in banks if b['group'] == 'peer')} peers) to {args.out}/banks.json")


if __name__ == "__main__":
    main()
