-- SQL Server compatible analytics. Also executed by the Python SQLite runner.
-- Inputs: items, usage, purchases and policy_results CSV tables.
CREATE VIEW supplier_spend AS
SELECT i.supplier_id, p.month, SUM(p.spend) AS spend,
       SUM(p.quantity) AS purchased_units
FROM purchases p JOIN items i ON p.item_id=i.item_id
GROUP BY i.supplier_id,p.month;

CREATE VIEW monthly_spend_change AS
SELECT supplier_id,month,spend,
       LAG(spend) OVER (PARTITION BY supplier_id ORDER BY month) AS prior_month_spend
FROM supplier_spend;

-- Comparisons use the same held-out demand stream and period.
CREATE VIEW policy_comparison AS
SELECT r.item_id,r.policy,r.fill_rate,r.relevant_cost,
       c.relevant_cost-r.relevant_cost AS six_month_cost_reduction,
       c.avg_inventory_value-r.avg_inventory_value AS inventory_capital_released
FROM policy_results r JOIN policy_results c ON r.item_id=c.item_id AND c.policy='Current';

-- Diagnostic only. Do not select policies using held-out results.
CREATE VIEW stockout_exceptions AS
SELECT item_id,policy,lost_units,fill_rate,
       DENSE_RANK() OVER (PARTITION BY policy ORDER BY lost_units DESC) AS shortage_rank
FROM policy_results WHERE lost_units>0;
