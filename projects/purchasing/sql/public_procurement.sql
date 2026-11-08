-- SQLite. Load data/public/purchase_records.csv as public_purchases (all fields TEXT).
-- Source row is traceability, not a business transaction identifier.
-- sqlite3 commands:
-- .mode csv
-- .import projects/purchasing/data/public/purchase_records.csv public_purchases

-- Descriptive positive recorded line amounts; not actual invoice payments.
SELECT category, COUNT(*) AS source_lines,
       ROUND(SUM(CASE WHEN CAST(total_price AS REAL)>0
                      THEN CAST(total_price AS REAL) ELSE 0 END),2) AS positive_recorded_amount
FROM public_purchases GROUP BY category;

-- Supplier-name concentration, descriptive only; validate names and IDs before vendor decisions.
WITH totals AS (
  SELECT supplier, SUM(CAST(total_price AS REAL)) AS amount
  FROM public_purchases WHERE CAST(total_price AS REAL)>0 GROUP BY supplier
)
SELECT supplier, ROUND(amount,2) AS amount,
       ROUND(100.0*amount/SUM(amount) OVER (),2) AS share_pct,
       DENSE_RANK() OVER (ORDER BY amount DESC) AS amount_rank
FROM totals ORDER BY amount DESC;

-- Repeated business fields do not prove duplicate payments. Keep all records for review.
SELECT po_number, department, supplier_id, purchase_date, creation_date,
       category, commodity, item, description, quantity, unit_price, total_price,
       COUNT(*) AS repeated_source_lines
FROM public_purchases
GROUP BY po_number, department, supplier_id, purchase_date, creation_date,
         category, commodity, item, description, quantity, unit_price, total_price
HAVING COUNT(*)>1;

-- Follow-up list is traceable to the original government export.
SELECT source_row, po_number, supplier, item, total_price, flags
FROM public_purchases WHERE flags<>'' ORDER BY CAST(source_row AS INTEGER);

-- No unit-price variance or bulk-discount inference: source extract has no unit-of-measure field.
