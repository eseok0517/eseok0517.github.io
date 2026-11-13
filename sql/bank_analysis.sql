-- Bank health analysis in SQL (SQLite). Each block between "@query" markers is run by scripts/run_sql.py
-- against the FDIC call-report data in data/banks.json and the back-test observations in data/backtest_obs.csv.
--
-- Tables
--   banks(cert, name, city, state, grp, est_year)       grp: 'az' (Arizona-headquartered), 'big' (ten largest), 'peer' (size-matched)
--   quarters(cert, date, assets, deposits, loans, equity, roa, nim, eq_assets, loans_dep, eff, noncurrent)
--   cutoffs(roa, dnim, eq, ld, ddep, nc)                one row: the screen cutoffs in use
--   obs(window, outcome, bank, asof, roa, nim_drop, equity_assets, loans_deposits, deposit_drop_pct, noncurrent_pct)
--   grid(screen, t)                                     alternative cutoffs to test

-- @query medians | Latest-quarter medians by peer group | Median of each measure for Arizona community banks, similar-sized peers and the ten largest banks. SQLite has no MEDIAN function, so each value is ranked inside its group and the middle one or two rows are averaged.
WITH latest AS (
  SELECT CASE WHEN b.grp = 'az' AND q.assets < 10000000 THEN 'az_community'
              WHEN b.grp = 'az' THEN 'az_large' ELSE b.grp END AS grp,
         q.roa, q.nim, q.loans_dep, q.eff
  FROM quarters q JOIN banks b USING (cert)
  WHERE q.date = (SELECT MAX(date) FROM quarters)
),
long AS (
  SELECT grp, 'Return on assets (%)' AS metric, roa AS v FROM latest WHERE roa IS NOT NULL
  UNION ALL SELECT grp, 'Net interest margin (%)', nim FROM latest WHERE nim IS NOT NULL
  UNION ALL SELECT grp, 'Loans / deposits (%)', loans_dep FROM latest WHERE loans_dep IS NOT NULL
  UNION ALL SELECT grp, 'Efficiency ratio (%)', eff FROM latest WHERE eff IS NOT NULL
),
ranked AS (
  SELECT grp, metric, v,
         ROW_NUMBER() OVER (PARTITION BY grp, metric ORDER BY v) AS rn,
         COUNT(*)     OVER (PARTITION BY grp, metric)            AS n
  FROM long
),
med AS (
  SELECT grp, metric, AVG(v) AS m FROM ranked
  WHERE rn IN ((n + 1) / 2, (n + 2) / 2) GROUP BY grp, metric
)
SELECT metric,
       ROUND(MAX(CASE WHEN grp = 'az_community' THEN m END), 2) AS az_community,
       ROUND(MAX(CASE WHEN grp = 'peer'         THEN m END), 2) AS similar_peers,
       ROUND(MAX(CASE WHEN grp = 'big'          THEN m END), 2) AS ten_largest
FROM med GROUP BY metric ORDER BY metric;

-- @query screens | Arizona banks and the screens each one trips | Each screen is a 0/1 condition against the cutoffs table. LAG(..., 4) looks back four quarters for the margin and deposit trends. Two or more screens is the alert level.
WITH hist AS (
  SELECT cert, date, roa, nim, eq_assets, loans_dep, noncurrent, deposits,
         LAG(nim, 4)      OVER (PARTITION BY cert ORDER BY date) AS nim_4q,
         LAG(deposits, 4) OVER (PARTITION BY cert ORDER BY date) AS dep_4q
  FROM quarters
),
latest AS (
  SELECT h.*, b.name, b.grp FROM hist h JOIN banks b USING (cert)
  WHERE h.date = (SELECT MAX(date) FROM quarters)
),
scored AS (
  SELECT l.name, l.grp, l.roa,
         COALESCE(l.roa < c.roa, 0)                                         AS low_roa,
         COALESCE(l.nim_4q - l.nim >= c.dnim, 0)                            AS margin_squeeze,
         COALESCE(l.eq_assets < c.eq, 0)                                    AS thin_equity,
         COALESCE(l.loans_dep > c.ld, 0)                                    AS high_loans_deposits,
         COALESCE((l.dep_4q - l.deposits) * 100.0 / l.dep_4q >= c.ddep, 0)  AS deposit_outflow,
         COALESCE(l.noncurrent > c.nc, 0)                                   AS asset_quality
  FROM latest l CROSS JOIN cutoffs c
)
SELECT name, ROUND(roa, 2) AS roa,
       low_roa + margin_squeeze + thin_equity + high_loans_deposits + deposit_outflow + asset_quality AS screens_tripped,
       CASE WHEN low_roa + margin_squeeze + thin_equity + high_loans_deposits + deposit_outflow + asset_quality >= 2 THEN 'Alert'
            WHEN low_roa + margin_squeeze + thin_equity + high_loans_deposits + deposit_outflow + asset_quality = 1 THEN 'Watch'
            ELSE 'None' END AS status
FROM scored WHERE grp = 'az'
ORDER BY screens_tripped DESC, roa;

-- @query flagshare | Share of banks tripping screens, by group | The same screen logic applied to every group, so Arizona community banks can be compared with banks of their own size.
WITH hist AS (
  SELECT cert, date, roa, nim, eq_assets, loans_dep, noncurrent, deposits, assets,
         LAG(nim, 4)      OVER (PARTITION BY cert ORDER BY date) AS nim_4q,
         LAG(deposits, 4) OVER (PARTITION BY cert ORDER BY date) AS dep_4q
  FROM quarters
),
latest AS (
  SELECT CASE WHEN b.grp = 'az' AND h.assets < 10000000 THEN 'Arizona community banks'
              WHEN b.grp = 'az' THEN 'Arizona large banks'
              WHEN b.grp = 'peer' THEN 'Similar-sized peers' ELSE 'Ten largest banks' END AS grp, h.*
  FROM hist h JOIN banks b USING (cert)
  WHERE h.date = (SELECT MAX(date) FROM quarters)
),
scored AS (
  SELECT l.grp,
         COALESCE(l.roa < c.roa, 0) + COALESCE(l.nim_4q - l.nim >= c.dnim, 0) + COALESCE(l.eq_assets < c.eq, 0)
         + COALESCE(l.loans_dep > c.ld, 0) + COALESCE((l.dep_4q - l.deposits) * 100.0 / l.dep_4q >= c.ddep, 0)
         + COALESCE(l.noncurrent > c.nc, 0) AS n
  FROM latest l CROSS JOIN cutoffs c
)
SELECT grp, COUNT(*) AS banks,
       ROUND(100.0 * SUM(n >= 1) / COUNT(*), 0) AS pct_watch_or_alert,
       ROUND(100.0 * SUM(n >= 2) / COUNT(*), 0) AS pct_alert
FROM scored GROUP BY grp ORDER BY banks;

-- @query backtest | Back-test: failed banks against survivors | Screens applied to the call report from about one year before each failure, and to banks that survived, at the same dates.
SELECT window, outcome, COUNT(*) AS observations,
       ROUND(100.0 * SUM(n >= 1) / COUNT(*), 1) AS pct_watch_or_alert,
       ROUND(100.0 * SUM(n >= 2) / COUNT(*), 1) AS pct_alert
FROM (
  SELECT o.window, o.outcome,
         COALESCE(o.roa < c.roa, 0) + COALESCE(o.nim_drop >= c.dnim, 0) + COALESCE(o.equity_assets < c.eq, 0)
         + COALESCE(o.loans_deposits > c.ld, 0) + COALESCE(o.deposit_drop_pct >= c.ddep, 0)
         + COALESCE(o.noncurrent_pct > c.nc, 0) AS n
  FROM obs o CROSS JOIN cutoffs c
)
GROUP BY window, outcome ORDER BY window, outcome;

-- @query sweep | Cutoff sensitivity, 2009-2012 failures | For every alternative cutoff in the grid, the share of failed banks and of surviving banks the screen would flag. A good cutoff flags many failures and few survivors.
SELECT screen, t AS cutoff,
       ROUND(100.0 * SUM(CASE WHEN outcome = 'failed'   AND hit THEN 1 ELSE 0 END) / SUM(outcome = 'failed'),   1) AS pct_failed_flagged,
       ROUND(100.0 * SUM(CASE WHEN outcome = 'survivor' AND hit THEN 1 ELSE 0 END) / SUM(outcome = 'survivor'), 1) AS pct_survivors_flagged
FROM (
  SELECT g.screen, g.t, o.outcome,
         COALESCE(CASE g.screen
           WHEN 'Low ROA'             THEN o.roa < g.t
           WHEN 'Margin squeeze'      THEN o.nim_drop >= g.t
           WHEN 'Thin equity'         THEN o.equity_assets < g.t
           WHEN 'High loans/deposits' THEN o.loans_deposits > g.t
           WHEN 'Deposit outflow'     THEN o.deposit_drop_pct >= g.t
           WHEN 'Asset quality'       THEN o.noncurrent_pct > g.t END, 0) AS hit
  FROM grid g JOIN obs o ON o.window = 'crisis'
)
GROUP BY screen, t ORDER BY screen, t;

-- @query sizeband | Median ROA by asset-size band | Arizona community banks against peers within the same size band, to check whether bank size explains the profitability gap.
WITH latest AS (
  SELECT CASE WHEN q.assets < 150000 THEN '1. Under $150M'
              WHEN q.assets < 300000 THEN '2. $150M to $300M'
              ELSE '3. $300M and over' END AS band,
         CASE WHEN b.grp = 'az' THEN 'az' ELSE 'peer' END AS grp, q.roa
  FROM quarters q JOIN banks b USING (cert)
  WHERE q.date = (SELECT MAX(date) FROM quarters) AND b.grp IN ('az', 'peer') AND q.assets < 10000000 AND q.roa IS NOT NULL
),
ranked AS (
  SELECT band, grp, roa,
         ROW_NUMBER() OVER (PARTITION BY band, grp ORDER BY roa) AS rn,
         COUNT(*)     OVER (PARTITION BY band, grp)              AS n
  FROM latest
)
SELECT band,
       MAX(CASE WHEN grp = 'az'   THEN n END)                                   AS az_banks,
       ROUND(AVG(CASE WHEN grp = 'az'   AND rn IN ((n+1)/2, (n+2)/2) THEN roa END), 2) AS az_median_roa,
       MAX(CASE WHEN grp = 'peer' THEN n END)                                   AS peer_banks,
       ROUND(AVG(CASE WHEN grp = 'peer' AND rn IN ((n+1)/2, (n+2)/2) THEN roa END), 2) AS peer_median_roa
FROM ranked GROUP BY band ORDER BY band;
