#!/usr/bin/env python3
"""
Run sql/bank_analysis.sql against the bank data and write data/sql_results.json for sql-analysis.html.
Loads data/banks.json, the cutoffs chosen by the back-test (data/backtest.json, else the defaults) and
data/backtest_obs.csv into an in-memory SQLite database. Standard library only.
Usage: python scripts/run_sql.py --data data --sql sql/bank_analysis.sql
"""
import argparse
import csv
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

DEFAULT_CUT = {"roa": 0.5, "dnim": 0.25, "eq": 8.0, "ld": 90.0, "ddep": 5.0, "nc": 3.0}
GRID = [("Low ROA", [0.0, 0.25, 0.5, 0.75, 1.0]), ("Margin squeeze", [0.1, 0.25, 0.5]), ("Thin equity", [6.0, 7.0, 8.0, 9.0, 10.0]),
        ("High loans/deposits", [70.0, 80.0, 90.0, 100.0]), ("Deposit outflow", [2.0, 5.0, 10.0]), ("Asset quality", [1.0, 2.0, 3.0, 5.0])]


def num(v):
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def build_db(data_dir):
    db = sqlite3.connect(":memory:")
    db.executescript("""
    CREATE TABLE banks(cert INTEGER, name TEXT, city TEXT, state TEXT, grp TEXT, est_year INTEGER);
    CREATE TABLE quarters(cert INTEGER, date TEXT, assets REAL, deposits REAL, loans REAL, equity REAL, roa REAL, nim REAL, eq_assets REAL, loans_dep REAL, eff REAL, noncurrent REAL);
    CREATE TABLE cutoffs(roa REAL, dnim REAL, eq REAL, ld REAL, ddep REAL, nc REAL);
    CREATE TABLE obs(window TEXT, outcome TEXT, bank TEXT, asof TEXT, roa REAL, nim_drop REAL, equity_assets REAL, loans_deposits REAL, deposit_drop_pct REAL, noncurrent_pct REAL);
    CREATE TABLE grid(screen TEXT, t REAL);
    """)
    banks = json.load(open(os.path.join(data_dir, "banks.json"), encoding="utf-8"))["banks"]
    for b in banks:
        db.execute("INSERT INTO banks VALUES (?,?,?,?,?,?)", (b["cert"], b["name"], b.get("city"), b.get("state"), b["group"], b.get("est")))
        for q in b["quarters"]:
            db.execute("INSERT INTO quarters VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (b["cert"], q["date"], q["assets"], q["deposits"], q["loans"], q["equity"], q["roa"], q["nim"], q["eq_assets"], q["loans_dep"], q["eff"], q["noncurrent"]))
    cut = dict(DEFAULT_CUT)
    bt_path = os.path.join(data_dir, "backtest.json")
    if os.path.exists(bt_path):
        cut.update({k: v for k, v in json.load(open(bt_path, encoding="utf-8")).get("tuned", {}).get("cutoffs", {}).items() if k in cut})
    db.execute("INSERT INTO cutoffs VALUES (?,?,?,?,?,?)", tuple(cut[k] for k in ("roa", "dnim", "eq", "ld", "ddep", "nc")))
    obs_path = os.path.join(data_dir, "backtest_obs.csv")
    if os.path.exists(obs_path):
        for r in csv.DictReader(open(obs_path, encoding="utf-8")):
            db.execute("INSERT INTO obs VALUES (?,?,?,?,?,?,?,?,?,?)", (r["window"], r["outcome"], r["bank"], r["asof"], num(r["roa"]), num(r["nim_drop"]), num(r["equity_assets"]), num(r["loans_deposits"]), num(r["deposit_drop_pct"]), num(r["noncurrent_pct"])))
    for name, vals in GRID:
        for t in vals:
            db.execute("INSERT INTO grid VALUES (?,?)", (name, t))
    return db, cut


def parse_queries(path):
    text = open(path, encoding="utf-8").read()
    out = []
    for block in re.split(r"(?m)^-- @query ", text)[1:]:
        head, _, body = block.partition("\n")
        qid, title, desc = [x.strip() for x in head.split("|", 2)]
        out.append({"id": qid, "title": title, "description": desc, "sql": body.strip()})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data")
    ap.add_argument("--sql", default="sql/bank_analysis.sql")
    args = ap.parse_args()
    db, cut = build_db(args.data)
    results = []
    for q in parse_queries(args.sql):
        cur = db.execute(q["sql"])
        cols = [d[0] for d in cur.description]
        rows = cur.fetchmany(60)
        q.update({"columns": cols, "rows": rows})
        results.append(q)
        print(f"{q['id']}: {len(rows)} rows", file=sys.stderr)
    out = {"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), "cutoffs": cut, "sqlite": sqlite3.sqlite_version, "queries": results}
    with open(os.path.join(args.data, "sql_results.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(results)} query results to {args.data}/sql_results.json")


if __name__ == "__main__":
    main()
