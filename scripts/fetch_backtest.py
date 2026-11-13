#!/usr/bin/env python3
"""
Back-test the Bank Health Monitor's six warning screens against real FDIC bank failures.

For each failed bank, the screens are applied to the call report from about one year before failure.
The same screens are applied to a sample of banks that did not fail, at the same calendar dates, so the
share of healthy banks that also trip a screen (false alarms) is measured, not assumed.

Windows: the 2009-2012 credit crisis and the 2023-2026 rate shock (SVB, Signature, First Republic and later failures).
API: https://api.fdic.gov/banks (/failures, /institutions, /financials). Standard library only.
Writes data/backtest.json. Exits without writing if the samples are too small to report.
Usage: python scripts/fetch_backtest.py --out data
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import fetch_banks as fb

WINDOWS = [
    {"id": "crisis", "name": "2009-2012 credit crisis", "from": "2009-01-01", "to": "2012-12-31",
     "asof": ["20081231", "20091231", "20101231"], "max_failed": 150},
    {"id": "recent", "name": "2023-2026 rate shock", "from": "2023-01-01", "to": "2026-12-31",
     "asof": ["20211231", "20220630", "20221231"], "max_failed": 60},
]
FLAG_NAMES = ["Low ROA", "Margin squeeze", "Thin equity", "High loans/deposits", "Deposit outflow", "Asset quality"]
N_CONTROLS = 250


def parse_date(s):
    s = str(s or "").strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%Y%m%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s[:19] if "T" in fmt else s, fmt)
        except ValueError:
            continue
    return None


THRESH = {"roa": 0.5, "dnim": 0.25, "eq": 8.0, "ld": 90.0, "ddep": 5.0, "nc": 3.0}
# alternative cutoffs tested for each screen: (flag name, metric key, direction, values)
SWEEP = [
    ("Low ROA", "roa", "lt", [0.0, 0.25, 0.5, 0.75, 1.0]),
    ("Margin squeeze", "dnim", "ge", [0.1, 0.25, 0.5]),
    ("Thin equity", "eq", "lt", [6.0, 7.0, 8.0, 9.0, 10.0]),
    ("High loans/deposits", "ld", "gt", [70.0, 80.0, 90.0, 100.0]),
    ("Deposit outflow", "ddep", "ge", [2.0, 5.0, 10.0]),
    ("Asset quality", "nc", "gt", [1.0, 2.0, 3.0, 5.0]),
]


def metrics_at(qs, i):
    q = qs[i]
    m = {"roa": q["roa"], "eq": q["eq_assets"], "ld": q["loans_dep"], "nc": q["noncurrent"], "dnim": None, "ddep": None}
    if i >= 4:
        if q["nim"] is not None and qs[i - 4]["nim"] is not None:
            m["dnim"] = qs[i - 4]["nim"] - q["nim"]  # points of margin lost (positive = squeeze)
        if q["deposits"] and qs[i - 4]["deposits"]:
            m["ddep"] = -(q["deposits"] / qs[i - 4]["deposits"] - 1) * 100  # percent of deposits lost
    return m


def hit(m, key, direction, t):
    v = m.get(key)
    if v is None:
        return False
    return v < t if direction == "lt" else v > t if direction == "gt" else v >= t


SCREEN_KEYS = [("Low ROA", "roa", "lt"), ("Margin squeeze", "dnim", "ge"), ("Thin equity", "eq", "lt"),
               ("High loans/deposits", "ld", "gt"), ("Deposit outflow", "ddep", "ge"), ("Asset quality", "nc", "gt")]


def flags_with(m, cut):
    """Screens tripped by a metrics dict under a set of cutoffs (same rules as the dashboard)."""
    return [name for name, k, d in SCREEN_KEYS if hit(m, k, d, cut[k])]


def flags_at(qs, i):
    m = metrics_at(qs, i)
    return flags_with(m, THRESH), m


def choose_cutoffs(failed, controls):
    """Coordinate ascent over the tested cutoffs. Objective: share of failures with two or more screens tripped minus the
    share of survivors with two or more tripped (the 'Alert' level). Ties keep the current cutoff."""
    def score(cut):
        fr = sum(1 for r in failed if len(flags_with(r["m"], cut)) >= 2) / max(len(failed), 1)
        sr = sum(1 for r in controls if len(flags_with(r["m"], cut)) >= 2) / max(len(controls), 1)
        return fr - sr
    cut = dict(THRESH)
    for _ in range(3):
        changed = False
        for name, key, d, vals in SWEEP:
            best_t, best_s = cut[key], score(cut)
            for t in vals:
                trial = dict(cut, **{key: t})
                s = score(trial)
                if s > best_s + 1e-9:
                    best_t, best_s = t, s
            if best_t != cut[key]:
                cut[key] = best_t
                changed = True
        if not changed:
            break
    return cut


def history(cert):
    fin = fb.rows(fb.get("financials", {"filters": f"CERT:{cert}", "fields": ",".join(fb.FIN_FIELDS), "sort_by": "REPDTE", "sort_order": "DESC", "limit": 80, "format": "json"}))
    return fb.build_bank({"CERT": cert}, "x", fin)["quarters"]


def index_on_or_before(qs, ymd):
    idx = [i for i, q in enumerate(qs) if q["date"] <= ymd]
    return idx[-1] if idx else None


def even_sample(items, n):
    if len(items) <= n:
        return list(items)
    step = (len(items) - 1) / (n - 1)
    return [items[round(i * step)] for i in range(n)]


def summarize(failed, controls, cut):
    for r in failed + controls:
        r["flags"] = flags_with(r["m"], cut)
    def rate(rows, pred):
        return round(100 * sum(1 for r in rows if pred(r)) / len(rows), 1) if rows else None
    per = {}
    for f in FLAG_NAMES:
        per[f] = {"failed": rate(failed, lambda r, f=f: f in r["flags"]), "survivors": rate(controls, lambda r, f=f: f in r["flags"])}
    sweep = {}
    for name, key, d, vals in SWEEP:
        sweep[name] = [{"cutoff": t, "failed": rate(failed, lambda r, k=key, d=d, t=t: hit(r["m"], k, d, t)), "survivors": rate(controls, lambda r, k=key, d=d, t=t: hit(r["m"], k, d, t))} for t in vals]
    return {
        "sweep": sweep,
        "failed_n": len(failed), "survivor_obs": len(controls),
        "failed_any": rate(failed, lambda r: len(r["flags"]) >= 1), "survivors_any": rate(controls, lambda r: len(r["flags"]) >= 1),
        "failed_2plus": rate(failed, lambda r: len(r["flags"]) >= 2), "survivors_2plus": rate(controls, lambda r: len(r["flags"]) >= 2),
        "per_flag": per,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    args = ap.parse_args()

    fails = fb.rows(fb.get("failures", {"fields": "CERT,NAME,FAILDATE,QBFASSET,CITYST", "sort_by": "FAILDATE", "sort_order": "DESC", "limit": 2000, "format": "json"}))
    parsed = []
    for r in fails:
        d = parse_date(r.get("FAILDATE"))
        if d and r.get("CERT"):
            parsed.append((d, r))
    parsed.sort(key=lambda x: x[0])
    print(f"{len(parsed)} failures listed", file=sys.stderr)

    inst = fb.rows(fb.get("institutions", {"filters": "ACTIVE:1 AND ASSET:[100000 TO 5000000]", "fields": ",".join(fb.INST_FIELDS), "sort_by": "ASSET", "sort_order": "DESC", "limit": 10000, "format": "json"}))
    control_inst = even_sample(sorted(inst, key=lambda x: fb.num(x.get("ASSET")) or 0), N_CONTROLS)
    control_hist = {}
    for c in control_inst:
        try:
            control_hist[c["CERT"]] = history(c["CERT"])
        except Exception as e:  # noqa: BLE001
            print(f"skip control {c.get('CERT')}: {e}", file=sys.stderr)
        time.sleep(0.2)

    raw = []
    for w in WINDOWS:
        lo, hi = parse_date(w["from"]), parse_date(w["to"])
        pool = [(d, r) for d, r in parsed if lo <= d <= hi]
        failed = []
        for d, r in even_sample(pool, w["max_failed"]):
            try:
                qs = history(r["CERT"])
            except Exception as e:  # noqa: BLE001
                print(f"skip failed {r.get('CERT')}: {e}", file=sys.stderr)
                continue
            time.sleep(0.2)
            target = (d - timedelta(days=365)).strftime("%Y%m%d")
            i = index_on_or_before(qs, target)
            if i is None or i < 1:
                continue
            fl, m = flags_at(qs, i)
            failed.append({"name": r.get("NAME"), "failed": d.strftime("%Y-%m-%d"), "asof": qs[i]["date"], "assets": qs[i]["assets"], "flags": fl, "m": m})
        controls = []
        for cert, qs in control_hist.items():
            for ymd in w["asof"]:
                i = index_on_or_before(qs, ymd)
                if i is not None and qs[i]["date"] == ymd and i >= 1:
                    fl, m = flags_at(qs, i)
                    controls.append({"cert": cert, "asof": ymd, "flags": fl, "m": m})
        raw.append((w, failed, controls))

    crisis = [x for x in raw if x[0]["id"] == "crisis"]
    if not crisis or len(crisis[0][1]) < 8 or len(crisis[0][2]) < 60:
        sys.exit("Crisis window too small to tune cutoffs; refusing to write backtest.json")
    tuned = choose_cutoffs(crisis[0][1], crisis[0][2])
    print(f"tuned cutoffs (chosen on {crisis[0][0]['name']}): {tuned}", file=sys.stderr)

    results, obs = [], []
    for w, failed, controls in raw:
        before = summarize(failed, controls, THRESH)
        s = summarize(failed, controls, tuned)
        s.update({"id": w["id"], "name": w["name"], "asof_dates": w["asof"],
                  "before": {k: before[k] for k in ("failed_any", "survivors_any", "failed_2plus", "survivors_2plus")},
                  "examples": [{"name": f["name"], "failed": f["failed"], "asof": f["asof"], "flags": f["flags"]} for f in sorted(failed, key=lambda x: -(x["assets"] or 0))[:6]]})
        results.append(s)
        print(f"{w['id']}: {s['failed_n']} failed, {s['survivor_obs']} survivor observations", file=sys.stderr)
        for kind, rows_ in (("failed", failed), ("survivor", controls)):
            for r in rows_:
                obs.append([w["id"], kind, r.get("name") or r.get("cert"), r.get("asof")] + [("" if r["m"].get(k) is None else round(r["m"][k], 4)) for k in ("roa", "dnim", "eq", "ld", "ddep", "nc")])

    usable = [r for r in results if r["failed_n"] >= 8 and r["survivor_obs"] >= 60]
    if not usable:
        sys.exit("Samples too small to report; refusing to write backtest.json")
    out = {"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), "source": "FDIC BankFind API (failures, financials)",
           "rule": "Screens applied to the call report from about one year before failure; survivors are banks still active, measured at the same dates.",
           "defaults": THRESH, "tuned": {"cutoffs": tuned, "chosen_on": crisis[0][0]["id"], "rule": "Cutoffs were searched on the 2009-2012 window only, to maximize the share of failures with two or more screens tripped minus the share of survivors with two or more tripped. The 2023-2026 window was not used for tuning."},
           "windows": usable}
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "backtest.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    import csv
    with open(os.path.join(args.out, "backtest_obs.csv"), "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(["window", "outcome", "bank", "asof", "roa", "nim_drop", "equity_assets", "loans_deposits", "deposit_drop_pct", "noncurrent_pct"])
        wr.writerows(obs)
    print(f"Wrote {len(usable)} back-test windows to {args.out}/backtest.json")


if __name__ == "__main__":
    main()
