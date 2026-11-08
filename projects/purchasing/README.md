> **Original synthetic scenario:** This document describes the separate model at [scenario.html](scenario.html). For the real public procurement case, see [PUBLIC_DATA.md](PUBLIC_DATA.md).

# Manufacturing purchasing strategy

**Question:** when does a supplier discount compensate for the extra inventory capital and replenishment risk of a purchasing policy?

Independent portfolio project by Ehahn Seok. All company records are synthetic; no LG Energy Solution data is used. Results are modeled outcomes, not realized savings.

## Review the project

- Open `index.html` through an HTTP server, or visit the case study through the portfolio navigation.
- Open `financial_model.xlsx` for an editable, annual steady-state financial model.
- Inspect `data/policy_results.csv` for six-month held-out simulation results.
- Read `MANAGEMENT_MEMO.md` for recommendations and qualifications.
- Use `powerbi/BUILD_GUIDE.md` and `powerbi/measures.dax` to assemble a native Power BI report. A `.pbix` report is not included.

## Reproduce

Python 3.10+; standard library only:

```bash
python projects/purchasing/scripts/build_analysis.py
python projects/purchasing/scripts/verify_analysis.py
```

Run from the repository root. The generator uses seed 242 and overwrites its own generated data files. It runs `sql/analysis.sql` against SQLite, giving reviewers a setup-free way to execute the SQL. The same analytics use SQL Server-compatible constructs. SQL Server itself was not run in this environment; import the four named CSVs into matching tables before executing the views in SSMS. `sql/schema.sql` supplies table definitions. `data/purchasing.sqlite` is also generated for inspection in DB Browser for SQLite.

## Data dictionary

| File | Grain | Important fields |
|---|---|---|
| items.csv | One item; 120 rows | item_id key, category, supplier_id, unit_cost per piece, pack_size, lead_days, assigned location |
| usage.csv | Item × month; 2,880 rows | month YYYY-MM, Train/Test, quantity in pieces |
| raw_purchases.csv | Exported transaction, with duplicates; 2,916 rows | transaction_id, untrimmed item_id, packs, pack-level unit_price |
| purchases.csv | Deduplicated transaction; 2,880 rows | trimmed key, piece quantity, piece unit_cost, line spend |
| test_demand.csv | Item × modeled day; 21,600 rows | day 1–180, integer demand_units |
| policy_results.csv | Item × policy; 360 rows | costs, inventory value, fill rate, inventory reconciliation |
| analysis.json | Dashboard payload | Metadata and the same 360 policy result rows |

Each item belongs to one room; this project does not simulate inter-room transfers. Purchase exports illustrate data cleaning and supplier-spending analysis. They are generated independently of the counterfactual inventory simulation and must not be treated as simulated policy receipts. Export prices rise by 0.3% per month; simulation prices use fixed item standard costs.

## Cleaning and controls

Trim identifier whitespace, remove exact duplicate transaction IDs, convert packs to pieces, and calculate line spending. There are exactly 36 intentionally duplicated rows. No invalid keys are silently dropped. If adapting this pipeline to real data, conflicting duplicates should be quarantined rather than resolved by first-row retention.

## Simulation method

1. Generate 24 monthly observations for each of 120 items. Demand includes seasonality, noise and a 15% step-up during the test period. Each modeled month has 30 days.
2. Use only the first 18 months (Jan 2024–Jun 2025) to calculate mean daily demand and a demand-variability proxy: standard deviation of monthly quantities divided by 30.
3. Freeze order quantities at 90 days (Current), 30 days (Frequent) or 120 days (Bulk) of training demand. Round up to whole packs.
4. Reorder point = ceiling(mean daily demand × lead days + 1.65 × variability proxy × lead days). This is an illustrative buffer, **not** a statistically calibrated 95% service-level guarantee.
5. Distribute each test month's demand over 30 integer daily observations. All policies for an item receive the identical demand stream. Deliveries arrive before demand; replenishment decisions occur after demand and consider stock on hand plus open orders.
6. Start each policy with reorder point + order quantity. Orders arrive after the item's fixed lead time. Unfilled demand is lost, not backordered. No alternative policy is selected or tuned using test results.
7. Average end-of-day stock values inventory at undiscounted standard cost. Verify opening units + receipts − filled demand = ending units for every policy.

## Economics

All amounts are USD. The simulation covers 180 modeled days on a 360-day year.

- Carrying cost = average inventory value × 18% × 180/360.
- Freight = orders placed × $45. Orders placed at the horizon incur freight even if received later.
- Shortage penalty = lost units × standard unit cost × 50%. This is an assumption, not an estimated production-loss function.
- Discount benefit = filled Bulk units × standard unit cost × 4%. Recognized on usage for comparison; not a purchase cash-flow calculation.
- Net policy cost = freight + carrying + shortage penalty − discount benefit. Excludes common undiscounted material usage cost; negative values do not mean negative total materials cost.
- Capital released = Current average inventory at standard cost − alternative average inventory at standard cost. A positive value is an estimated reduction in inventory investment, not recurring earnings.

The sliders revalue fixed simulation paths. They do not recompute order quantities, service levels, or demand. Changing inventory policy requires rerunning the simulation.

## Excel model

Three worksheets: Decision (outputs and editable drivers), Model (120 item calculations), and Source (training inputs). The workbook is a **separate annual cycle-stock approximation**: average inventory = half an order + a shared demand buffer. It uses fractional annual order counts and excludes shortages. It intentionally does not equal the held-out simulation, which uses daily inventory paths, finite-horizon order counts and policy-specific opening inventory.

Native Excel desktop and Power BI Desktop were not available for verification. Workbook formulas were recalculated in the authoring engine and input changes were checked. Native Power BI steps and DAX are provided for local assembly.

## Limitations and next work

Synthetic data cannot validate achievable company savings. Policy-specific opening stock, deterministic lead times, omitted capacity/expiry constraints and the short horizon influence comparisons. No transition cash-flow plan is modeled. Before operational use, estimate real criticality-based shortage costs, model variable lead times, test multiple independent demand paths, and evaluate working-capital transitions. Do not claim ERP/SAP experience based on this project.
